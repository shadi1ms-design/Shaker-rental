/**
 * CLOUD FUNCTION: telegramWebhook
 * 
 * Receives callback_query from Telegram Bot API with:
 * - FUNCTION_REGION = 'asia-south1' (Unified with Firestore & Cloud Functions)
 * - TELEGRAM_ALLOWED_USER_IDS & TELEGRAM_CHAT_ID verification
 * - HTML Parse mode & HTML escaping
 * - Idempotency via telegram_callbacks/{id}
 */

import { onRequest } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { applyBookingStatusChange } from './bookingHelpers';

const db = getFirestore(getApp(), DATABASE_ID);

/**
 * Escapes characters for Telegram HTML mode.
 */
function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Helper to fetch with an 8-second AbortController timeout
 */
async function fetchWithTimeout(url: string, options: any, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Answers a Telegram callback query to dismiss loading state or display alerts.
 */
async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  options?: { text?: string; show_alert?: boolean }
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: options?.text,
        show_alert: options?.show_alert ?? false,
      }),
    });
  } catch (err) {
    console.warn('[telegramWebhook] Error answering callback query:', err);
  }
}

/**
 * Edits the original message text in Telegram to reflect final state.
 */
async function editMessageText(
  botToken: string,
  chatId: string | number,
  messageId: string | number,
  text: string
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      }),
    });
  } catch (err) {
    console.warn('[telegramWebhook] Error editing Telegram message:', err);
  }
}

