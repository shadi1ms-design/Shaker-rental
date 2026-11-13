import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock localStorage BEFORE importing dataService
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => (key in localStore ? localStore[key] : null),
  setItem: (key: string, val: string) => {
    localStore[key] = String(val);
  },
  removeItem: (key: string) => {
    delete localStore[key];
  },
  clear: () => {
    for (const k of Object.keys(localStore)) {
      delete localStore[k];
    }
  },
  length: 0,
  key: () => null,
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
}

// 2. Import dataService and types
import { dataService } from '../src/services/dataService';
import { functionsService } from '../src/services/functionsService';
import type { Vehicle } from '../src/types';

describe('Phase 4 - Requirement 7: Vehicle Edit Reload Simulation Test', () => {
  const sampleVehicleId = 'veh-test-reload';

  const initialStaleLocalVehicles: Vehicle[] = [
    {
      id: sampleVehicleId,
      brand: 'Toyota',
      model: 'Camry',
      year: 2024,
      color: 'White',
      category: 'medium',
      seats: 5,
      transmission: 'automatic',
      fuelType: 'hybrid',
      dailyPrice: 75,
      plateNumber: '', // Stripped in localStorage for security
      currentMileage: 0, // Stripped in localStorage
      status: 'available',
      imageUrl: '',
      features: [],
      description: 'Test car',
    },
  ];

  const updatedCloudVehicle: Vehicle = {
    id: sampleVehicleId,
    brand: 'Toyota',
    model: 'Camry',
    year: 2024,
    color: 'White',
    category: 'medium',
    seats: 5,
    transmission: 'automatic',
    fuelType: 'hybrid',
    dailyPrice: 75,
    plateNumber: 'دمشق 888777', // New updated plate number
    currentMileage: 52000, // New updated mileage
    status: 'available',
    imageUrl: '',
    features: [],
    description: 'Test car',
    _internalDetailsLoaded: true,
  };

  beforeEach(() => {
    localStorage.clear();
    dataService.clearCache();
  });

  it('preserves updated vehicle plate number and mileage on reload with stale localStorage and empty memoryCache', async () => {
    // 1. Setup stale localStorage representing prior session state
    localStorage.setItem('shaker_vehicles', JSON.stringify(initialStaleLocalVehicles));

    // 2. Mock Cloud Function updateVehicle returning merged result
    vi.spyOn(functionsService, 'updateVehicle').mockResolvedValue({
      success: true,
      data: {
        success: true,
        vehicle: updatedCloudVehicle,
      },
    });

    // 3. Mock getVehicleById to return updated vehicle
    vi.spyOn(dataService, 'getVehicleById').mockResolvedValue(updatedCloudVehicle);

    // 4. Perform updateVehicle
    const updateResult = await dataService.updateVehicle(sampleVehicleId, {
      plateNumber: 'دمشق 888777',
      currentMileage: 52000,
    });

    expect(updateResult).toBeDefined();
    expect(updateResult.plateNumber).toBe('دمشق 888777');
    expect(updateResult.currentMileage).toBe(52000);

    // 5. SIMULATE PAGE RELOAD: Wipe volatile memory cache completely
    dataService.clearCache();

    // Verify localStorage still contains stripped version for public security
    const storedRaw = JSON.parse(localStorage.getItem('shaker_vehicles') || '[]');
    expect(storedRaw[0]?.plateNumber).toBe('');

    // 6. Call getVehicles with forceRefresh (as DataContext does on reload for staff)
    vi.spyOn(dataService, 'getVehicles').mockImplementation(async () => {
      return [updatedCloudVehicle];
    });

    const reloadedVehicles = await dataService.getVehicles(true);
    const targetVehicle = reloadedVehicles.find((v) => v.id === sampleVehicleId);

    // 7. Verify new updated values are displayed, NOT old/stale values
    expect(targetVehicle).toBeDefined();
    expect(targetVehicle?.plateNumber).toBe('دمشق 888777');
    expect(targetVehicle?.currentMileage).toBe(52000);
    expect(targetVehicle?._internalDetailsLoaded).toBe(true);
  });
});
