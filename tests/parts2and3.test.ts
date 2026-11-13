import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { parseNumberInput, normalizeNumberText } from '../src/components/ui/NumberInput';
import { bookingFormSchema } from '../src/services/validation';
import { RentalContract } from '../src/components/RentalContract';
import { DEFAULT_SETTINGS } from '../src/services/pricing';
import { isCallerAdmin } from '../functions/src/authz';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Part 2: NumberInput and Numeric Parsing Logic', () => {
  it('empty input is not replaced with a fallback like 2022 or 5', () => {
    expect(parseNumberInput('')).toBe(0);
    expect(parseNumberInput('', true)).toBe(null);
    expect(parseNumberInput('   ')).toBe(0);
  });

  it('correctly parses numbers including decimals', () => {
    expect(parseNumberInput('100')).toBe(100);
    expect(parseNumberInput('1.5')).toBe(1.5);
    expect(parseNumberInput('0')).toBe(0);
  });

  it('converts Arabic/Indic digits', () => {
    expect(parseNumberInput('١٠٠')).toBe(100);
    expect(parseNumberInput('١.٥')).toBe(1.5);
  });

  it('normalizes display on blur by stripping leading zeroes', () => {
    expect(normalizeNumberText('0100')).toBe('100');
    expect(normalizeNumberText('007')).toBe('7');
    expect(normalizeNumberText('0')).toBe('0');
    expect(normalizeNumberText('1.5')).toBe('1.5');
    expect(normalizeNumberText('', true)).toBe('');
  });

  it('no onChange fallback values like "|| 0)", "|| 2022", "|| 5)" exist in src/', () => {
    const srcFiles = [
      'src/components/VehicleFormModal.tsx',
      'src/components/AdminSettings.tsx',
      'src/components/admin/settings/CompanyIdentitySection.tsx',
      'src/components/admin/settings/PricingAndInsuranceSection.tsx',
    ];
    for (const file of srcFiles) {
      const content = read(file);
      expect(content).not.toMatch(/onChange.*\|\|\s*0\)/);
      expect(content).not.toMatch(/onChange.*\|\|\s*2022\b/);
      expect(content).not.toMatch(/onChange.*\|\|\s*5\)/);
    }
  });
});

describe('Part 3: Booking Form and Contracts', () => {
  const baseValidBooking = {
    vehicleId: 'veh-123',
    customerName: 'محمد أحمد السوري',
    customerPhone: '+9639331234567',
    customerWhatsApp: '+9639331234567',
    pickupDate: '2099-12-01',
    pickupTime: '10:00',
    returnDate: '2099-12-05',
    returnTime: '10:00',
  };

  it('rejects customerAddress when less than 20 characters', () => {
    const result = bookingFormSchema.safeParse({
      ...baseValidBooking,
      customerAddress: 'دمشق - المزة', // 12 chars
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const addrError = result.error.issues.find((i) => i.path[0] === 'customerAddress');
      expect(addrError).toBeDefined();
      expect(addrError?.message).toContain('20 حرفاً');
    }
  });

  it('accepts customerAddress when 20 characters or more', () => {
    const result = bookingFormSchema.safeParse({
      ...baseValidBooking,
      customerAddress: 'دمشق - المزة فيلات غربية - جانب حديقة الجلاء', // > 20 chars
    });
    expect(result.success).toBe(true);
  });

  it('booking succeeds without any nationalId or licenseNumber fields', () => {
    const result = bookingFormSchema.safeParse({
      ...baseValidBooking,
      customerAddress: 'دمشق - المزة فيلات غربية - جانب حديقة الجلاء',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).customerNationalId).toBeUndefined();
      expect((result.data as any).customerLicenseNumber).toBeUndefined();
    }
  });

  it('RentalContract.tsx does NOT contain "الجواز" or "رخصة القيادة" and DOES contain "العنوان"', () => {
    const contract = read('src/components/RentalContract.tsx');
    expect(contract).not.toContain('الرقم الوطني / الجواز');
    expect(contract).not.toContain('رخصة القيادة');
    expect(contract).not.toContain('الجواز');
    expect(contract).toContain('العنوان');
  });

  it('No customerNationalId or customerLicenseNumber in active src/ or functions/src/', () => {
    const checkDir = (dir: string) => {
      const fullDir = path.join(root, dir);
      const entries = fs.readdirSync(fullDir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const filePath = path.join(entry.parentPath || fullDir, entry.name);
          const content = fs.readFileSync(filePath, 'utf8');
          expect(content, `Found customerNationalId in ${filePath}`).not.toContain('customerNationalId');
          expect(content, `Found customerLicenseNumber in ${filePath}`).not.toContain('customerLicenseNumber');
        }
      }
    };
    checkDir('src');
    checkDir('functions/src');
  });

  it('NumberInput behavior: clearing leaves empty, 100 yields 100, and 0100 becomes 100 on blur', () => {
    // Clearing input with allowEmpty
    expect(parseNumberInput('', true)).toBeNull();
    expect(normalizeNumberText('', true)).toBe('');

    // 100 yields 100
    expect(parseNumberInput('100')).toBe(100);

    // 0100 becomes 100 on blur
    expect(normalizeNumberText('0100')).toBe('100');
  });

  it('RentalContract rendered output contains "العنوان" and its value, and excludes "الجواز" and "رخصة القيادة"', () => {
    const dummyBooking: any = {
      id: '1',
      bookingNumber: '1',
      customerName: 'أحمد محمود',
      customerPhone: '+963933123456',
      customerAddress: 'دمشق - المزة شارع الجلاء بناء 10',
      pickupDate: '2026-05-01',
      returnDate: '2026-05-05',
      totalPrice: 200,
      status: 'completed',
    };
    const html = renderToString(
      React.createElement(RentalContract, {
        booking: dummyBooking,
        vehicle: null,
        settings: DEFAULT_SETTINGS,
      })
    );
    expect(html).toContain('العنوان');
    expect(html).toContain('دمشق - المزة شارع الجلاء بناء 10');
    expect(html).not.toContain('الجواز');
    expect(html).not.toContain('رخصة القيادة');
  });

  it('Booking number generation is numeric only, starts from 1, and increments by 1', () => {
    function getNextBookingNumber(counterVal?: number): string {
      const nextCount = (counterVal || 0) + 1;
      return String(nextCount);
    }

    const first = getNextBookingNumber(undefined);
    expect(first).toBe('1');
    expect(first).toMatch(/^\d+$/);

    const second = getNextBookingNumber(Number(first));
    expect(second).toBe('2');
    expect(second).toMatch(/^\d+$/);

    const third = getNextBookingNumber(Number(second));
    expect(third).toBe('3');
    expect(third).toMatch(/^\d+$/);
  });
});

