/**
 * CLOUD FUNCTION: telegramWebhook
 * 
 * يستقبل طلبات Webhook القادمة من Telegram Bot API (تحديداً تفاعلات الأزرار callback_query).
 * يُعالج الإجراءات التالية:
 *   - bk_confirm_{bookingId} -> confirmed
 *   - bk_reject_{bookingId}  -> rejected
 *   - bk_rent_{bookingId}    -> rented
 *   - bk_complete_{bookingId} -> completed
 */

import { onRequest } from 'firebase-functions/v2/https';
import { applyBookingStatusChange } from './index';

const FUNCTION_REGION = 'us-east1';

export const telegramWebhook = onRequest(
  {
    region: FUNCTION_REGION,
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      // أ) الأمان: التحقق من التوكن السري القادم في ترويسة تيليجرام
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

      if (!expectedSecret || secretHeader !== expectedSecret) {
        console.warn('[telegramWebhook] Unauthorized request rejected. Missing or invalid secret header.');
        res.status(401).end();
        return;
      }

      // ب) استخراج callback_query من req.body
      const callbackQuery = req.body?.callback_query;
      if (!callbackQuery) {
        res.status(200).send('ok');
        return;
      }

      const callbackQueryId = callbackQuery.id;
      const callbackData = String(callbackQuery.data || '').trim();
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        console.error('[telegramWebhook] TELEGRAM_BOT_TOKEN is not defined in runtime environment.');
        res.status(200).send('ok');
        return;
      }

      // ج) استخراج نوع الإجراء ومعرف الحجز
      // الأنماط المدعومة: bk_confirm_, bk_reject_, bk_rent_, bk_complete_
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
        console.warn('[telegramWebhook] Unknown or unsupported callback_data:', callbackData);
        if (callbackQueryId) {
          await answerCallbackQuery(botToken, callbackQueryId, {
            text: 'إجراء غير معروف.',
            show_alert: true,
          });
        }
        res.status(200).send('ok');
        return;
      }

      // د) تحديد الحالة الجديدة newStatus بناءً على نوع الإجراء
      const statusMap: Record<string, string> = {
        confirm: 'confirmed',
        reject: 'rejected',
        rent: 'rented',
        complete: 'completed',
      };
      const newStatus = statusMap[actionType];

      // هـ) استدعاء applyBookingStatusChange
      const actorLabel = callbackQuery.from?.first_name || 'موظف عبر تيليجرام';
      const changeResult = await applyBookingStatusChange(bookingId, newStatus, actorLabel, {
        actorUid: null,
        actorEmail: null,
        actorType: 'staff',
        telegramUserId: callbackQuery.from?.id ?? null,
        telegramName: callbackQuery.from?.first_name ?? null,
      });

      // و) عند فشل العملية
      if (!changeResult.success) {
        console.warn('[telegramWebhook] applyBookingStatusChange failed:', {
          bookingId,
          newStatus,
          message: changeResult.message,
        });

        if (callbackQueryId) {
          await answerCallbackQuery(botToken, callbackQueryId, {
            text: changeResult.message || 'تعذر تنفيذ الإجراء.',
            show_alert: true,
          });
        }

        res.status(200).send('ok');
        return;
      }

      // ز) عند نجاح العملية
      // تحديد مجموعة الأزرار الجديدة
      let newButtons: Array<Array<{ text: string; callback_data: string }>> = [];
      let successAnswerText = 'تم تنفيذ الإجراء بنجاح ✅';
      let actionDescription = 'تحديث حالة الحجز';

      if (newStatus === 'confirmed') {
        newButtons = [
          [{ text: '🚗 تسليم السيارة (استلام)', callback_data: `bk_rent_${bookingId}` }],
        ];
        successAnswerText = 'تم تأكيد الحجز ✅';
        actionDescription = 'تم تأكيد الحجز';
      } else if (newStatus === 'rented') {
        newButtons = [
          [{ text: '↩️ إرجاع السيارة (إنهاء)', callback_data: `bk_complete_${bookingId}` }],
        ];
        successAnswerText = 'تم تسليم السيارة وبدء التأجير 🚗';
        actionDescription = 'تم تسليم السيارة وبدء التأجير';
      } else if (newStatus === 'completed') {
        newButtons = [];
        successAnswerText = 'تم إنهاء الحجز وإرجاع السيارة ↩️';
        actionDescription = 'تم إنهاء الحجز وإرجاع السيارة للأسطول';
      } else if (newStatus === 'rejected') {
        newButtons = [];
        successAnswerText = 'تم رفض الحجز ❌';
        actionDescription = 'تم رفض طلب الحجز';
      }

      // 1. استدعاء answerCallbackQuery بنص قصير
      if (callbackQueryId) {
        await answerCallbackQuery(botToken, callbackQueryId, {
          text: successAnswerText,
          show_alert: false,
        });
      }

      // 2. تحديث نص الرسالة الأصلية عبر editMessageText
      const originalMessage = callbackQuery.message;
      if (originalMessage && originalMessage.chat && originalMessage.message_id) {
        const chatId = originalMessage.chat.id;
        const messageId = originalMessage.message_id;
        const currentText = originalMessage.text || '';

        const nowFormatted = new Date().toLocaleString('ar-EG', {
          timeZone: 'Asia/Amman',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        const statusNotice = `\n\n━━━━━━━━━━━━━━━━━━━━\n✅ *${actionDescription}* بواسطة *${actorLabel}*\n🕒 ${nowFormatted}`;
        const updatedText = `${currentText}${statusNotice}`;

        await editMessageText(botToken, {
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: newButtons,
          },
        });
      }

      res.status(200).send('ok');
    } catch (err: any) {
      console.error('[telegramWebhook] Unexpected error caught in webhook handler:', {
        message: err?.message,
        stack: err?.stack,
      });
      // ح) إرجاع 200 دائماً لتفادي إعادة إرسال تيليجرام المتكررة عند أي استثناء
      res.status(200).send('ok');
    }
  }
);

/**
 * دالة مساعدة لاستدعاء answerCallbackQuery
 */
async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  options: { text: string; show_alert: boolean }
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: options.text,
        show_alert: options.show_alert,
      }),
    });
  } catch (err) {
    console.warn('[telegramWebhook] Failed to call answerCallbackQuery:', err);
  }
}

/**
 * دالة مساعدة لاستدعاء editMessageText
 */
async function editMessageText(
  botToken: string,
  payload: {
    chat_id: number | string;
    message_id: number;
    text: string;
    parse_mode?: string;
    reply_markup?: {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
  }
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[telegramWebhook] Failed to editMessageText:', res.status, errText);
    }
  } catch (err) {
    console.warn('[telegramWebhook] Exception while calling editMessageText:', err);
  }
}
