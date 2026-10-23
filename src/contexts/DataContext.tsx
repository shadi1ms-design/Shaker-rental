import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { dataService } from '../services/dataService';
import { setOfficialWhatsAppNumber } from '../services/whatsapp';
import type { AppSettings, Booking, SearchFilters, Vehicle } from '../types';

interface DataContextType {
  vehicles: Vehicle[];
  bookings: Booking[];
  settings: AppSettings;
  /** True once the first fetch finished (or the cache already had vehicles). */
  vehiclesReady: boolean;
  refreshData: () => Promise<void>;

  /** Search filters carried from the hero search to the catalog / booking pages. */
  activeBookingFilters: SearchFilters | undefined;
  setActiveBookingFilters: (filters: SearchFilters | undefined) => void;

  /** The booking the customer just created (shown as a banner until staff process it). */
  lastCreatedBooking: Booking | null;
  handleBookingCreated: (booking: Booking) => void;
  dismissLastBooking: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const recentBookingKey = (uid: string) => `shaker_recent_booking_${uid}`;

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isEmployee } = useAuth();
  const userId = user?.uid;
  const isStaffAuthorized = isAdmin || isEmployee;

  // Core data - immediate cache bootstrap for 0ms initial render
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => dataService.getCachedVehicles());
  const [bookings, setBookings] = useState<Booking[]>(() => dataService.getCachedBookings());
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getCachedSettings());
  const [vehiclesReady, setVehiclesReady] = useState<boolean>(() => dataService.getCachedVehicles().length > 0);

  const [activeBookingFilters, setActiveBookingFilters] = useState<SearchFilters | undefined>(undefined);
  const [lastCreatedBooking, setLastCreatedBooking] = useState<Booking | null>(null);

  // Keep every customer-facing WhatsApp link in sync with the number saved in admin settings.
  useEffect(() => {
    setOfficialWhatsAppNumber(settings?.whatsappNumber);
  }, [settings?.whatsappNumber]);

  const refreshData = useCallback(async () => {
    try {
      const [vList, sSettings] = await Promise.all([dataService.getVehicles(), dataService.getSettings()]);
      setVehicles(vList);
      setSettings(sSettings);

      if (isStaffAuthorized) {
        setBookings(await dataService.getBookings(true));
      } else if (userId) {
        setBookings(await dataService.getBookingsForCustomer(userId));
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setVehiclesReady(true);
    }
  }, [userId, isStaffAuthorized]);

  // Initial fetch + real-time listeners
  useEffect(() => {
    refreshData();

    const unsubscribeVehicles = dataService.subscribeToVehicles(setVehicles);

    let unsubscribeBookings = () => {};
    if (isStaffAuthorized) {
      unsubscribeBookings = dataService.subscribeToBookings(setBookings);
    } else if (userId) {
      unsubscribeBookings = dataService.subscribeToCustomerBookings(userId, setBookings);
    }

    return () => {
      unsubscribeVehicles();
      unsubscribeBookings();
    };
  }, [userId, isStaffAuthorized, refreshData]);

  // Restore persisted recent booking on auth load
  useEffect(() => {
    if (!userId) {
      setLastCreatedBooking(null);
      return;
    }
    try {
      const saved = localStorage.getItem(recentBookingKey(userId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setLastCreatedBooking((prev) => prev || (parsed as Booking));
        }
      }
    } catch {}
  }, [userId]);

  // Dismiss the banner once staff change the status away from 'new' / 'reviewing'
  useEffect(() => {
    if (!lastCreatedBooking || !userId) return;
    const found = bookings.find(
      (b) => b.id === lastCreatedBooking.id || b.bookingNumber === lastCreatedBooking.bookingNumber,
    );
    if (found && found.status !== 'new' && found.status !== 'reviewing') {
      setLastCreatedBooking(null);
      try {
        localStorage.removeItem(recentBookingKey(userId));
      } catch {}
    }
  }, [bookings, lastCreatedBooking, userId]);

  const handleBookingCreated = useCallback(
    (b: Booking) => {
      setLastCreatedBooking(b);
      refreshData();
      if (userId) {
        try {
          const minimalSummary = {
            id: b.id,
            bookingNumber: b.bookingNumber || b.id,
            vehicleName: b.vehicleName,
            status: b.status || 'new',
            createdAt: b.createdAt || new Date().toISOString(),
          };
          localStorage.setItem(recentBookingKey(userId), JSON.stringify(minimalSummary));
        } catch {}
      }
    },
    [refreshData, userId],
  );

  const dismissLastBooking = useCallback(() => {
    setLastCreatedBooking(null);
    if (userId) {
      try {
        localStorage.removeItem(recentBookingKey(userId));
      } catch {}
    }
  }, [userId]);

  const value = useMemo<DataContextType>(
    () => ({
      vehicles,
      bookings,
      settings,
      vehiclesReady,
      refreshData,
      activeBookingFilters,
      setActiveBookingFilters,
      lastCreatedBooking,
      handleBookingCreated,
      dismissLastBooking,
    }),
    [
      vehicles,
      bookings,
      settings,
      vehiclesReady,
      refreshData,
      activeBookingFilters,
      lastCreatedBooking,
      handleBookingCreated,
      dismissLastBooking,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useAppData = (): DataContextType => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used within a DataProvider');
  return ctx;
};
