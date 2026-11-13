import { Booking } from '../types';
import { COMPANY_INFO } from '../constants/company';
import { normalizeDigits } from '../utils/phone';
import { formatDateDisplay } from '../utils/dateUtils';

/** Fallback only. The live number comes from admin settings via setOfficialWhatsAppNumber(). */
export const OFFICIAL_WHATSAPP_NUMBER = COMPANY_INFO.phoneRaw; // Format for wa.me API

let activeWhatsAppNumber: string = OFFICIAL_WHATSAPP_NUMBER;

/**
 * Applies the WhatsApp number saved in admin settings (AdminSettings -> whatsappNumber).
 * Previously every customer-facing button used the hard-coded number, so changing it in
 * settings had no effect. Empty / invalid values keep the current number.
 */
export function setOfficialWhatsAppNumber(raw?: string | null): void {
  const normalized = normalizeCustomerPhoneForWhatsApp(raw || '');
  if (normalized.length >= 9 && normalized.length <= 15) {
    activeWhatsAppNumber = normalized;
  }
}

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
📅 تاريخ الاستلام: ${formatDateDisplay(booking.pickupDate)} (${booking.pickupTime})
📅 تاريخ الإعادة: ${formatDateDisplay(booking.returnDate)} (${booking.returnTime})
⏳ مدة التأجير: ${booking.rentalDays} يوم
💰 المبلغ الإجمالي: *${booking.totalPrice}$* (يشمل التأمين: ${booking.insuranceAmount}$)
${booking.notes ? `📝 ملاحظات خاصة: ${booking.notes}\n` : ''}
يرجى تأكيد توفر السيارة والموافقة على الحجز. شكراً جزيلاً!`;
}

/**
 * Builds the official company WhatsApp chat URL with prefilled message
 */
export function getOfficialWhatsAppUrl(customMessage?: string, booking?: Booking): string {
  const message =
    customMessage ||
    (booking
      ? generateWhatsAppBookingMessage(booking)
      : 'مرحباً شركة شاكر لتأجير السيارات، أود الاستفسار عن حجز سيارة.');
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${activeWhatsAppNumber}?text=${encodedText}`;
}

/**
 * Opens WhatsApp chat directly with prefilled message (Customer to Company)
 */
export function openWhatsAppChat(booking?: Booking, customMessage?: string) {
  const url = getOfficialWhatsAppUrl(customMessage, booking);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Normalizes customer phone number for WhatsApp international URL format (wa.me)
 * Converts E.164 (+{code}{number}) to digits-only without + and spaces.
 */
export function normalizeCustomerPhoneForWhatsApp(phone: string): string {
  const asciiDigits = normalizeDigits(phone || '');
  let cleaned = asciiDigits.replace(/[^0-9]/g, '');
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
📅 تاريخ الاستلام: ${formatDateDisplay(booking.pickupDate)} (${booking.pickupTime})
📅 تاريخ الإعادة: ${formatDateDisplay(booking.returnDate)} (${booking.returnTime})
💰 المبلغ الإجمالي: ${booking.totalPrice}$

يسعدنا خدمتكم، لا تترددوا بالتواصل معنا لأي استفسار.`;
}

/**
 * Builds a direct WhatsApp URL to a customer's phone number with custom message
 */
export function getWhatsAppChatUrl(rawPhone: string, customMessage?: string): string {
  const cleanPhone = normalizeCustomerPhoneForWhatsApp(rawPhone || '') || activeWhatsAppNumber;
  const encodedText = encodeURIComponent(customMessage || '');
  return `https://wa.me/${cleanPhone}${encodedText ? `?text=${encodedText}` : ''}`;
}

/**
 * Opens WhatsApp chat directly to the customer's phone number with prefilled message
 */
export function openWhatsAppChatWithCustomer(booking: Booking): boolean {
  const rawPhone = booking.customerPhone || booking.customerWhatsApp || '';
  const cleanPhone = normalizeCustomerPhoneForWhatsApp(rawPhone);
  if (!cleanPhone) {
    return false;
  }
  const message = generateAdminToCustomerMessage(booking);
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

