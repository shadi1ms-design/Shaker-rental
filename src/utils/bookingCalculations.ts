import { Booking } from '../types';

/**
 * Calculates remaining balance accurately.
 * remainingAmount ?? (totalPrice - paidAmount)
 */
export function getRemaining(booking: {
  totalPrice?: number;
  paidAmount?: number;
  remainingAmount?: number;
}): number {
  if (typeof booking.remainingAmount === 'number' && !isNaN(booking.remainingAmount)) {
    return Math.max(0, booking.remainingAmount);
  }
  const total = booking.totalPrice || 0;
  const paid = booking.paidAmount || 0;
  return Math.max(0, total - paid);
}

/**
 * Returns true if the booking is active and financially valid (not cancelled or rejected).
 */
export function isFinanciallyActiveBooking(booking: Booking): boolean {
  return booking.status !== 'cancelled' && booking.status !== 'rejected';
}

/**
 * Calculates revenue and balances for a set of bookings according to financial standards.
 * Excludes cancelled and rejected bookings from collected revenue and outstanding balance.
 */
export function calculateBookingFinancials(bookings: Booking[]): {
  collectedRevenue: number;
  outstandingBalance: number;
  totalValidBookings: number;
} {
  return bookings.reduce(
    (acc, b) => {
      if (!isFinanciallyActiveBooking(b)) {
        return acc;
      }
      acc.collectedRevenue += b.paidAmount || 0;
      acc.outstandingBalance += getRemaining(b);
      acc.totalValidBookings += 1;
      return acc;
    },
    { collectedRevenue: 0, outstandingBalance: 0, totalValidBookings: 0 }
  );
}
