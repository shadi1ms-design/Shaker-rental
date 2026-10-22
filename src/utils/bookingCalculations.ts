import { Booking } from '../types';

/**
 * Legacy remaining balance helper (always 0 now that payments are removed).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getRemaining(..._args: any[]): number {
  return 0;
}

/**
 * Returns true if the booking is active and financially valid (not cancelled or rejected).
 */
export function isFinanciallyActiveBooking(booking: Booking): boolean {
  return booking.status !== 'cancelled' && booking.status !== 'rejected';
}

/**
 * Calculates revenue and booking metrics according to actual completed and active contracts.
 * Total revenue for reports is based on completed bookings (and active rentals).
 */
export function calculateBookingFinancials(bookings: Booking[]): {
  totalRevenue: number;
  completedRevenue: number;
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
      const price = Number(b.totalPrice || 0);
      acc.totalRevenue += price;
      acc.totalValidBookings += 1;

      if (b.status === 'completed') {
        acc.completedRevenue += price;
        acc.completedBookingsCount += 1;
      }

      // Maintain legacy aliases mapped to completed revenue
      acc.collectedRevenue = acc.completedRevenue;
      acc.outstandingBalance = 0;

      return acc;
    },
    {
      totalRevenue: 0,
      completedRevenue: 0,
      totalValidBookings: 0,
      completedBookingsCount: 0,
      collectedRevenue: 0,
      outstandingBalance: 0,
    }
  );
}
