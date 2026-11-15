import { useEffect } from 'react';
import type { Vehicle } from '../types';

const VEHICLE_JSONLD_SCRIPT_ID = 'vehicle-structured-data-jsonld';
const BASE_URL = 'https://shakerrent.com';

export function buildVehicleJsonLd(vehicle: Vehicle) {
  const rawImages =
    Array.isArray(vehicle.images) && vehicle.images.length > 0
      ? vehicle.images
      : vehicle.imageUrl
        ? [vehicle.imageUrl]
        : [];
  const images = rawImages.filter((img): img is string => typeof img === 'string' && img.trim().length > 0);

  const availability =
    vehicle.status === 'available'
      ? 'https://schema.org/InStock'
      : vehicle.status === 'reserved' || vehicle.status === 'rented'
        ? 'https://schema.org/PreOrder'
        : 'https://schema.org/OutOfStock';

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    additionalType: 'Car',
    name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
    description:
      vehicle.description?.trim() ||
      `تأجير سيارة ${vehicle.brand} ${vehicle.model} موديل ${vehicle.year} في دمشق من شركة شاكر لتأجير السيارات.`,
    brand: {
      '@type': 'Brand',
      name: vehicle.brand,
    },
    ...(images.length > 0 ? { image: images } : {}),
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/cars/${encodeURIComponent(vehicle.id)}`,
      price: String(vehicle.dailyPrice),
      priceCurrency: 'USD',
      availability,
    },
  };
}

/**
 * Injects Schema.org Product (additionalType "Car") JSON-LD into <head> on the
 * vehicle details page and removes it on unmount without touching the static
 * AutoRental organization JSON-LD in index.html.
 */
export function useVehicleJsonLd(vehicle: Vehicle | null): void {
  useEffect(() => {
    if (typeof document === 'undefined' || !vehicle) {
      return;
    }

    let scriptEl = document.getElementById(VEHICLE_JSONLD_SCRIPT_ID) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = VEHICLE_JSONLD_SCRIPT_ID;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }

    scriptEl.textContent = JSON.stringify(buildVehicleJsonLd(vehicle));

    return () => {
      const existing = document.getElementById(VEHICLE_JSONLD_SCRIPT_ID);
      if (existing?.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    };
  }, [vehicle]);
}
