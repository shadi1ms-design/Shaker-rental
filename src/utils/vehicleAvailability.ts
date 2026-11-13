import { useEffect, useState } from 'react';
import type { Booking, Vehicle } from '../types';
import { todayLocalISO } from './dateUtils';
import { functionsService } from '../services/functionsService';
import { dataService } from '../services/dataService';

// In-memory cache for resolved availability dates
const availabilityCache = new Map<string, { date: string | null; timestamp: number }>();
// In-memory cache for range availability checks: key = `${vehicleId}:${pickupDate}:${returnDate}`
const rangeAvailabilityCache = new Map<string, { available: boolean; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Checks whether two inclusive ISO date ranges [fromA, toA] and [fromB, toB] overlap.
 */
export function datesOverlap(fromA: string, toA: string, fromB: string, toB: string): boolean {
  if (!fromA || !toA || !fromB || !toB) return false;
  return fromA <= toB && toA >= fromB;
}

/**
 * Synchronous availability check for a specific date range using local vehicle status and cached bookings.
 * Returns true when the vehicle is definitely unavailable for the selected period.
 */
export function isVehicleLocallyUnavailableForRange(
  vehicle: Vehicle,
  pickupDate: string,
  returnDate: string,
  knownBookings?: Booking[]
): boolean {
  if (!pickupDate || !returnDate || returnDate < pickupDate) return false;

  if (vehicle.status === 'maintenance' || vehicle.status === 'inactive') {
    return true;
  }

  let bookingsToCheck = knownBookings;
  if (!bookingsToCheck || bookingsToCheck.length === 0) {
    try {
      bookingsToCheck = dataService.getCachedBookings();
    } catch {
      bookingsToCheck = [];
    }
  }

  if (bookingsToCheck && bookingsToCheck.length > 0) {
    const hasConflict = bookingsToCheck.some(
      (b) =>
        b.vehicleId === vehicle.id &&
        !b.isDeleted &&
        (b.status === 'confirmed' || b.status === 'rented') &&
        datesOverlap(pickupDate, returnDate, b.pickupDate, b.returnDate)
    );
    if (hasConflict) {
      return true;
    }

    // If vehicle is currently rented/reserved and we have bookings data showing no conflict for the requested period, allow it.
    if (vehicle.status === 'rented' || vehicle.status === 'reserved') {
      const nextAvail = getNextAvailableDateFromBookings(vehicle.id, bookingsToCheck);
      if (nextAvail && pickupDate >= nextAvail) {
        return false;
      }
      return true;
    }
  }

  // Without detailed bookings data, exclude rented/reserved vehicles until Cloud Function confirms availability.
  if (vehicle.status === 'rented' || vehicle.status === 'reserved') {
    return true;
  }

  return false;
}

/**
 * Resolves whether a vehicle is available for a specific [pickupDate, returnDate] period.
 */
export async function resolveVehicleAvailabilityForRange(
  vehicle: Vehicle,
  pickupDate: string,
  returnDate: string,
  knownBookings?: Booking[]
): Promise<boolean> {
  if (!pickupDate || !returnDate || returnDate < pickupDate) {
    return true;
  }

  if (vehicle.status === 'maintenance' || vehicle.status === 'inactive') {
    return false;
  }

  const cacheKey = `${vehicle.id}:${pickupDate}:${returnDate}`;
  const cached = rangeAvailabilityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.available;
  }

  // Check locally known/cached bookings first
  let bookingsToCheck = knownBookings;
  if (!bookingsToCheck || bookingsToCheck.length === 0) {
    try {
      bookingsToCheck = dataService.getCachedBookings();
    } catch {
      bookingsToCheck = [];
    }
  }

  if (bookingsToCheck && bookingsToCheck.length > 0) {
    const hasConflict = bookingsToCheck.some(
      (b) =>
        b.vehicleId === vehicle.id &&
        !b.isDeleted &&
        (b.status === 'confirmed' || b.status === 'rented') &&
        datesOverlap(pickupDate, returnDate, b.pickupDate, b.returnDate)
    );
    if (hasConflict) {
      rangeAvailabilityCache.set(cacheKey, { available: false, timestamp: Date.now() });
      return false;
    }
  }

  // Check authoritative Cloud Function
  try {
    const res = await functionsService.getVehicleAvailability({
      vehicleId: vehicle.id,
      from: pickupDate,
      to: returnDate,
    });
    if (res.success && res.data) {
      const isAvail = res.data.available !== false;
      rangeAvailabilityCache.set(cacheKey, { available: isAvail, timestamp: Date.now() });
      return isAvail;
    }
  } catch {
    // Fallback to local status determination below
  }

  const fallbackAvailable = !isVehicleLocallyUnavailableForRange(
    vehicle,
    pickupDate,
    returnDate,
    bookingsToCheck
  );
  rangeAvailabilityCache.set(cacheKey, { available: fallbackAvailable, timestamp: Date.now() });
  return fallbackAvailable;
}

/**
 * Derives the next available date from a list of active bookings for a vehicle.
 */
