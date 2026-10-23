import { describe, it, expect } from 'vitest';
import {
  calculateRentalPrice,
  calculateRentalDays,
  DEFAULT_SETTINGS,
} from '../src/services/pricing';
import {
  calculateRentalPriceServer,
  calculateRentalDaysDamascus,
  parseDamascusDateTime,
  isValidDateString,
  isValidTimeString,
} from '../functions/src/pricingServer';

describe('Pricing Engine & Damascus Timezone Tests', () => {
  it('should calculate rental days correctly with Damascus time and ceil', () => {
    // 24 hours = 1 day
    expect(calculateRentalDaysDamascus('2026-06-01', '2026-06-02', '10:00', '10:00')).toBe(1);

    // 25 hours = 2 days (ceil)
    expect(calculateRentalDaysDamascus('2026-06-01', '2026-06-02', '10:00', '11:00')).toBe(2);

    // Same date, return time <= pickup time -> 0
    expect(calculateRentalDaysDamascus('2026-06-01', '2026-06-01', '10:00', '10:00')).toBe(0);

    // Return date before pickup date -> 0
    expect(calculateRentalDaysDamascus('2026-06-05', '2026-06-01', '10:00', '10:00')).toBe(0);
  });

  it('should compute server rental pricing accurately across tabular test cases', () => {
    const testCases = [
      {
        dailyPrice: 100,
        days: 1,
        isUserLoggedIn: false,
        withDriver: false,
        expectedBase: 100,
        expectedDiscount: 0,
        expectedInsurance: 500, // <= 2 days short term
        expectedDriver: 0,
        expectedTotal: 600,
      },
      {
        dailyPrice: 100,
        days: 2,
        isUserLoggedIn: true, // 10% discount from DEFAULT_SETTINGS
        withDriver: false,
        expectedBase: 200,
        expectedDiscount: 20,
        expectedInsurance: 500, // <= 2 days short term
        expectedDriver: 0,
        expectedTotal: 680,
      },
      {
        dailyPrice: 100,
        days: 5,
        isUserLoggedIn: true,
        withDriver: true, // $40/day driver fee
        expectedBase: 500,
        expectedDiscount: 50,
        expectedInsurance: 300, // > 2 days long term
        expectedDriver: 200, // 5 * 40
        expectedTotal: 950,
      },
    ];

    for (const tc of testCases) {
      const res = calculateRentalPriceServer(
        tc.dailyPrice,
        tc.days,
        DEFAULT_SETTINGS,
        tc.isUserLoggedIn,
        undefined,
        tc.withDriver
      );

      expect(res.rentalDays).toBe(tc.days);
      expect(res.basePrice).toBe(tc.expectedBase);
      expect(res.discountAmount).toBe(tc.expectedDiscount);
      expect(res.insuranceAmount).toBe(tc.expectedInsurance);
      expect(res.driverFee).toBe(tc.expectedDriver);
      expect(res.totalPrice).toBe(tc.expectedTotal);
    }
  });

  it('should render explanation string without duplication', () => {
    const res = calculateRentalPrice('medium', 100, 3, DEFAULT_SETTINGS, {
      isUserLoggedIn: true,
      withDriver: true,
    });

    const matches = res.explanation.match(/خصم الأعضاء/g);
    expect(matches ? matches.length : 0).toBe(1); // Exactly 1 occurrence, no duplicate
  });
});

describe('Strict date/time validation (server)', () => {
  it('rejects impossible calendar dates instead of letting JS roll them over', () => {
    expect(isValidDateString('2026-02-31')).toBe(false);
    expect(isValidDateString('2026-04-31')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-00-10')).toBe(false);
    expect(isValidDateString('2026-06-00')).toBe(false);
    expect(isValidDateString('2026-6-1')).toBe(false);
    expect(Number.isNaN(parseDamascusDateTime('2026-02-31', '10:00'))).toBe(true);
  });

  it('accepts real dates including leap days', () => {
    expect(isValidDateString('2028-02-29')).toBe(true);
    expect(isValidDateString('2027-02-29')).toBe(false);
    expect(isValidDateString('2026-12-31')).toBe(true);
    expect(Number.isNaN(parseDamascusDateTime('2026-06-01', '10:00'))).toBe(false);
  });

  it('rejects out-of-range times including 24:00', () => {
    expect(isValidTimeString('00:00')).toBe(true);
    expect(isValidTimeString('23:59')).toBe(true);
    expect(isValidTimeString('24:00')).toBe(false);
    expect(isValidTimeString('10:60')).toBe(false);
    expect(isValidTimeString('9:00')).toBe(false);
    expect(Number.isNaN(parseDamascusDateTime('2026-06-01', '24:00'))).toBe(true);
  });

  it('keeps Damascus UTC+3 semantics for valid input', () => {
    expect(parseDamascusDateTime('2026-06-01', '10:00')).toBe(Date.UTC(2026, 5, 1, 7, 0, 0));
  });
});