export const telegramWebhook = onRequest(
  {
    region: FUNCTION_REGION,
    invoker: 'public',
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_CHAT_ID'],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // 1. Webhook secret header check using constant-time comparison (crypto.timingSafeEqual)
      // .trim(): secrets saved with a trailing newline/space would otherwise never match.
      const secretHeader = String(req.headers['x-telegram-bot-api-secret-token'] || '').trim();
      const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

      let isValidSecret = false;
      if (secretHeader && expectedSecret) {
        const bufA = Buffer.from(secretHeader);
        const bufB = Buffer.from(expectedSecret);
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          isValidSecret = true;
        }
      }

      if (!isValidSecret) {
        const reason = !expectedSecret
          ? 'TELEGRAM_WEBHOOK_SECRET is empty on the server'
          : !secretHeader
          ? 'request has no x-telegram-bot-api-secret-token header (webhook was registered WITHOUT secret_token, or this is not Telegram)'
          : 'secret_token sent by Telegram differs from TELEGRAM_WEBHOOK_SECRET (re-run setWebhook with the same secret)';
        console.warn(`[telegramWebhook] Unauthorized webhook request: ${reason}`);
        res.status(401).end();
        return;
      }

      const callbackQuery = req.body?.callback_query;
      if (!callbackQuery) {
        res.status(200).send('ok');
        return;
      }

      const callbackQueryId = String(callbackQuery.id || '').trim();
      const callbackData = String(callbackQuery.data || '').trim();
      const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();

      if (!botToken) {
        console.error('[telegramWebhook] TELEGRAM_BOT_TOKEN is missing in environment.');
        res.status(200).send('ok');
        return;
      }

      const senderUserId = callbackQuery.from?.id;
      const messageChatId = callbackQuery.message?.chat?.id;

      // 2. Sender Authorization: TELEGRAM_ALLOWED_USER_IDS (Fail-closed if empty)
      const allowedUserIdsRaw = process.env.TELEGRAM_ALLOWED_USER_IDS || '';
      const allowedIds = allowedUserIdsRaw.split(',').map((id) => id.trim()).filter(Boolean);

      if (allowedIds.length === 0 || !senderUserId || !allowedIds.includes(String(senderUserId))) {
        console.warn(`[telegramWebhook] Unauthorized Telegram user rejected (fail-closed): ${senderUserId}`);
        if (callbackQueryId) {
          await answerCallbackQuery(botToken, callbackQueryId, {
            text:
              'عذراً، حسابك غير مصرح له بتنفيذ عمليات على هذا النظام.\n' +
              `معرّف حسابك على تيليجرام: ${senderUserId ?? 'غير معروف'}\n` +
              'أضفه إلى السر TELEGRAM_ALLOWED_USER_IDS (أرقام مفصولة بفواصل) ثم أعد نشر الدالة.',
            show_alert: true,
          });
        }
        res.status(200).send('ok');
        return;
      }

      // 3. Chat ID Verification: TELEGRAM_CHAT_ID (Requirement 4)
      const expectedChatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
      if (expectedChatId && messageChatId) {
        if (String(messageChatId).trim() !== String(expectedChatId).trim()) {
          console.warn(`[telegramWebhook] Unauthorized Telegram chat rejected: ${messageChatId}`);
          if (callbackQueryId) {
            await answerCallbackQuery(botToken, callbackQueryId, {
              text: `هذه المحادثة غير معتمدة (معرّفها: ${messageChatId}). تأكد أن TELEGRAM_CHAT_ID يطابق معرّف المحادثة التي وصلت إليها رسالة الحجز.`,
              show_alert: true,
            });
          }
          res.status(200).send('ok');
          return;
        }
      }

      // 4. Idempotency via telegram_callbacks/{id}.
      // create() is atomic: two concurrent deliveries of the same callback cannot both pass.
      // The lock is released again if processing crashes, so a Telegram retry is not silently swallowed.
      let callbackRef: DocumentReference | null = null;
      if (callbackQueryId) {
        callbackRef = db.collection('telegram_callbacks').doc(callbackQueryId);
        try {
          await callbackRef.create({
            id: callbackQueryId,
            callbackData,
            senderUserId: senderUserId || null,
            handledAt: FieldValue.serverTimestamp(),
          });
        } catch (lockErr: any) {
          const alreadyExists = lockErr?.code === 6 || /ALREADY_EXISTS/i.test(String(lockErr?.message || ''));
          if (alreadyExists) {
            await answerCallbackQuery(botToken, callbackQueryId, {
              text: 'تمت معالجة هذا الإجراء مسبقاً بنجاح.',
              show_alert: false,
            });
            res.status(200).send('ok');
            return;
          }
          throw lockErr;
        }
      }

      // 5. Extract action and booking ID
      let actionType = '';
      let bookingId = '';

      if (callbackData.startsWith('bk_confirm_')) {
        actionType = 'confirm';
        bookingId = callbackData.replace('bk_confirm_', '').trim();
      } else if (callbackData.startsWith('bk_reject_')) {
        actionType = 'reject';
        bookingId = callbackData.replace('bk_reject_', '').trim();
      } else if (callbackData.startsWith('bk_rent_')) {
        actionType = 'rent';
        bookingId = callbackData.replace('bk_rent_', '').trim();
      } else if (callbackData.startsWith('bk_complete_')) {
        actionType = 'complete';
        bookingId = callbackData.replace('bk_complete_', '').trim();
      }

      if (!actionType || !bookingId) {
        if (callbackQueryId) {
          await answerCallbackQuery(botToken, callbackQueryId, {
            text: 'إجراء غير معروف.',
            show_alert: true,
          });
        }
        res.status(200).send('ok');
        return;
      }

      const statusMap: Record<string, string> = {
        confirm: 'confirmed',
        reject: 'rejected',
        rent: 'rented',
        complete: 'completed',
      };
      const newStatus = statusMap[actionType];

      // 6. Apply booking status change
      const actorLabel = callbackQuery.from?.first_name || `موظف (${senderUserId})`;
      let changeResult: Awaited<ReturnType<typeof applyBookingStatusChange>>;
      try {
        changeResult = await applyBookingStatusChange(db, bookingId, newStatus, actorLabel, {
          actorUid: null,
          actorEmail: null,
          actorType: 'staff',
          telegramUserId: senderUserId ?? null,
          telegramName: callbackQuery.from?.first_name ?? null,
        });
      } catch (applyErr) {
        console.error('[telegramWebhook] applyBookingStatusChange threw:', applyErr);
        if (callbackRef) await callbackRef.delete().catch(() => {});
        changeResult = { success: false, message: 'حدث خطأ داخلي أثناء تحديث الحجز، يرجى المحاولة مرة أخرى.' };
      }
      if (!changeResult.success) {
        console.warn(`[telegramWebhook] ${actionType} on booking ${bookingId} refused: ${changeResult.message}`);
      }

      // 7. Answer callback and edit message with HTML mode
      if (callbackQueryId) {
        await answerCallbackQuery(botToken, callbackQueryId, {
          text: changeResult.message,
          show_alert: !changeResult.success,
        });
      }

      if (changeResult.success && callbackQuery.message?.message_id && messageChatId) {
        const originalText = String(callbackQuery.message?.text || '');
        const statusEmoji = actionType === 'confirm' ? '✅' : actionType === 'reject' ? '❌' : '🔄';
        const actionArabic =
          actionType === 'confirm' ? 'تم التأكيد' :
          actionType === 'reject' ? 'تم الرفض' :
          actionType === 'rent' ? 'تم التسليم وتأجير السيارة' : 'تم اكتمال واستلام السيارة';

        const updatedText =
          `${escapeHtml(originalText)}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${statusEmoji} <b>${escapeHtml(actionArabic)}</b> بواسطة: <b>${escapeHtml(actorLabel)}</b>`;

        await editMessageText(botToken, messageChatId, callbackQuery.message.message_id, updatedText);
      }

      res.status(200).send('ok');
    } catch (err: any) {
      console.error('[telegramWebhook] Uncaught error handling webhook:', err);
      res.status(200).send('ok');
    }
  }
);
