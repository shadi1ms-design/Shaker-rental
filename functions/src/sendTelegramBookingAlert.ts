/**
 * FIRESTORE TRIGGER: sendTelegramBookingAlert
 * 
 * يستمع هذا المعالج لحدث إنشاء أي حجز جديد في مجموعة bookings ويرسل تنبيهاً فورياً عبر Telegram Bot API.
 * 
 * ملاحظة هامة حول الأسرار وبيئة التشغيل:
 * يتم ضبط مفتاح البوت (TELEGRAM_BOT_TOKEN) ومعرّف المحادثة (TELEGRAM_CHAT_ID) لاحقاً من خارج الكود
 * عبر أوامر إدارة الأسرار في Firebase / Google Cloud Secret Manager:
 *   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
 *   firebase functions:secrets:set TELEGRAM_CHAT_ID
 * ويتم تمريرهما في وقت التشغيل بصورة آمنة وتلقائية إلى process.env.
 */

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

const FUNCTION_REGION = 'us-east1';
const DATABASE_ID = 'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1';

// تأكيد تهيئة Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore(admin.app(), DATABASE_ID);

/**
 * دالة مساعدة لتنظيف نصوص الماركداون لتفادي كسر تنسيق تيليجرام
 */
function cleanMarkdown(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[*_`\[\]]/g, '');
}

/**
 * Cloud Function: sendTelegramBookingAlert
 * Triggered on: bookings/{bookingId} (Firestore v2 onDocumentCreated)
 */
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
      // 1. قراءة بيانات الحجز الموثوقة من event.data مباشرة
      if (!event.data) {
        return;
      }

      const bookingData = event.data.data();

      // 2. تجاهل الحدث فوراً إذا لم توجد بيانات أو إذا كان الحجز محذوفاً منطقياً
      if (!bookingData || bookingData.isDeleted === true) {
        return;
      }

      const bookingId = event.params.bookingId || event.data.id || bookingData.id || 'غير متوفر';
      const bookingNumber = bookingData.bookingNumber || bookingId;

      // 3. جلب اسم السيارة الحقيقي من مجموعة vehicles مع رجوع آمن (fallback)
      let vehicleName = (bookingData.vehicleName || 'غير محدد') as string;
      const vehicleId = bookingData.vehicleId;
      if (vehicleId && typeof vehicleId === 'string') {
        try {
          const vehicleSnap = await db.collection('vehicles').doc(vehicleId).get();
          if (vehicleSnap.exists) {
            const vData = vehicleSnap.data();
            if (vData) {
              const brand = vData.brand ? String(vData.brand).trim() : '';
              const model = vData.model ? String(vData.model).trim() : '';
              const year = vData.year ? `(${vData.year})` : '';
              const fullName = [brand, model, year].filter(Boolean).join(' ');
              if (fullName) {
                vehicleName = fullName;
              } else if (vData.name) {
                vehicleName = String(vData.name);
              }
            }
          }
        } catch (vehErr) {
          console.warn('[sendTelegramBookingAlert] تعذر جلب بيانات السيارة، الاعتماد على اسم الحجز:', vehErr);
        }
      }

      // 4 & 5. جلب اسم ورقم هاتف العميل الحقيقيين من مجموعة users مع رجوع آمن
      let customerName = (bookingData.customerName || 'غير محدد') as string;
      let customerPhone = (bookingData.customerPhone || bookingData.customerWhatsApp || 'غير متوفر') as string;
      const customerId = bookingData.customerId;

      if (customerId && typeof customerId === 'string') {
        try {
          const userSnap = await db.collection('users').doc(customerId).get();
          if (userSnap.exists) {
            const uData = userSnap.data();
            if (uData) {
              const uName = uData.displayName || uData.name || uData.fullName;
              if (uName && typeof uName === 'string' && uName.trim()) {
                customerName = uName.trim();
              }
              const uPhone = uData.phoneNumber || uData.phone || uData.mobile;
              if (uPhone && typeof uPhone === 'string' && uPhone.trim()) {
                customerPhone = uPhone.trim();
              }
            }
          }
        } catch (userErr) {
          console.warn('[sendTelegramBookingAlert] تعذر جلب بيانات المستخدم، الاعتماد على بيانات الحجز:', userErr);
        }
      }

      // تواريخ الحجز
      const pickupDate = bookingData.pickupDate || bookingData.startDate || '';
      const returnDate = bookingData.returnDate || bookingData.endDate || '';
      const totalPrice = bookingData.totalPrice !== undefined ? `${bookingData.totalPrice}` : '0';
      const status = bookingData.status || 'new';

      // 6. بناء نص رسالة الماركداون الخاصة بتيليجرام
      const messageLines: string[] = [
        '🚗 *حجز جديد في النظام*',
        '━━━━━━━━━━━━━━━━━━━━',
        `📋 *رقم الحجز:* \`${cleanMarkdown(bookingNumber)}\``,
        `👤 *العميل:* ${cleanMarkdown(customerName)}`,
        `📞 *الهاتف:* ${cleanMarkdown(customerPhone)}`,
        `🚘 *السيارة:* ${cleanMarkdown(vehicleName)}`,
      ];

      if (pickupDate) {
        messageLines.push(`📅 *تاريخ الاستلام:* ${cleanMarkdown(pickupDate)}`);
      }
      if (returnDate) {
        messageLines.push(`📅 *تاريخ التسليم:* ${cleanMarkdown(returnDate)}`);
      }

      messageLines.push(`💰 *المبلغ الإجمالي:* ${cleanMarkdown(totalPrice)}$`);
      messageLines.push(`📊 *الحالة:* ${cleanMarkdown(status)}`);

      const messageText = messageLines.join('\n');

      // 7. التحقق من توفر التوكن والـ Chat ID من Secret Manager / process.env
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        console.error(
          '[sendTelegramBookingAlert] المتغيرات السرية TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير معرفة في بيئة التشغيل / Cloud Secret Manager. تم إيقاف إرسال الرسالة.'
        );
        return;
      }

      // 8. إرسال الطلب عبر Telegram Bot API باستخدام fetch المدمجة
      const telegramEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ تأكيد', callback_data: `bk_confirm_${bookingId}` },
              { text: '❌ رفض', callback_data: `bk_reject_${bookingId}` },
            ]],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'تعذر قراءة نص الاستجابة');
        console.error('[sendTelegramBookingAlert] استجابت Telegram Bot API بخطأ أثناء إرسال الإشعار:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: errorBody,
          bookingId,
        });
      } else {
        console.log('[sendTelegramBookingAlert] تم إرسال إشعار تيليجرام بنجاح للحجز رقم:', bookingNumber);
      }
    } catch (err: any) {
      // تسجيل أي استثناء غير متوقع دون رميه لتفادي تعطيل Trigger الحجز الأساسي
      console.error('[sendTelegramBookingAlert] حدث خطأ أثناء تنفيذ معالج إشعارات تيليجرام:', {
        message: err?.message,
        stack: err?.stack,
      });
    }
  }
);
