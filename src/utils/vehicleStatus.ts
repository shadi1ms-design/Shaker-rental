import { Vehicle, Booking, VehicleStatus } from '../types';
import { todayLocalISO } from './dateUtils';

/**
 * Computes IDs of vehicles with active rentals:
 * 1. Bookings with status === 'rented'
 * 2. Confirmed bookings whose date range covers today
 */
export function computeActiveRentedVehicleIds(bookings: Booking[]): Set<string> {
  const today = todayLocalISO();
  return new Set(
    (bookings || [])
      .filter(
        (b) =>
          !b.isDeleted &&
          (b.status === 'rented' ||
            (b.status === 'confirmed' && b.pickupDate <= today && b.returnDate >= today))
      )
      .map((b) => b.vehicleId)
  );
}

/**
 * Applies derived dynamic status to vehicles:
 * - Preserves the true database status in `storedStatus`
 * - Sets dynamic `status = 'rented'` if vehicle has an active rental (unless in maintenance or inactive)
 * - Sets `status = storedStatus` otherwise
 */
export function applyDerivedVehicleStatus(vehicles: Vehicle[], bookings: Booking[]): Vehicle[] {
  const activeRentedIds = computeActiveRentedVehicleIds(bookings);

  return (vehicles || []).map((v) => {
    const stored: VehicleStatus = v.storedStatus || v.status || 'available';
    let effectiveStatus: VehicleStatus = stored;

    if (stored !== 'maintenance' && stored !== 'inactive' && activeRentedIds.has(v.id)) {
      effectiveStatus = 'rented';
    }

    return {
      ...v,
      storedStatus: stored,
      status: effectiveStatus,
    };
  });
}

export interface FleetStatusCounts {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
  reserved: number;
  inactive: number;
  reservedOrInactive: number;
}

/**
 * Calculates fleet status counts satisfying the invariant:
 * available + rented + maintenance + reservedOrInactive === total
 */
export function getFleetStatusCounts(vehicles: Vehicle[]): FleetStatusCounts {
  const validVehicles = (vehicles || []).filter((v) => !v.isDeleted);
  let available = 0;
  let rented = 0;
  let maintenance = 0;
  let reserved = 0;
  let inactive = 0;

  for (const v of validVehicles) {
    switch (v.status) {
      case 'available':
        available++;
        break;
      case 'rented':
        rented++;
        break;
      case 'maintenance':
        maintenance++;
        break;
      case 'reserved':
        reserved++;
        break;
      case 'inactive':
        inactive++;
        break;
      default:
        // Default unrecognized to available to preserve sum
        available++;
        break;
    }
  }

  const reservedOrInactive = reserved + inactive;
  const total = available + rented + maintenance + reservedOrInactive;

  return {
    total,
    available,
    rented,
    maintenance,
    reserved,
    inactive,
    reservedOrInactive,
  };
}
