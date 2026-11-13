import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel,
  Firestore
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import appletConfig from '../../firebase-applet-config.json';

// Type declarations for dynamically imported SDKs
type FirebaseStorage = import('firebase/storage').FirebaseStorage;
type Messaging = import('firebase/messaging').Messaging;
type Analytics = import('firebase/analytics').Analytics;
type AppCheck = import('firebase/app-check').AppCheck;

const env = import.meta.env;

const apiKey = env.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || '';
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || '';
const projectId = env.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || '';
const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || '';
const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || '';
const appId = env.VITE_FIREBASE_APP_ID || appletConfig?.appId || '';
const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID || (appletConfig as Record<string, unknown>)?.measurementId || 'G-15PLS5HCF8';
/**
 * Unified database ID configuration.
 * NOTE: VITE_FIREBASE_DATABASE_ID (or appletConfig.firestoreDatabaseId) must match DATABASE_ID
 * in functions/src/constants.ts ("ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1")
 * or be left empty to use default configuration.
 */
export const firestoreDatabaseId =
  env.VITE_FIREBASE_DATABASE_ID ||
  appletConfig?.firestoreDatabaseId ||
  'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1';

export const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
};

// Check if Firebase environment variables or config are provided
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.trim() !== '' &&
  firebaseConfig.apiKey !== 'MY_FIREBASE_API_KEY'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;
let messaging: Messaging | null = null;
let analytics: Analytics | null = null;
let appCheckInstance: AppCheck | null = null;
let appCheckInitPromise: Promise<AppCheck | null> | null = null;

export const waitAppCheckReady = async (timeoutMs = 2500): Promise<AppCheck | null> => {
  if (appCheckInstance) return appCheckInstance;
  if (!appCheckInitPromise) return null;
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([appCheckInitPromise, timeout]);
  } catch {
    return null;
  }
};

if (isFirebaseConfigured) {
  try {
    const existingApps = getApps();
    app = existingApps && existingApps.length > 0 && existingApps[0] ? existingApps[0] : initializeApp(firebaseConfig);

    // Initialize App Check immediately in browser (not in requestIdleCallback)
    const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY || appletConfig?.recaptchaSiteKey || '';
    if (typeof window !== 'undefined') {
      if (recaptchaSiteKey) {
        appCheckInitPromise = import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
          try {
            appCheckInstance = initializeAppCheck(app!, {
              provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
              isTokenAutoRefreshEnabled: true,
            });
            if (import.meta.env.DEV) {
              console.log('[Firebase App Check] تم تفعيل Firebase App Check بنجاح.');
            }
            return appCheckInstance;
          } catch (appCheckErr) {
            console.warn('[Firebase App Check] Initialization issue:', appCheckErr);
            return null;
          }
        }).catch((err) => {
          console.warn('[Firebase App Check] Module import error:', err);
          return null;
        });
      } else if (import.meta.env.PROD) {
        console.error('[Firebase App Check ERROR] VITE_RECAPTCHA_SITE_KEY is missing in production environment!');
      }
    }

    auth = getAuth(app);

    // Suppress Firestore verbose connection failure and retry warnings in console
    try {
      setLogLevel('silent');
    } catch {
      // Ignore if not supported
    }

    const customDbId = firestoreDatabaseId && firestoreDatabaseId !== '(default)' ? firestoreDatabaseId : undefined;

    // Initialize Firestore with resilient cache and auto-recovery
    try {
      const primarySettings = {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      };
      if (customDbId) {
        db = initializeFirestore(app, primarySettings, customDbId);
      } else {
        db = initializeFirestore(app, primarySettings);
      }
    } catch {
      try {
        const fallbackMemorySettings = {
          experimentalAutoDetectLongPolling: true,
          localCache: memoryLocalCache()
        };
        db = customDbId ? initializeFirestore(app, fallbackMemorySettings, customDbId) : initializeFirestore(app, fallbackMemorySettings);
      } catch {
        db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);
      }
    }

    // Firebase Cloud Functions
    try {
      functions = getFunctions(app, 'asia-south1');
    } catch {
      try {
        functions = getFunctions(app);
      } catch (e) {
        console.warn('Firebase Functions initialization issue:', e);
      }
    }

    if (import.meta.env.DEV) {
      console.info(`[Firebase Config] projectId: ${projectId}, firestoreDatabaseId: ${firestoreDatabaseId || '(default)'}`);
      console.info('✅ Firebase Core Services initialized for project:', firebaseConfig.projectId, customDbId ? `[db: ${customDbId}]` : '');
    }
  } catch (error) {
    console.warn('⚠️ Failed to initialize Firebase SDK. Falling back to local offline mode:', error);
  }
} else {
  if (import.meta.env.DEV) {
    console.info('ℹ️ Running in Local Persistent Storage mode. Provide VITE_FIREBASE_* environment variables or firebase-applet-config.json to connect live Firebase.');
  }
}

