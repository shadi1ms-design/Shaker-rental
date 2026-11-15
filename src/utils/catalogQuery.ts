import type { FuelType, SortField, TransmissionType, VehicleCategory } from '../types';

export interface CatalogQueryState {
  category: VehicleCategory | 'all';
  q: string;
  brand: string;
  year: number | 'all';
  transmission: TransmissionType | 'all';
  fuel: FuelType | 'all';
  seats: number | 'all';
  availability: 'all' | 'available' | 'rented';
  max: number | null;
  sort: SortField;
  from: string;
  to: string;
}

const VALID_CATEGORIES = new Set<VehicleCategory>(['light', 'medium', 'jeep_7seats']);
const VALID_TRANSMISSIONS = new Set<TransmissionType>(['automatic', 'manual']);
const VALID_FUELS = new Set<FuelType>(['petrol', 'diesel', 'hybrid', 'electric']);
const VALID_AVAILABILITIES = new Set<'available' | 'rented'>(['available', 'rented']);
const VALID_SORTS = new Set<SortField>(['recommended', 'price-asc', 'price-desc', 'year-desc']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDateParam(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseCatalogParams(params: URLSearchParams | string): CatalogQueryState {
  const sp = typeof params === 'string' ? new URLSearchParams(params) : params;

  const rawCategory = sp.get('category');
  const category: VehicleCategory | 'all' =
    rawCategory && VALID_CATEGORIES.has(rawCategory as VehicleCategory)
      ? (rawCategory as VehicleCategory)
      : 'all';

  const q = sp.get('q') ?? '';
  const brand = sp.get('brand')?.trim() || 'all';

  const rawYear = sp.get('year');
  const parsedYear = rawYear ? Number(rawYear) : NaN;
  const year: number | 'all' = Number.isInteger(parsedYear) && parsedYear >= 1980 && parsedYear <= 2100 ? parsedYear : 'all';

  const rawTransmission = sp.get('transmission');
  const transmission: TransmissionType | 'all' =
    rawTransmission && VALID_TRANSMISSIONS.has(rawTransmission as TransmissionType)
      ? (rawTransmission as TransmissionType)
      : 'all';

  const rawFuel = sp.get('fuel');
  const fuel: FuelType | 'all' =
    rawFuel && VALID_FUELS.has(rawFuel as FuelType) ? (rawFuel as FuelType) : 'all';

  const rawSeats = sp.get('seats');
  const parsedSeats = rawSeats ? Number(rawSeats) : NaN;
  const seats: number | 'all' = Number.isInteger(parsedSeats) && parsedSeats > 0 && parsedSeats <= 50 ? parsedSeats : 'all';

  const rawAvailability = sp.get('availability');
  const availability: 'all' | 'available' | 'rented' =
    rawAvailability && VALID_AVAILABILITIES.has(rawAvailability as 'available' | 'rented')
      ? (rawAvailability as 'available' | 'rented')
      : 'all';

  const rawMax = sp.get('max');
  const parsedMax = rawMax ? Number(rawMax) : NaN;
  const max: number | null = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : null;

  const rawSort = sp.get('sort');
  const sort: SortField =
    rawSort && VALID_SORTS.has(rawSort as SortField) ? (rawSort as SortField) : 'recommended';

  const rawFrom = sp.get('from');
  const rawTo = sp.get('to');
  const from = isValidIsoDateParam(rawFrom) ? rawFrom : '';
  const to = isValidIsoDateParam(rawTo) && (!from || rawTo >= from) ? rawTo : '';

  return {
    category,
    q,
    brand,
    year,
    transmission,
    fuel,
    seats,
    availability,
    max,
    sort,
    from: from && to ? from : '',
    to: from && to ? to : '',
  };
}

export function buildCatalogSearchParams(
  state: Partial<CatalogQueryState>,
  boundsMax?: number
): URLSearchParams {
  const sp = new URLSearchParams();

  if (state.category && state.category !== 'all' && VALID_CATEGORIES.has(state.category)) {
    sp.set('category', state.category);
  }
  const trimmedQ = state.q?.trim();
  if (trimmedQ) {
    sp.set('q', trimmedQ);
  }
  if (state.brand && state.brand !== 'all') {
    sp.set('brand', state.brand);
  }
  if (state.year && state.year !== 'all' && Number.isInteger(state.year)) {
    sp.set('year', String(state.year));
  }
  if (state.transmission && state.transmission !== 'all' && VALID_TRANSMISSIONS.has(state.transmission)) {
    sp.set('transmission', state.transmission);
  }
  if (state.fuel && state.fuel !== 'all' && VALID_FUELS.has(state.fuel)) {
    sp.set('fuel', state.fuel);
  }
  if (state.seats && state.seats !== 'all' && Number.isInteger(state.seats)) {
    sp.set('seats', String(state.seats));
  }
  if (state.availability && state.availability !== 'all' && VALID_AVAILABILITIES.has(state.availability)) {
    sp.set('availability', state.availability);
  }
  if (
    state.max !== undefined &&
    state.max !== null &&
    Number.isFinite(state.max) &&
    (boundsMax === undefined || state.max < boundsMax)
  ) {
    sp.set('max', String(state.max));
  }
  if (state.sort && state.sort !== 'recommended' && VALID_SORTS.has(state.sort)) {
    sp.set('sort', state.sort);
  }
  if (isValidIsoDateParam(state.from) && isValidIsoDateParam(state.to) && state.to >= state.from) {
    sp.set('from', state.from);
    sp.set('to', state.to);
  }

  return sp;
}

export function buildCatalogUrl(state: Partial<CatalogQueryState>, boundsMax?: number): string {
  const sp = buildCatalogSearchParams(state, boundsMax);
  const qs = sp.toString();
  return qs ? `/cars?${qs}` : '/cars';
}

export function buildBookingUrl(
  vehicleId: string,
  dates?: { from?: string; to?: string }
): string {
  const base = `/cars/${encodeURIComponent(vehicleId)}/book`;
  if (dates && isValidIsoDateParam(dates.from) && isValidIsoDateParam(dates.to) && dates.to >= dates.from) {
    const sp = new URLSearchParams();
    sp.set('from', dates.from);
    sp.set('to', dates.to);
    return `${base}?${sp.toString()}`;
  }
  return base;
}