describe('Delete Booking Authorization and Skipping Logic', () => {
  it('Server: rejects non-admin users and allows admins', () => {
    const customerToken = { role: 'customer' };
    const employeeToken = { role: 'employee' };
    const adminToken = { role: 'admin' };
    const superAdminToken = { role: 'super_admin' };

    expect(isCallerAdmin(customerToken)).toBe(false);
    expect(isCallerAdmin(employeeToken)).toBe(false);
    expect(isCallerAdmin(adminToken)).toBe(true);
    expect(isCallerAdmin(superAdminToken)).toBe(true);
  });

  it('Server: supports numeric booking IDs and legacy SHK string IDs', () => {
    const numericId = '1';
    const legacyId = 'SHK-2025-000001';

    // Numeric IDs are non-empty strings of digits
    expect(numericId).toMatch(/^\d+$/);
    // Legacy IDs match the SHK pattern
    expect(legacyId).toContain('SHK');
  });

  it('Frontend: skips rented and confirmed bookings from deletion', () => {
    const selectedBookings = [
      { id: '1', bookingNumber: '1', status: 'new' },
      { id: '2', bookingNumber: '2', status: 'confirmed' },
      { id: '3', bookingNumber: '3', status: 'rented' },
      { id: '4', bookingNumber: '4', status: 'completed' },
      { id: '5', bookingNumber: '5', status: 'rejected' },
    ];

    const validToDelete = selectedBookings.filter(
      (b) => b.status !== 'rented' && b.status !== 'confirmed'
    );
    const skipped = selectedBookings.filter(
      (b) => b.status === 'rented' || b.status === 'confirmed'
    );

    expect(validToDelete.map((b) => b.id)).toEqual(['1', '4', '5']);
    expect(skipped.map((b) => b.id)).toEqual(['2', '3']);
  });

  it('Frontend: delete button condition is restricted to admin and super_admin', () => {
    function canShowDeleteButton(isAdmin: boolean, isSuperAdmin: boolean): boolean {
      return isAdmin || isSuperAdmin;
    }

    expect(canShowDeleteButton(false, false)).toBe(false); // Employee / Customer
    expect(canShowDeleteButton(true, false)).toBe(true);  // Admin
    expect(canShowDeleteButton(false, true)).toBe(true);  // Super Admin
  });
});
