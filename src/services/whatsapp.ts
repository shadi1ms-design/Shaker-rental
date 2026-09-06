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
 * Opens WhatsApp chat directly with prefilled message
 */
export function openWhatsAppChat(booking?: Booking, customMessage?: string) {
  const message = customMessage || (booking ? generateWhatsAppBookingMessage(booking) : 'مرحباً شركة شاكر لتأجير السيارات، أود الاستفسار عن حجز سيارة.');
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