// Promises for lazy loaded services
let storagePromise: Promise<FirebaseStorage | null> | null = null;
export const getStorageInstance = async (): Promise<FirebaseStorage | null> => {
  if (storage) return storage;
  if (!isFirebaseConfigured || !app) return null;
  if (!storagePromise) {
    storagePromise = (async () => {
      try {
        const { getStorage } = await import('firebase/storage');
        storage = getStorage(app!);
        return storage;
      } catch (e) {
        console.warn('Firebase Storage initialization issue:', e);
        return null;
      }
    })();
  }
  return storagePromise;
};

let messagingPromise: Promise<Messaging | null> | null = null;
export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (messaging) return messaging;
  if (!isFirebaseConfigured || !app || typeof window === 'undefined') return null;
  if (!messagingPromise) {
    messagingPromise = (async () => {
      try {
        const { getMessaging, isSupported } = await import('firebase/messaging');
        const supported = await isSupported().catch(() => false);
        if (supported && app && 'serviceWorker' in navigator) {
          messaging = getMessaging(app);
          if (import.meta.env.DEV) {
            console.info('✅ Firebase Cloud Messaging initialized successfully');
          }
          return messaging;
        }
      } catch (msgErr) {
        console.warn('Firebase Messaging setup notice:', msgErr);
      }
      return null;
    })();
  }
  return messagingPromise;
};

let analyticsPromise: Promise<Analytics | null> | null = null;
export const getAnalyticsInstance = async (): Promise<Analytics | null> => {
  if (analytics) return analytics;
  if (!isFirebaseConfigured || !app) return null;
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        const { getAnalytics, isSupported } = await import('firebase/analytics');
        const supported = await isSupported().catch(() => false);
        if (supported && app) {
          analytics = getAnalytics(app);
          if (import.meta.env.DEV) {
            console.info('✅ Firebase Analytics initialized successfully with measurementId:', measurementId);
          }
          return analytics;
        }
      } catch (analyticsErr) {
        console.warn('Firebase Analytics setup notice:', analyticsErr);
      }
      return null;
    })();
  }
  return analyticsPromise;
};

export const getAppCheckInstance = async (): Promise<AppCheck | null> => {
  return appCheckInstance;
};

// Schedule background initialization after first render via requestIdleCallback (with setTimeout fallback)
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  const scheduleIdle = (task: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback(task, { timeout: 3000 });
    } else {
      setTimeout(task, 1000);
    }
  };
  scheduleIdle(() => {
    getStorageInstance();
    getAnalyticsInstance();
    getMessagingInstance();
  });
}

/**
 * Returns the active Firestore instance, auto-recovering if it was terminated or uninitialized.
 */
export const getDb = (): Firestore => {
  const customDbId = firestoreDatabaseId && firestoreDatabaseId !== '(default)' ? firestoreDatabaseId : undefined;
  if (!app) {
    const existingApps = getApps();
    app = existingApps && existingApps.length > 0 && existingApps[0] ? existingApps[0] : initializeApp(firebaseConfig);
  }
  if (!db || (db as unknown as { _isTerminated?: boolean })._isTerminated) {
    try {
      db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);
    } catch {
      try {
        const fallbackMemorySettings = {
          experimentalAutoDetectLongPolling: true,
          localCache: memoryLocalCache()
        };
        db = customDbId ? initializeFirestore(app, fallbackMemorySettings, customDbId) : initializeFirestore(app, fallbackMemorySettings);
      } catch {
        db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);
      }
    }
  }
  return db!;
};

export { app, auth, db, storage, functions, messaging, analytics, appCheckInstance };
