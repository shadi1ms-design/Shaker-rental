import { Booking } from '../types';

export const OFFICIAL_WHATSAPP_NUMBER = '963944331774'; // Format for wa.me API

/**
 * Builds a professional Arabic WhatsApp booking message
 */
export function generateWhatsAppBookingMessage(booking: Booking): string {
  return `مرحباً شركة شاكر لتأجير السيارات،
أود تأكيد تفاصيل طلبي للحجز عبر الموقع الإلكتروني:

🔹 رقم الحجز: *${booking.bookingNumber}*
👤 اسم المستأجر: *${booking.customerName}*
📱 رقم الهاتف: ${booking.customerPhone}
🚗 السيارة المطلوبة: *${booking.vehicleName}*
📅 تاريخ الاستلام: ${booking.pickupDate} (${booking.pickupTime})
📅 تاريخ الإعادة: ${booking.returnDate} (${booking.returnTime})
⏳ مدة التأجير: ${booking.rentalDays} يوم
💰 المبلغ الإجمالي: *${booking.totalPrice}$* (يشمل التأمين: ${booking.insuranceAmount}$)
${booking.notes ? `📝 ملاحظات خاصة: ${booking.notes}\n` : ''}
يرجى تأكيد توفر السيارة والموافقة على الحجز. شكراً جزيلاً!`;
}

/**
 * Opens WhatsApp chat directly with prefilled message (Customer to Company)
 */
export function openWhatsAppChat(booking?: Booking, customMessage?: string) {
  const message = customMessage || (booking ? generateWhatsAppBookingMessage(booking) : 'مرحباً شركة شاكر لتأجير السيارات، أود الاستفسار عن حجز سيارة.');
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Normalizes customer phone number for WhatsApp international URL format (wa.me)
 */
export function normalizeCustomerPhoneForWhatsApp(phone: string): string {
  let cleaned = (phone || '').replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  // Remove leading '00' international prefix (e.g. 00963 -> 963)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Syrian local mobile starting with 09 (10 digits, e.g. 0944331774 -> 963944331774)
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '963' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') && cleaned.length === 9) {
    // Missing country code (9 digits, e.g. 944331774 -> 963944331774)
    cleaned = '963' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Local Syrian number with leading zero -> replace 0 with 963
    cleaned = '963' + cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Builds a professional Arabic WhatsApp message from Admin to Customer
 */
export function generateAdminToCustomerMessage(booking: Booking): string {
  return `مرحباً ${booking.customerName}،
معكم شركة شاكر لتأجير السيارات بخصوص حجزكم رقم *${booking.bookingNumber}*.

🚗 السيارة: ${booking.vehicleName}
📅 تاريخ الاستلام: ${booking.pickupDate} (${booking.pickupTime})
📅 تاريخ الإعادة: ${booking.returnDate} (${booking.returnTime})
💰 المبلغ الإجمالي: ${booking.totalPrice}$

يسعدنا خدمتكم، لا تترددوا بالتواصل معنا لأي استفسار.`;
}

/**
 * Opens WhatsApp chat directly to the customer's phone number with prefilled message
 */
export function openWhatsAppChatWithCustomer(booking: Booking) {
  const rawPhone = booking.customerPhone || booking.customerWhatsApp || '';
  const cleanPhone = normalizeCustomerPhoneForWhatsApp(rawPhone);
  if (!cleanPhone) {
    alert('عذراً، رقم هاتف العميل غير متوفر بهذا الحجز.');
    return;
  }
  const message = generateAdminToCustomerMessage(booking);
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

