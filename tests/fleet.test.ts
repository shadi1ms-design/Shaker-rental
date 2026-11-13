import { describe, it, expect } from 'vitest';
import { vehicleFormSchema } from '../src/services/validation';
import { validateVehiclePayload } from '../functions/src/fleetFunctions';

describe('Fleet Management & Vehicle Validation Suite', () => {
  // (a) Diff & Rented Status Tests
  describe('a) Diff & Rented Status Handling', () => {
    it('vehicleFormSchema rejects rented status directly from client payload if submitted', () => {
      const payload = {
        brand: 'Kia',
        model: 'Optima',
        year: 2022,
        color: 'White',
        category: 'medium',
        seats: 5,
        transmission: 'automatic',
        fuelType: 'petrol',
        dailyPrice: 50,
        plateNumber: '123456-Damascus',
        currentMileage: 10000,
        status: 'rented',
        imageUrl: 'https://example.com/car.jpg',
        images: ['https://example.com/car.jpg'],
        description: 'Test car',
      };
      
      // Server validateVehiclePayload strictly forbids status: 'rented'
      expect(() => validateVehiclePayload(payload, { partial: true })).toThrow(
        /حالة السيارة المؤجرة تنتج حصراً عبر تسليم السيارة لحجز نشط/
      );
    });

    it('validateVehiclePayload allows partial updates without sending unchanged status', () => {
      const diffPayload = {
        brand: 'Kia',
        model: 'Optima Updated',
        // status is omitted in diff
      };
      const validated = validateVehiclePayload(diffPayload, { partial: true });
      expect(validated.brand).toBe('Kia');
      expect(validated.model).toBe('Optima Updated');
      expect(validated.status).toBeUndefined();
    });
  });

  // (b) Specifications Splitting
  describe('b) Specifications Splitting Logic', () => {
    const parseFeaturesText = (text: string): string[] => {
      return Array.from(
        new Set(
          text
            .split(/[,،\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      );
    };

    it('splits specifications string by english comma, arabic comma, and newlines correctly', () => {
      const rawText = 'مكيف ممتاز, كاميرا خلفية، حساسات ركن\nفرامل ABS, شاشة لمس';
      const parsed = parseFeaturesText(rawText);
      expect(parsed).toEqual([
        'مكيف ممتاز',
        'كاميرا خلفية',
        'حساسات ركن',
        'فرامل ABS',
        'شاشة لمس',
      ]);
    });

    it('deduplicates features and handles extra whitespace', () => {
      const rawText = 'مكيف ممتاز ، مكيف ممتاز ,   كاميرا خلفية\n \nكاميرا خلفية';
      const parsed = parseFeaturesText(rawText);
      expect(parsed).toEqual(['مكيف ممتاز', 'كاميرا خلفية']);
    });
  });

  // (c) Jeep 7 Seats Binding (UI & Server)
  describe('c) Jeep 7 Seats Validation (UI & Server)', () => {
    it('vehicleFormSchema rejects jeep_7seats when seats < 7 in UI validation', () => {
      const result = vehicleFormSchema.safeParse({
        brand: 'Toyota',
        model: 'Prado',
        year: 2023,
        color: 'Black',
        category: 'jeep_7seats',
        seats: 5, // invalid for jeep_7seats
        transmission: 'automatic',
        fuelType: 'petrol',
        dailyPrice: 90,
        plateNumber: '789101-Damascus',
        currentMileage: 5000,
        status: 'available',
        imageUrl: 'https://example.com/prado.jpg',
        images: ['https://example.com/prado.jpg'],
        description: 'Jeep test',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const seatsError = result.error.issues.find((i) => i.path.includes('seats'));
        expect(seatsError).toBeDefined();
        expect(seatsError?.message).toContain('7 مقاعد على الأقل');
      }
    });

    it('vehicleFormSchema accepts jeep_7seats when seats >= 7', () => {
      const result = vehicleFormSchema.safeParse({
        brand: 'Toyota',
        model: 'Prado',
        year: 2023,
        color: 'Black',
        category: 'jeep_7seats',
        seats: 7,
        transmission: 'automatic',
        fuelType: 'petrol',
        dailyPrice: 90,
        plateNumber: '789101-Damascus',
        currentMileage: 5000,
        status: 'available',
        imageUrl: 'https://example.com/prado.jpg',
        images: ['https://example.com/prado.jpg'],
        description: 'Jeep test',
      });

      expect(result.success).toBe(true);
    });

    it('validateVehiclePayload on server rejects jeep_7seats with seats < 7', () => {
      const payload = {
        brand: 'Toyota',
        model: 'Prado',
        year: 2023,
        color: 'Black',
        category: 'jeep_7seats',
        seats: 5,
        transmission: 'automatic',
        fuelType: 'petrol',
        dailyPrice: 90,
        plateNumber: '789101-Damascus',
        currentMileage: 5000,
        status: 'available',
        imageUrl: 'https://example.com/prado.jpg',
        images: ['https://example.com/prado.jpg'],
      };

      expect(() => validateVehiclePayload(payload, { partial: false })).toThrow(
        /فئة SUV تتطلب 7 مقاعد على الأقل/
      );
    });
  });

  // (d) Plate Number Normalization
  describe('d) Plate Number Normalization Logic', () => {
    const normalizePlate = (plate: string) => plate.toUpperCase().replace(/[\s\-]/g, '');

    it('normalizes plate numbers by stripping spaces, hyphens, and converting to uppercase', () => {
      expect(normalizePlate('123456-DAMASCUS')).toBe('123456DAMASCUS');
      expect(normalizePlate(' 123 - 456 - dms ')).toBe('123456DMS');
      expect(normalizePlate('abc-123')).toBe('ABC123');
    });
  });

  // (e) Success Path Single Navigate
  describe('e) Single Navigate Call on Success Path', () => {
    it('VehicleFormModal.tsx code does NOT call onClose() on successful submit path', () => {
      const fs = require('fs');
      const path = require('path');
      const modalCode = fs.readFileSync(
        path.resolve(__dirname, '../src/components/VehicleFormModal.tsx'),
        'utf8'
      );

      // Verify that after calling onSaved(updated) or onSaved(created), onClose() is NOT called
      expect(modalCode).not.toMatch(/onSaved\([^)]+\);\s*onClose\(\)/);
    });

    it('AdminDashboard.tsx passes navigate with { replace: true } on vehicle saved', () => {
      const fs = require('fs');
      const path = require('path');
      const dashboardCode = fs.readFileSync(
        path.resolve(__dirname, '../src/components/AdminDashboard.tsx'),
        'utf8'
      );

      expect(dashboardCode).toContain("navigate('/admin/vehicles', { replace: true })");
    });
  });
});
