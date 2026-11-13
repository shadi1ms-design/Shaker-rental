import { useState, useEffect, useMemo } from 'react';
import { Booking } from '../types';
import { dataService } from '../services/dataService';
import { functionsService } from '../services/functionsService';

export interface UseCustomerBookingsParams {
  isOpen: boolean;
  enabled: boolean;
  user: {
    uid: string;
    email?: string;
    phone?: string;
    displayName?: string;
  } | null;
  bookings: Booking[];
}

export function useCustomerBookings({
  isOpen,
  enabled,
  user,
  bookings,
}: UseCustomerBookingsParams) {
  const [directCustomerBookings, setDirectCustomerBookings] = useState<Booking[] | null>(null);
  const [bookingsTimedOut, setBookingsTimedOut] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [isRetryingBookings, setIsRetryingBookings] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Real-time subscription to customer bookings (only when enabled: customer role only)
  useEffect(() => {
    if (!isOpen || !enabled || !user?.uid) return;
    const unsubscribe = dataService.subscribeToCustomerBookings(user.uid, (customerBookings) => {
      setDirectCustomerBookings(customerBookings);
    });
    return () => {
      unsubscribe();
      setDirectCustomerBookings(null);
    };
  }, [isOpen, enabled, user?.uid]);

  // Stop showing the loading skeleton if the bookings never arrive (only when enabled)
  useEffect(() => {
    if (!isOpen || !enabled || !user?.uid) return;
    const t = setTimeout(() => setBookingsTimedOut(true), 4000);
    return () => {
      clearTimeout(t);
      setBookingsTimedOut(false);
    };
  }, [isOpen, enabled, user?.uid]);

  const handleRetryBookings = async () => {
    if (!user?.uid) return;
    setIsRetryingBookings(true);
    setBookingsError(null);
    try {
      const customerBookings = await dataService.getBookingsForCustomer(user.uid);
      setDirectCustomerBookings(customerBookings);
    } catch (err: unknown) {
      setBookingsError(
        err instanceof Error ? err.message : 'تعذر تحميل قائمة الحجوزات، يرجى التحقق من الاتصال والمحاولة ثانية.'
      );
    } finally {
      setIsRetryingBookings(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setCancelError(null);
    const res = await functionsService.updateBookingStatusSecure({
      bookingId: cancelTarget.id,
      bookingNumber: cancelTarget.bookingNumber,
      status: 'cancelled',
    });
    setIsCancelling(false);
    if (res.success) {
      setCancelTarget(null);
    } else {
      setCancelTarget(null);
      setCancelError(res.error || 'تعذر إلغاء الحجز. يرجى التواصل مع الإدارة.');
    }
  };

  const userBookings = useMemo(() => {
    if (!user || !enabled) return [];
    const sourceBookings = directCustomerBookings ?? bookings;
    return sourceBookings.filter((b) => {
      if (user.uid && b.customerId === user.uid) return true;
      if (user.email && b.customerEmail && b.customerEmail.toLowerCase() === user.email.toLowerCase()) return true;
      if (
        user.phone &&
        b.customerPhone &&
        user.phone.replace(/\D/g, '') &&
        b.customerPhone.replace(/\D/g, '').includes(user.phone.replace(/\D/g, ''))
      ) {
        return true;
      }
      if (
        b.customerName &&
        user.displayName &&
        b.customerName.trim().toLowerCase() === user.displayName.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
  }, [directCustomerBookings, bookings, user, enabled]);

  // Active bookings first, then finished ones; newest pickup first inside each group
  const sortedBookings = useMemo(() => {
    const ACTIVE = ['new', 'reviewing', 'confirmed', 'rented'];
    const rank = (b: Booking) => (ACTIVE.includes(String(b.status)) ? 0 : 1);
    return [...userBookings].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return String(b.pickupDate || '').localeCompare(String(a.pickupDate || ''));
    });
  }, [userBookings]);

  return {
    directCustomerBookings,
    bookingsTimedOut,
    bookingsError,
    isRetryingBookings,
    cancelTarget,
    setCancelTarget,
    isCancelling,
    cancelError,
    setCancelError,
    handleRetryBookings,
    handleConfirmCancel,
    userBookings,
    sortedBookings,
  };
}
