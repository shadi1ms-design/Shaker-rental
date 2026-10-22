import { Booking } from '../types';

/**
 * Legacy remaining balance helper (always 0 now that payments are removed).
 */
export function getRemaining(): number {
  return 0;
}

/**
 * Returns true if the booking is active and financially valid (not cancelled or rejected).
 */
export function isFinanciallyActiveBooking(booking: Booking): boolean {
  return booking.status !== 'cancelled' && booking.status !== 'rejected';
}

/**
 * فصل التأمين المسترد عن الإيراد التشغيلي:
 * - لا يتم المساس بقيمة totalPrice المخزنة في سجل الحجز في Firestore.
 * - الإيراد التشغيلي = totalPrice - insuranceAmount للحجوزات المحتسبة (الفعالة أو المكتملة).
 * - التأمين المسترد (insuranceAmount) أمانة مستردة تُعاد للعميل عند إعادة السيارة بحالتها، وتُعرض منفصلة تماماً عن إيراد الشركة.
 */
export function calculateBookingFinancials(bookings: Booking[]): {
  totalRevenue: number;
  totalInsurance: number;
  grossTotal: number;
  completedRevenue: number;
  completedInsurance: number;
  totalValidBookings: number;
  completedBookingsCount: number;
  // Legacy aliases for non-breaking UI support
  collectedRevenue: number;
  outstandingBalance: number;
} {
  return bookings.reduce(
    (acc, b) => {
      if (!isFinanciallyActiveBooking(b)) {
        return acc;
      }
      const totalPrice = Number(b.totalPrice || 0);
      const insurance = Number(b.insuranceAmount || 0);
      // الإيراد = totalPrice - insuranceAmount
      const netRevenue = Math.max(0, totalPrice - insurance);

      acc.totalRevenue += netRevenue;
      acc.totalInsurance += insurance;
      acc.grossTotal += totalPrice;
      acc.totalValidBookings += 1;

      if (b.status === 'completed') {
        acc.completedRevenue += netRevenue;
        acc.completedInsurance += insurance;
        acc.completedBookingsCount += 1;
      }

      // Maintain legacy aliases mapped to completed net revenue
      acc.collectedRevenue = acc.completedRevenue;
      acc.outstandingBalance = 0;

      return acc;
    },
    {
      totalRevenue: 0,
      totalInsurance: 0,
      grossTotal: 0,
      completedRevenue: 0,
      completedInsurance: 0,
      totalValidBookings: 0,
      completedBookingsCount: 0,
      collectedRevenue: 0,
      outstandingBalance: 0,
    }
  );
}
