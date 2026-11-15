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

  it('should default DEFAULT_SETTINGS.discountConfig to disabled 0% without fake discount', () => {
    expect(DEFAULT_SETTINGS.discountConfig?.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.discountConfig?.percentage).toBe(0);

    const clientDefault = calculateRentalPrice('medium', 100, 2, DEFAULT_SETTINGS, {
      isUserLoggedIn: true,
    });
    expect(clientDefault.discountAmount).toBe(0);
    expect(clientDefault.memberDiscountPercentage).toBe(0);
    expect(clientDefault.memberDiscountApplied).toBe(false);
    expect(clientDefault.memberDiscountEligible).toBe(false);
  });

  it('should compute server rental pricing accurately across tabular test cases', () => {
    const enabledTenPercentSettings = {
      ...DEFAULT_SETTINGS,
      discountConfig: {
        enabled: true,
        percentage: 10,
        scope: 'all' as const,
        vehicleIds: [],
      },
    };

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
        isUserLoggedIn: true, // 10% discount when enabled
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
        enabledTenPercentSettings,
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
    const enabledSettings = {
      ...DEFAULT_SETTINGS,
      discountConfig: {
        enabled: true,
        percentage: 10,
        scope: 'all' as const,
        vehicleIds: [],
      },
    };
    const res = calculateRentalPrice('medium', 100, 3, enabledSettings, {
      isUserLoggedIn: true,
      withDriver: true,
    });

    const matches = res.explanation.match(/خصم الأعضاء/g);
    expect(matches ? matches.length : 0).toBe(1); // Exactly 1 occurrence, no duplicate
  });

  describe('Insurance fields unification & backward compatibility (old vs new document format)', () => {
    it('client engine correctly calculates insurance from legacy document (insurance1to2Days & insuranceAbove2Days only)', () => {
      // Legacy document format: only old field names present
      const legacySettings = {
        ...DEFAULT_SETTINGS,
        insuranceShortTerm: undefined as any,
        insuranceLongTerm: undefined as any,
        insurance1to2Days: 450,
        insuranceAbove2Days: 250,
      };

      // <= 2 days uses insurance1to2Days
      const shortTerm = calculateRentalPrice('medium', 100, 2, legacySettings, { isUserLoggedIn: false });
      expect(shortTerm.insuranceAmount).toBe(450);

      // > 2 days uses insuranceAbove2Days
      const longTerm = calculateRentalPrice('medium', 100, 4, legacySettings, { isUserLoggedIn: false });
      expect(longTerm.insuranceAmount).toBe(250);
    });

    it('client engine correctly calculates insurance from canonical new document (insuranceShortTerm & insuranceLongTerm only)', () => {
      // New document format: only canonical field names present
      const newSettings = {
        ...DEFAULT_SETTINGS,
        insuranceShortTerm: 600,
        insuranceLongTerm: 350,
        insurance1to2Days: undefined,
        insuranceAbove2Days: undefined,
      };

      const shortTerm = calculateRentalPrice('medium', 100, 1, newSettings, { isUserLoggedIn: false });
      expect(shortTerm.insuranceAmount).toBe(600);

      const longTerm = calculateRentalPrice('medium', 100, 5, newSettings, { isUserLoggedIn: false });
      expect(longTerm.insuranceAmount).toBe(350);
    });

    it('client engine prioritizes canonical fields over legacy fields when both are present', () => {
      const mixedSettings = {
        ...DEFAULT_SETTINGS,
        insuranceShortTerm: 700,
        insuranceLongTerm: 400,
        insurance1to2Days: 500, // should be ignored in favor of 700
        insuranceAbove2Days: 300, // should be ignored in favor of 400
      };

      const shortTerm = calculateRentalPrice('medium', 100, 2, mixedSettings, { isUserLoggedIn: false });
      expect(shortTerm.insuranceAmount).toBe(700);

      const longTerm = calculateRentalPrice('medium', 100, 3, mixedSettings, { isUserLoggedIn: false });
      expect(longTerm.insuranceAmount).toBe(400);
    });

    it('server engine correctly calculates insurance for legacy, new, and mixed document shapes', () => {
      // 1. Legacy shape on server
      const legacyServer = calculateRentalPriceServer(
        100,
        2,
        { insurance1to2Days: 420, insuranceAbove2Days: 220 },
        false
      );
      expect(legacyServer.insuranceAmount).toBe(420);

      const legacyServerLong = calculateRentalPriceServer(
        100,
        4,
        { insurance1to2Days: 420, insuranceAbove2Days: 220 },
        false
      );
      expect(legacyServerLong.insuranceAmount).toBe(220);

      // 2. Canonical new shape on server
      const newServer = calculateRentalPriceServer(
        100,
        1,
        { insuranceShortTerm: 550, insuranceLongTerm: 330 },
        false
      );
      expect(newServer.insuranceAmount).toBe(550);

      const newServerLong = calculateRentalPriceServer(
        100,
        3,
        { insuranceShortTerm: 550, insuranceLongTerm: 330 },
        false
      );
      expect(newServerLong.insuranceAmount).toBe(330);

      // 3. Mixed shape on server (canonical takes precedence)
      const mixedServerShort = calculateRentalPriceServer(
        100,
        2,
        { insuranceShortTerm: 650, insuranceLongTerm: 380, insurance1to2Days: 500, insuranceAbove2Days: 300 },
        false
      );
      expect(mixedServerShort.insuranceAmount).toBe(650);

      const mixedServerLong = calculateRentalPriceServer(
        100,
        5,
        { insuranceShortTerm: 650, insuranceLongTerm: 380, insurance1to2Days: 500, insuranceAbove2Days: 300 },
        false
      );
      expect(mixedServerLong.insuranceAmount).toBe(380);
    });
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