export function getNextAvailableDateFromBookings(
  vehicleId: string,
  bookings: Booking[]
): string | null {
  const today = todayLocalISO();
  const active = bookings.filter(
    (b) =>
      b.vehicleId === vehicleId &&
      !b.isDeleted &&
      (b.status === 'confirmed' || b.status === 'rented') &&
      b.returnDate >= today
  );

  if (active.length === 0) return null;

  // Sort by returnDate ascending so the last item is the latest return date
  active.sort((a, b) => a.returnDate.localeCompare(b.returnDate));

  const lastActive = active[active.length - 1];
  return lastActive.returnDate || null;
}

/**
 * Resolves the next available date for a vehicle asynchronously.
 * Checks memory cache -> passed bookings -> cached memory bookings -> Cloud Function.
 */
export async function resolveNextAvailableDate(
  vehicle: Vehicle,
  knownBookings?: Booking[]
): Promise<string | null> {
  if (vehicle.status === 'available') {
    return null;
  }

  if (vehicle.status === 'maintenance' || vehicle.status === 'inactive') {
    return null;
  }

  // Check cache first
  const cached = availabilityCache.get(vehicle.id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.date;
  }

  // 1. Try local/passed bookings
  if (knownBookings && knownBookings.length > 0) {
    const date = getNextAvailableDateFromBookings(vehicle.id, knownBookings);
    if (date) {
      availabilityCache.set(vehicle.id, { date, timestamp: Date.now() });
      return date;
    }
  }

  // 2. Try in-memory cached bookings from dataService
  try {
    const cachedBookings = dataService.getCachedBookings();
    if (cachedBookings && cachedBookings.length > 0) {
      const date = getNextAvailableDateFromBookings(vehicle.id, cachedBookings);
      if (date) {
        availabilityCache.set(vehicle.id, { date, timestamp: Date.now() });
        return date;
      }
    }
  } catch {}

  // 3. Fallback to Cloud Function getVehicleAvailability
  try {
    const res = await functionsService.getVehicleAvailability({ vehicleId: vehicle.id });
    if (res.success && res.data) {
      const ranges = (res.data as { bookedRanges?: Array<{ from: string; to: string }> }).bookedRanges;
      if (Array.isArray(ranges) && ranges.length > 0) {
        const today = todayLocalISO();
        const activeRanges = ranges.filter((r) => r.to && r.to >= today);
        if (activeRanges.length > 0) {
          activeRanges.sort((a, b) => a.to.localeCompare(b.to));
          const latestReturn = activeRanges[activeRanges.length - 1].to;
          availabilityCache.set(vehicle.id, { date: latestReturn, timestamp: Date.now() });
          return latestReturn;
        }
      }
    }
  } catch {}

  // No specific date resolved
  availabilityCache.set(vehicle.id, { date: null, timestamp: Date.now() });
  return null;
}

/**
 * React hook to retrieve the next available date for a vehicle.
 */
export function useVehicleAvailability(
  vehicle: Vehicle | null,
  knownBookings?: Booking[]
): { nextAvailableDate: string | null; isLoading: boolean } {
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(() => {
    if (!vehicle || vehicle.status === 'available') return null;
    const cached = availabilityCache.get(vehicle.id);
    return cached ? cached.date : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let initTimer: ReturnType<typeof setTimeout> | null = null;

    if (!vehicle || vehicle.status === 'available' || vehicle.status === 'maintenance' || vehicle.status === 'inactive') {
      initTimer = setTimeout(() => {
        if (isMounted) {
          setNextAvailableDate(null);
          setIsLoading(false);
        }
      }, 0);
      return () => {
        isMounted = false;
        if (initTimer) clearTimeout(initTimer);
      };
    }

    initTimer = setTimeout(() => {
      if (isMounted) setIsLoading(true);
    }, 0);

    resolveNextAvailableDate(vehicle, knownBookings)
      .then((date) => {
        if (isMounted) {
          setNextAvailableDate(date);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (initTimer) clearTimeout(initTimer);
    };
  }, [vehicle, knownBookings]);

  return { nextAvailableDate, isLoading };
}

/**
 * React hook to resolve availability of a vehicle list for a given [pickupDate, returnDate] interval.
 */
export function useRangeAvailability(
  vehicles: Vehicle[],
  pickupDate?: string,
  returnDate?: string,
  knownBookings?: Booking[]
): { availabilityMap: Record<string, boolean>; isChecking: boolean } {
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let initTimer: ReturnType<typeof setTimeout> | null = null;

    const hasValidRange = Boolean(pickupDate && returnDate && returnDate >= pickupDate);
    if (!hasValidRange || vehicles.length === 0) {
      initTimer = setTimeout(() => {
        if (isMounted) {
          setAvailabilityMap({});
          setIsChecking(false);
        }
      }, 0);
      return () => {
        isMounted = false;
        if (initTimer) clearTimeout(initTimer);
      };
    }

    initTimer = setTimeout(() => {
      if (isMounted) setIsChecking(true);
    }, 0);

    Promise.all(
      vehicles.map(async (v) => {
        const available = await resolveVehicleAvailabilityForRange(
          v,
          pickupDate!,
          returnDate!,
          knownBookings
        );
        return [v.id, available] as const;
      })
    )
      .then((entries) => {
        if (!isMounted) return;
        const map: Record<string, boolean> = {};
        for (const [id, available] of entries) {
          map[id] = available;
        }
        setAvailabilityMap(map);
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
      if (initTimer) clearTimeout(initTimer);
    };
  }, [vehicles, pickupDate, returnDate, knownBookings]);

  return { availabilityMap, isChecking };
}
