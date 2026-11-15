import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { dataService } from '../services/dataService';
import { setOfficialWhatsAppNumber } from '../services/whatsapp';
import { applyDerivedVehicleStatus } from '../utils/vehicleStatus';
import type { AppSettings, Booking, Vehicle } from '../types';

interface DataContextType {
  vehicles: Vehicle[];
  bookings: Booking[];
  settings: AppSettings;
  /** True once the first fetch finished (or the cache already had vehicles). */
  vehiclesReady: boolean;
  /** True once authoritative settings have been resolved from Firestore or offline fallback. */
  settingsReady: boolean;
  refreshData: () => Promise<void>;

  /** The booking the customer just created (shown as a banner until staff process it). */
  lastCreatedBooking: Booking | null;
  handleBookingCreated: (booking: Booking) => void;
  dismissLastBooking: () => void;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

const recentBookingKey = (uid: string) => `shaker_recent_booking_${uid}`;

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isEmployee } = useAuth();
  const userId = user?.uid;
  const isStaffAuthorized = isAdmin || isEmployee;

  // Core data - immediate cache bootstrap for 0ms initial render
  const [rawVehicles, setRawVehicles] = useState<Vehicle[]>(() => dataService.getCachedVehicles());
  const [bookings, setBookings] = useState<Booking[]>(() => dataService.getCachedBookings());
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getCachedSettings());
  const [vehiclesReady, setVehiclesReady] = useState<boolean>(() => dataService.getCachedVehicles().length > 0);
  const [settingsReady, setSettingsReady] = useState<boolean>(false);

  const lastAppliedVehiclesVersionRef = useRef<number>(0);
  const lastAppliedVehiclesTimestampRef = useRef<number>(0);

  // Derived dynamic status recalculates whenever rawVehicles OR bookings change
  const vehicles = useMemo(() => applyDerivedVehicleStatus(rawVehicles, bookings), [rawVehicles, bookings]);

  const [lastCreatedBooking, setLastCreatedBooking] = useState<Booking | null>(null);

  // Keep every customer-facing WhatsApp link in sync with the number saved in admin settings.
  useEffect(() => {
    setOfficialWhatsAppNumber(settings?.whatsappNumber);
  }, [settings?.whatsappNumber]);

  const handleVehiclesUpdate = useCallback((newVehicles: Vehicle[]) => {
    const versioned = newVehicles as Vehicle[] & { _version?: number; _timestamp?: number };
    const ver = versioned._version || 0;
    const ts = versioned._timestamp || Date.now();

    if (ver > 0 && ver < lastAppliedVehiclesVersionRef.current) {
      return;
    }
    if (ts < lastAppliedVehiclesTimestampRef.current) {
      return;
    }

    if (ver > 0) lastAppliedVehiclesVersionRef.current = ver;
    lastAppliedVehiclesTimestampRef.current = ts;
    setRawVehicles(newVehicles);
  }, []);

  const refreshData = useCallback(async () => {
    const fetchStart = Date.now();
    try {
      const [vList, sSettings] = await Promise.all([dataService.getVehicles(), dataService.getSettings()]);
      const versioned = vList as Vehicle[] & { _version?: number; _timestamp?: number };
      const vVer = versioned._version || 0;
      const vTs = versioned._timestamp || fetchStart;

      if (
        (vVer === 0 || vVer >= lastAppliedVehiclesVersionRef.current) &&
        vTs >= lastAppliedVehiclesTimestampRef.current
      ) {
        if (vVer > 0) lastAppliedVehiclesVersionRef.current = vVer;
        lastAppliedVehiclesTimestampRef.current = vTs;
        setRawVehicles(vList);
      }
      setSettings(sSettings);
      setSettingsReady(true);

      if (isStaffAuthorized) {
        setBookings(await dataService.getBookings(true));
      } else if (userId) {
        setBookings(await dataService.getBookingsForCustomer(userId));
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setSettingsReady(true);
    } finally {
      if (vehiclesReady !== true) setVehiclesReady(true);
    }
  }, [userId, isStaffAuthorized, vehiclesReady]);

  // Initial fetch + real-time listeners
  useEffect(() => {
    setTimeout(() => refreshData(), 0);

    const unsubscribeVehicles = dataService.subscribeToVehicles(handleVehiclesUpdate);
    const unsubscribeSettings = dataService.subscribeToSettings((nextSettings) => {
      setSettings(nextSettings);
      setSettingsReady(true);
    });

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      dataService
        .getSettings(true)
        .then((fresh) => {
          setSettings(fresh);
          setSettingsReady(true);
        })
        .catch(() => {});
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }

    let unsubscribeBookings = () => {};
    if (isStaffAuthorized) {
      unsubscribeBookings = dataService.subscribeToBookings(setBookings);
    } else if (userId) {
      unsubscribeBookings = dataService.subscribeToCustomerBookings(userId, setBookings);
    }

    return () => {
      unsubscribeVehicles();
      unsubscribeSettings();
      unsubscribeBookings();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
    };
  }, [userId, isStaffAuthorized, refreshData, handleVehiclesUpdate]);

  // Re-fetch vehicles with internal details immediately when staff permissions resolve
  useEffect(() => {
    if (isStaffAuthorized) {
      dataService
        .getVehicles(true)
        .then(handleVehiclesUpdate)
        .catch((err) => {
          console.warn('Error refetching internal vehicle details on staff auth resolution:', err);
        });
    }
  }, [isStaffAuthorized, handleVehiclesUpdate]);

  // Restore persisted recent booking on auth load
  useEffect(() => {
    if (!userId) {
      if (lastCreatedBooking !== null) {
        setTimeout(() => setLastCreatedBooking(null), 0);
      }
      return;
    }
    try {
      const saved = localStorage.getItem(recentBookingKey(userId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setTimeout(() => {
            setLastCreatedBooking((prev) => prev || (parsed as Booking));
          }, 0);
        }
      }
    } catch {}
  }, [userId, lastCreatedBooking]);

  // Dismiss the banner once staff change the status away from 'new' / 'reviewing'
  useEffect(() => {
    if (!lastCreatedBooking || !userId) return;
    const found = bookings.find(
      (b) => b.id === lastCreatedBooking.id || b.bookingNumber === lastCreatedBooking.bookingNumber,
    );
    if (found && found.status !== 'new' && found.status !== 'reviewing') {
      if (lastCreatedBooking !== null) {
        setTimeout(() => setLastCreatedBooking(null), 0);
      }
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
      settingsReady,
      refreshData,
      lastCreatedBooking,
      handleBookingCreated,
      dismissLastBooking,
    }),
    [
      vehicles,
      bookings,
      settings,
      vehiclesReady,
      settingsReady,
      refreshData,
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
