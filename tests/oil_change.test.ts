import { describe, it, expect } from 'vitest';
import {
  calculateOilChange,
  DEFAULT_OIL_CHANGE_INTERVAL_KM,
} from '../src/utils/oilChange';

describe('Oil Change Calculation Utility (calculateOilChange)', () => {
  it('calculates remainingKm and returns status="ok" when remainingKm >= 500', () => {
    const res = calculateOilChange({
      currentMileage: 12000,
      lastOilChangeMileage: 10000,
      oilChangeIntervalKm: 5000,
    });
    expect(res.remainingKm).toBe(3000);
    expect(res.status).toBe('ok');
    expect(res.needsAttention).toBe(false);
    expect(res.nextOilChangeMileage).toBe(15000);
  });

  it('defaults oilChangeIntervalKm to 5000 and lastOilChangeMileage to 0 when omitted', () => {
    const res = calculateOilChange({
      currentMileage: 1000,
    });
    expect(res.oilChangeIntervalKm).toBe(DEFAULT_OIL_CHANGE_INTERVAL_KM);
    expect(res.lastOilChangeMileage).toBe(0);
    expect(res.remainingKm).toBe(4000);
    expect(res.status).toBe('ok');
  });

  it('returns status="soon" when 0 <= remainingKm < 500', () => {
    const res499 = calculateOilChange({
      currentMileage: 14501,
      lastOilChangeMileage: 10000,
      oilChangeIntervalKm: 5000,
    });
    expect(res499.remainingKm).toBe(499);
    expect(res499.status).toBe('soon');
    expect(res499.needsAttention).toBe(true);

    const resZero = calculateOilChange({
      currentMileage: 15000,
      lastOilChangeMileage: 10000,
      oilChangeIntervalKm: 5000,
    });
    expect(resZero.remainingKm).toBe(0);
    expect(resZero.status).toBe('soon');
    expect(resZero.needsAttention).toBe(true);
  });

  it('returns status="overdue" when remainingKm < 0', () => {
    const resOverdue = calculateOilChange({
      currentMileage: 15250,
      lastOilChangeMileage: 10000,
      oilChangeIntervalKm: 5000,
    });
    expect(resOverdue.remainingKm).toBe(-250);
    expect(resOverdue.status).toBe('overdue');
    expect(resOverdue.needsAttention).toBe(true);
  });

  it('resets remainingKm to full interval when lastOilChangeMileage equals currentMileage ("تم تغيير الزيت")', () => {
    const res = calculateOilChange({
      currentMileage: 24500,
      lastOilChangeMileage: 24500,
      oilChangeIntervalKm: 5000,
    });
    expect(res.remainingKm).toBe(5000);
    expect(res.status).toBe('ok');
    expect(res.needsAttention).toBe(false);
  });
});
