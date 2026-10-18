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
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { applyBookingStatusChange } from './bookingHelpers';

const db = getFirestore(admin.app(), DATABASE_ID);

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
 * Answers a Telegram callback query to dismiss loading state or display alerts.
 */
async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  options?: { text?: string; show_alert?: boolean }
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    await fetch(url, {
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
    await fetch(url, {
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
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_CHAT_ID'],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // 1. Webhook secret header check
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

      if (!expectedSecret || secretHeader !== expectedSecret) {
        console.warn('[telegramWebhook] Unauthorized webhook request. Secret mismatch.');
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
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        console.error('[telegramWebhook] TELEGRAM_BOT_TOKEN is missing in environment.');
        res.status(200).send('ok');
        return;
      }

      const senderUserId = callbackQuery.from?.id;
      const messageChatId = callbackQuery.message?.chat?.id;

      // 2. Sender Authorization: TELEGRAM_ALLOWED_USER_IDS (Requirement 4)
      const allowedUserIdsRaw = process.env.TELEGRAM_ALLOWED_USER_IDS;
      if (allowedUserIdsRaw) {
        const allowedIds = allowedUserIdsRaw.split(',').map((id) => id.trim()).filter(Boolean);
        if (!senderUserId || !allowedIds.includes(String(senderUserId))) {
          console.warn(`[telegramWebhook] Unauthorized Telegram user rejected: ${senderUserId}`);
          if (callbackQueryId) {
            await answerCallbackQuery(botToken, callbackQueryId, {
              text: 'عذراً، معرف حسابك غير مصرح له بتنفيذ عمليات على هذا النظام.',
              show_alert: true,
            });
          }
          res.status(200).send('ok');
          return;
        }
      }

      // 3. Chat ID Verification: TELEGRAM_CHAT_ID (Requirement 4)
      const expectedChatId = process.env.TELEGRAM_CHAT_ID;
      if (expectedChatId && messageChatId) {
        if (String(messageChatId).trim() !== String(expectedChatId).trim()) {
          console.warn(`[telegramWebhook] Unauthorized Telegram chat rejected: ${messageChatId}`);
          if (callbackQueryId) {
            await answerCallbackQuery(botToken, callbackQueryId, {
              text: 'هذه المجموعة أو المحادثة غير معتمدة لإجراءات النظام.',
              show_alert: true,
            });
          }
          res.status(200).send('ok');
          return;
        }
      }

      // 4. Idempotency Check via telegram_callbacks/{id} (Requirement 4)
      if (callbackQueryId) {
        const callbackRef = db.collection('telegram_callbacks').doc(callbackQueryId);
        const callbackSnap = await callbackRef.get();
        if (callbackSnap.exists) {
          await answerCallbackQuery(botToken, callbackQueryId, {
            text: 'تمت معالجة هذا الإجراء مسبقاً بنجاح.',
            show_alert: false,
          });
          res.status(200).send('ok');
          return;
        }

        // Record callback handling for idempotency
        await callbackRef.set({
          id: callbackQueryId,
          callbackData,
          senderUserId: senderUserId || null,
          handledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
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
      const changeResult = await applyBookingStatusChange(db, bookingId, newStatus, actorLabel, {
        actorUid: null,
        actorEmail: null,
        actorType: 'staff',
        telegramUserId: senderUserId ?? null,
        telegramName: callbackQuery.from?.first_name ?? null,
      });

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
