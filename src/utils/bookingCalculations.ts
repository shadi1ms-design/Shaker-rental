import { Booking } from '../types';

/**
 * Legacy remaining balance helper (always 0 now that payments are removed).
 */
export function getRemaining(): number {
  return 0;
}

/**
 * Returns true if the booking is active and financially valid:
 * only non-deleted 'confirmed', 'rented', and 'completed' bookings.
 * Unconfirmed holds ('new', 'reviewing') and terminal states ('cancelled', 'rejected') are excluded.
 */
export function isFinanciallyActiveBooking(booking: Booking): boolean {
  if (booking.isDeleted === true) return false;
  return (
    booking.status === 'confirmed' ||
    booking.status === 'rented' ||
    booking.status === 'completed'
  );
}

/**
 * Calculates financial metrics for bookings:
 * - Net revenue = (finalTotal ?? (totalPrice + extraCharges)) - insuranceAmount
 * - Separates refundable insurance from operational revenue
 * - Exposes pending review metrics for 'new' and 'reviewing' holds
 */
export function calculateBookingFinancials(bookings: Booking[]): {
  totalRevenue: number;
  totalInsurance: number;
  grossTotal: number;
  completedRevenue: number;
  completedInsurance: number;
  totalValidBookings: number;
  completedBookingsCount: number;
  pendingReviewBookingsCount: number;
  pendingReviewGrossTotal: number;
  // Legacy aliases for non-breaking UI support
  collectedRevenue: number;
  outstandingBalance: number;
} {
  return bookings.reduce(
    (acc, b) => {
      if (b.isDeleted === true) return acc;

      // Pending review metrics for unconfirmed requests
      if (b.status === 'new' || b.status === 'reviewing') {
        acc.pendingReviewBookingsCount += 1;
        acc.pendingReviewGrossTotal += Number(b.totalPrice || 0);
        return acc;
      }

      if (!isFinanciallyActiveBooking(b)) {
        return acc;
      }

      const effectiveTotal =
        typeof b.finalTotal === 'number'
          ? b.finalTotal
          : Number(b.totalPrice || 0) + Number(b.extraCharges || 0);
      const insurance = Number(b.insuranceAmount || 0);
      const netRevenue = Math.max(0, effectiveTotal - insurance);

      acc.totalRevenue += netRevenue;
      acc.totalInsurance += insurance;
      acc.grossTotal += effectiveTotal;
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
      pendingReviewBookingsCount: 0,
      pendingReviewGrossTotal: 0,
      collectedRevenue: 0,
      outstandingBalance: 0,
    }
  );
}
