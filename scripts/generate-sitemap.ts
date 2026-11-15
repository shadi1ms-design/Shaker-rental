import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BASE_URL = 'https://shakerrent.com';
const SITEMAP_PATH = path.resolve(process.cwd(), 'public', 'sitemap.xml');
const FIREBASE_CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');
const QUERY_TIMEOUT_MS = 4000;

interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

interface FetchVehiclesResult {
  ok: boolean;
  entries: SitemapEntry[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function existingSitemapHasVehicleUrls(): Promise<boolean> {
  try {
    const currentXml = await fs.readFile(SITEMAP_PATH, 'utf8');
    return /<loc>\s*https?:\/\/[^<]+\/cars\/[^<\s]+\s*<\/loc>/.test(currentXml);
  } catch {
    return false;
  }
}

async function fetchActiveVehicleEntries(todayIso: string): Promise<FetchVehiclesResult> {
  let config: { projectId?: string; firestoreDatabaseId?: string } = {};
  try {
    const raw = await fs.readFile(FIREBASE_CONFIG_PATH, 'utf8');
    config = JSON.parse(raw) as { projectId?: string; firestoreDatabaseId?: string };
  } catch (err) {
    console.warn(
      '[generate-sitemap] لم تُضف روابط السيارات (تعذّر قراءة إعدادات المشروع):',
      err instanceof Error ? err.message : String(err)
    );
    return { ok: false, entries: [] };
  }

  if (!config.projectId) {
    console.warn('[generate-sitemap] لم تُضف روابط السيارات (projectId غير موجود في الإعدادات).');
    return { ok: false, entries: [] };
  }

  let appInstance: ReturnType<typeof initializeApp> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const existing = getApps();
    appInstance =
      existing.length > 0
        ? existing[0]
        : initializeApp({ projectId: config.projectId });

    const db =
      config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
        ? getFirestore(appInstance, config.firestoreDatabaseId)
        : getFirestore(appInstance);

    const queryPromise = db.collection('vehicles').get();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Firestore sitemap query timed out after 4s')),
        QUERY_TIMEOUT_MS
      );
    });

    const snapshot = await Promise.race([queryPromise, timeoutPromise]);
    const vehicleEntries: SitemapEntry[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data() as { isDeleted?: boolean; status?: string; updatedAt?: unknown };
      if (data.isDeleted === true || data.status === 'inactive') continue;

      let lastmod = todayIso;
      if (typeof data.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data.updatedAt)) {
        lastmod = data.updatedAt.slice(0, 10);
      }

      vehicleEntries.push({
        loc: `${BASE_URL}/cars/${encodeURIComponent(doc.id)}`,
        lastmod,
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    return { ok: true, entries: vehicleEntries };
  } catch (err) {
    console.warn(
      '[generate-sitemap] لم تُضف روابط السيارات:',
      err instanceof Error ? err.message : String(err)
    );
    return { ok: false, entries: [] };
  } finally {
    if (timer) clearTimeout(timer);
    if (appInstance) {
      await deleteApp(appInstance).catch(() => {});
    }
  }
}

async function main(): Promise<void> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const staticEntries: SitemapEntry[] = [
    { loc: `${BASE_URL}/`, lastmod: todayIso, changefreq: 'daily', priority: '1.0' },
    { loc: `${BASE_URL}/cars`, lastmod: todayIso, changefreq: 'daily', priority: '0.9' },
    { loc: `${BASE_URL}/contact`, lastmod: todayIso, changefreq: 'monthly', priority: '0.7' },
  ];

  const { ok, entries: vehicleEntries } = await fetchActiveVehicleEntries(todayIso);

  if (!ok && (await existingSitemapHasVehicleUrls())) {
    console.warn(
      '[generate-sitemap] لم تُضف روابط السيارات؛ تم الإبقاء على public/sitemap.xml الحالي لأنه يحتوي على روابط سيارات مسبقاً.'
    );
    return;
  }

  const xml = renderSitemapXml([...staticEntries, ...vehicleEntries]);
  await fs.writeFile(SITEMAP_PATH, xml, 'utf8');
  console.info(
    `[generate-sitemap] Wrote ${staticEntries.length + vehicleEntries.length} URLs (${vehicleEntries.length} vehicles) to public/sitemap.xml`
  );
}

main().catch((err) => {
  console.warn('[generate-sitemap] لم تُضف روابط السيارات (خطأ غير متوقع):', err);
  process.exit(0);
});
