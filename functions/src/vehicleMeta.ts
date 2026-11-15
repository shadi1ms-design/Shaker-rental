/**
 * CLOUD FUNCTION: vehicleMeta
 *
 * Serves dynamic Open Graph & canonical HTML metadata for /cars/:id (GET only)
 * in region asia-south1.
 * - Reads vehicle document from Firestore (ignores deleted or inactive vehicles)
 * - Loads built index.html from Hosting (with disk fallback) and caches it for 60 seconds
 * - Strictly escapes all dynamic values to prevent XSS
 * - Sets Cache-Control: public, max-age=300, s-maxage=600
 * - Returns HTTP 503 with Retry-After: 30 and Arabic error page if template cannot be fetched and no cached copy exists
 */

import * as fs from 'fs';
import * as path from 'path';
import { onRequest } from 'firebase-functions/v2/https';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';

const SITE_ORIGIN = 'https://shakerrent.com';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image-v2.jpg`;
const CACHE_CONTROL_FOUND = 'public, max-age=300, s-maxage=600';
const CACHE_CONTROL_NOT_FOUND = 'public, max-age=60, s-maxage=120';
const TEMPLATE_CACHE_TTL_MS = 60_000;
const TEMPLATE_FETCH_TIMEOUT_MS = 1500;

let cachedTemplateHtml: string | null = null;
let templateCachedAt = 0;

/**
 * Resets the module-level template cache (useful for testing).
 */
export function resetTemplateCacheForTest(): void {
  cachedTemplateHtml = null;
  templateCachedAt = 0;
}

/**
 * Sets the module-level template cache directly (useful for testing cache expiration or fallback).
 */
export function setTemplateCacheForTest(html: string, cachedAt = Date.now()): void {
  cachedTemplateHtml = html;
  templateCachedAt = cachedAt;
}

export interface VehicleDocData {
  brand?: unknown;
  model?: unknown;
  year?: unknown;
  dailyPrice?: unknown;
  description?: unknown;
  images?: unknown;
  imageUrl?: unknown;
  image?: unknown;
  status?: unknown;
  isDeleted?: unknown;
}

export interface VehicleMetaPayload {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  canonicalUrl: string;
  robots: string;
}

/**
 * Strictly escapes HTML special characters to prevent XSS in text nodes and attributes.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and normalizes an image URL for Open Graph meta tags.
 */
export function sanitizeImageUrl(rawUrl: unknown, fallback = DEFAULT_OG_IMAGE): string {
  if (typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\x00-\x1f\x7f]/.test(trimmed)) return fallback;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return `${SITE_ORIGIN}${trimmed}`;
  }
  return fallback;
}

/**
 * Extracts a safe vehicle ID from /cars/:id or /:id request path.
 */
export function extractVehicleIdFromPath(rawPath: string): string | null {
  if (!rawPath) return null;
  const withoutQuery = rawPath.split(/[?#]/)[0].replace(/\/+$/, '');
  const match = withoutQuery.match(/^\/cars\/([^/]+)$/) || withoutQuery.match(/^\/([^/]+)$/);
  if (!match || !match[1]) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]).trim();
  } catch {
    return null;
  }

  if (
    !decoded ||
    decoded.length > 128 ||
    decoded === 'book' ||
    decoded === 'cars' ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    decoded.includes('..') ||
    /[\x00-\x1f\x7f]/.test(decoded)
  ) {
    return null;
  }

  return decoded;
}

/**
 * Builds the metadata payload and HTTP status code (200 or 404) for a vehicle document.
 */
export function buildVehicleMetaPayload(
  vehicleId: string | null,
  data: VehicleDocData | null | undefined
): { status: 200 | 404; payload: VehicleMetaPayload } {
  const isActiveVehicle =
    Boolean(vehicleId) &&
    Boolean(data) &&
    data?.isDeleted !== true &&
    data?.status !== 'inactive';

  if (!isActiveVehicle || !vehicleId || !data) {
    const title = 'السيارة غير متوفرة | شاكر لتأجير السيارات';
    const description =
      'السيارة المطلوبة غير متوفرة حالياً في أسطول شركة شاكر لتأجير السيارات في دمشق.';
    const fallbackUrl = `${SITE_ORIGIN}/cars`;
    return {
      status: 404,
      payload: {
        title,
        description,
        ogTitle: title,
        ogDescription: description,
        ogImage: DEFAULT_OG_IMAGE,
        ogUrl: fallbackUrl,
        canonicalUrl: fallbackUrl,
        robots: 'noindex,nofollow',
      },
    };
  }

  const brand = typeof data.brand === 'string' ? data.brand.trim() : '';
  const model = typeof data.model === 'string' ? data.model.trim() : '';
  const year =
    typeof data.year === 'number' || typeof data.year === 'string'
      ? String(data.year).trim()
      : '';
  const carLabel = [brand, model, year].filter(Boolean).join(' ') || 'سيارة حديثة';

  const dailyPrice =
    typeof data.dailyPrice === 'number' && Number.isFinite(data.dailyPrice) && data.dailyPrice > 0
      ? data.dailyPrice
      : null;
  const pricePhrase = dailyPrice ? ` بسعر ${dailyPrice}$ يومياً` : '';

  const rawDesc = typeof data.description === 'string' ? data.description.trim() : '';
  const description = (
    rawDesc
      ? `استأجر ${carLabel} في دمشق من شركة شاكر لتأجير السيارات${pricePhrase}. ${rawDesc}`
      : `استأجر ${carLabel} في دمشق من شركة شاكر لتأجير السيارات${pricePhrase}. حجز فوري وعقود رسمية.`
  ).slice(0, 240);

  const title = `${carLabel} للإيجار في دمشق | شاكر لتأجير السيارات`;

  let firstImage: unknown = null;
  if (Array.isArray(data.images) && data.images.length > 0) {
    firstImage = data.images.find((img) => typeof img === 'string' && img.trim().length > 0);
  }
  if (!firstImage && typeof data.imageUrl === 'string' && data.imageUrl.trim()) {
    firstImage = data.imageUrl;
  }
  if (!firstImage && typeof data.image === 'string' && data.image.trim()) {
    firstImage = data.image;
  }

  const canonicalUrl = `${SITE_ORIGIN}/cars/${encodeURIComponent(vehicleId)}`;

  return {
    status: 200,
    payload: {
      title,
      description,
      ogTitle: title,
      ogDescription: description,
      ogImage: sanitizeImageUrl(firstImage),
      ogUrl: canonicalUrl,
      canonicalUrl,
      robots: 'index,follow',
    },
  };
}

/**
 * Injects escaped Open Graph, description, robots, and canonical tags into index.html.
 */
export function injectVehicleMetaHtml(
  templateHtml: string,
  meta: VehicleMetaPayload
): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeOgTitle = escapeHtml(meta.ogTitle);
  const safeOgDesc = escapeHtml(meta.ogDescription);
  const safeOgImage = escapeHtml(meta.ogImage);
  const safeOgUrl = escapeHtml(meta.ogUrl);
  const safeCanonical = escapeHtml(meta.canonicalUrl);
  const safeRobots = escapeHtml(meta.robots);

  let html = templateHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${safeTitle}</title>`);

  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    () => `<meta name="description" content="${safeDesc}" />`
  );

  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    () => `<meta property="og:title" content="${safeOgTitle}" />`
  );

  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    () => `<meta property="og:description" content="${safeOgDesc}" />`
  );

  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    () => `<meta property="og:image" content="${safeOgImage}" />`
  );

  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
    () => `<meta name="twitter:image" content="${safeOgImage}" />`
  );

  html = html.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    () => `<meta name="robots" content="${safeRobots}" />`
  );

  if (/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i.test(html)) {
    html = html.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      () => `<meta property="og:url" content="${safeOgUrl}" />`
    );
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      () => `<link rel="canonical" href="${safeCanonical}" />`
    );
  } else {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      () =>
        `<link rel="canonical" href="${safeCanonical}" />\n    <meta property="og:url" content="${safeOgUrl}" />`
    );
  }

  return html;
}

