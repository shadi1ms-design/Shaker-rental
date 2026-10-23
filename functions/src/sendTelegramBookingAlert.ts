/**
 * FIRESTORE TRIGGER: sendTelegramBookingAlert
 * 
 * Requirement 4:
 * - Region: asia-south1 (Unified with Firestore & Cloud Functions)
 * - Idempotency via telegramAlertSentAt
 * - Ignore staff-created bookings
 * - Mask customer phone number for privacy
 * - HTML parse mode & escaping
 */

import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff } from './authz';

const db = getFirestore(getApp(), DATABASE_ID);

function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Masks phone numbers to protect customer privacy in shared Telegram channels.
 * e.g., "0944331774" -> "0944***774"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return 'غير متوفر';
  const clean = String(phone).trim();
  if (clean.length <= 6) return clean;
  const start = clean.slice(0, 4);
  const end = clean.slice(-3);
  return `${start}***${end}`;
}

export const sendTelegramBookingAlert = onDocumentCreated(
  {
    document: 'bookings/{bookingId}',
    database: DATABASE_ID,
    region: FUNCTION_REGION,
    secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (event) => {
    try {
      if (!event.data) return;
      const bookingData = event.data.data();
      if (!bookingData || bookingData.isDeleted === true) return;

      const bookingRef = event.data.ref;

      // 1. Idempotency Check: telegramAlertSentAt (Requirement 4)
      if (bookingData.telegramAlertSentAt) {
        return;
      }

      // 2. Ignore staff-created / internal bookings (Requirement 4)
      if (bookingData.isStaffBooking === true) {
        return;
      }

      const customerId = bookingData.customerId;
      if (customerId) {
        try {
          const userRecord = await getAuth().getUser(customerId).catch(() => null);
          if (userRecord && isCallerStaff(userRecord.customClaims)) {
            // Skip alerting for staff internal tests/bookings
            return;
          }
        } catch {}
      }

      const bookingId = event.params.bookingId || event.data.id || bookingData.id || '';
      const bookingNumber = bookingData.bookingNumber || bookingId;

      // Authoritative vehicle name
      let vehicleName = (bookingData.vehicleName || 'مركبة') as string;
      const vehicleId = bookingData.vehicleId;
      if (vehicleId) {
        try {
          const vSnap = await db.collection('vehicles').doc(vehicleId).get();
          if (vSnap.exists) {
            const vData = vSnap.data();
            if (vData) {
              const brand = vData.brand ? String(vData.brand).trim() : '';
              const model = vData.model ? String(vData.model).trim() : '';
              const year = vData.year ? `(${vData.year})` : '';
              const fullName = [brand, model, year].filter(Boolean).join(' ');
              if (fullName) vehicleName = fullName;
            }
          }
        } catch {}
      }

      const customerName = (bookingData.customerName || 'مستأجر') as string;
      const rawPhone = bookingData.customerPhone || bookingData.customerWhatsApp || '';
      const maskedPhone = maskPhoneNumber(rawPhone);

      const pickupDate = bookingData.pickupDate || bookingData.startDate || '';
      const returnDate = bookingData.returnDate || bookingData.endDate || '';
      const totalPrice = bookingData.totalPrice !== undefined ? `${bookingData.totalPrice}` : '0';
      const status = bookingData.status || 'new';

      // .trim(): a secret saved with a trailing newline would break the Bot API URL / chat id.
      const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
      const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();

      if (!botToken || !chatId) {
        console.warn('[sendTelegramBookingAlert] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.');
        return;
      }

      // HTML message content
      const messageLines: string[] = [
        '🚗 <b>طلب حجز جديد</b>',
        '━━━━━━━━━━━━━━━━━━━━',
        `📋 <b>رقم الحجز:</b> <code>${escapeHtml(bookingNumber)}</code>`,
        `👤 <b>العميل:</b> ${escapeHtml(customerName)}`,
        `📞 <b>الهاتف:</b> <code>${escapeHtml(maskedPhone)}</code>`,
        `🚘 <b>السيارة:</b> ${escapeHtml(vehicleName)}`,
      ];

      if (pickupDate) {
        messageLines.push(`📅 <b>تاريخ الاستلام:</b> ${escapeHtml(pickupDate)}`);
      }
      if (returnDate) {
        messageLines.push(`📅 <b>تاريخ التسليم:</b> ${escapeHtml(returnDate)}`);
      }

      messageLines.push(`💰 <b>المبلغ الإجمالي:</b> ${escapeHtml(totalPrice)}$`);
      messageLines.push(`📊 <b>الحالة:</b> ${escapeHtml(status)}`);

      const messageText = messageLines.join('\n');
      const telegramEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(telegramEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ تأكيد', callback_data: `bk_confirm_${bookingId}` },
                  { text: '❌ رفض', callback_data: `bk_reject_${bookingId}` },
                ],
              ],
            },
          }),
        });

        if (response.ok) {
          // Set telegramAlertSentAt strictly after successful delivery
          await bookingRef.update({
            telegramAlertSentAt: FieldValue.serverTimestamp(),
          });
        } else {
          const errorBody = await response.text().catch(() => '');
          console.error('[sendTelegramBookingAlert] Telegram API error:', response.status, errorBody);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      console.error('[sendTelegramBookingAlert] Error sending Telegram alert:', err);
    }
  }
);