async function fetchIndexHtmlOnce(hostingOrigin: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEMPLATE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${hostingOrigin}/index.html`, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    if (response.ok) {
      const text = await response.text();
      if (text.includes('<title>') && !text.includes('/src/main.tsx')) {
        return text;
      }
    }
  } catch {
    // Fetch failed or timed out
  } finally {
    clearTimeout(timer);
  }
  return null;
}

/**
 * Attempts to load index.html from disk (for local testing / emulators).
 */
function loadIndexHtmlFromDisk(): string | null {
  const candidatePaths = [
    path.resolve(__dirname, '../../dist/index.html'),
    path.resolve(process.cwd(), '../dist/index.html'),
    path.resolve(process.cwd(), 'dist/index.html'),
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const diskHtml = fs.readFileSync(p, 'utf8');
        if (diskHtml.includes('<title>') && !diskHtml.includes('/src/main.tsx')) {
          return diskHtml;
        }
      }
    } catch {
      // Ignore filesystem errors
    }
  }
  return null;
}

/**
 * Fetches built index.html with up to 2 attempts within a total timeout budget (~3s) and 60s cache TTL.
 */
export async function getIndexHtmlTemplate(): Promise<string | null> {
  const now = Date.now();
  if (cachedTemplateHtml && now - templateCachedAt < TEMPLATE_CACHE_TTL_MS) {
    return cachedTemplateHtml;
  }

  const hostingOrigin = process.env.HOSTING_ORIGIN || SITE_ORIGIN;

  // Attempt 1: Fetch from Hosting
  let html = await fetchIndexHtmlOnce(hostingOrigin);

  // Attempt 2: Retry once if Attempt 1 failed
  if (!html) {
    html = await fetchIndexHtmlOnce(hostingOrigin);
  }

  // Fallback: Check local built dist/index.html on disk
  if (!html) {
    html = loadIndexHtmlFromDisk();
  }

  if (html) {
    cachedTemplateHtml = html;
    templateCachedAt = Date.now();
    return html;
  }

  // If refresh failed but we have a stale cached template, use it rather than failing
  if (cachedTemplateHtml) {
    return cachedTemplateHtml;
  }

  return null;
}

function getDb() {
  const app = getApps().length ? getApp() : initializeApp();
  return getFirestore(app, DATABASE_ID);
}

export const vehicleMeta = onRequest(
  {
    region: FUNCTION_REGION,
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).set('Allow', 'GET').send('Method Not Allowed');
      return;
    }

    const templateHtml = await getIndexHtmlTemplate();
    if (!templateHtml) {
      res
        .status(503)
        .set('Retry-After', '30')
        .set('Content-Type', 'text/html; charset=utf-8')
        .send(
          `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>نظام الصيانة • شاكر لتأجير السيارات</title></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;text-align:center;padding:50px"><h2>عذراً، الخدمة غير متاحة مؤقتاً</h2><p>نعمل على تحديث النظام، يرجى المحاولة بعد قليل.</p><a href="https://shakerrent.com/" style="color:#fbbf24">العودة إلى الصفحة الرئيسية</a></body></html>`
        );
      return;
    }

    const vehicleId = extractVehicleIdFromPath(req.path || req.url || '');
    let docData: VehicleDocData | null = null;

    if (vehicleId) {
      try {
        const snap = await getDb().collection('vehicles').doc(vehicleId).get();
        if (snap.exists) {
          docData = (snap.data() as VehicleDocData) ?? null;
        }
      } catch (err) {
        console.error('[vehicleMeta] Firestore lookup error:', err);
      }
    }

    const { status, payload } = buildVehicleMetaPayload(vehicleId, docData);
    const html = injectVehicleMetaHtml(templateHtml, payload);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', status === 200 ? CACHE_CONTROL_FOUND : CACHE_CONTROL_NOT_FOUND);
    if (status === 404) {
      res.set('X-Robots-Tag', 'noindex, nofollow');
    }
    res.status(status).send(html);
  }
);
