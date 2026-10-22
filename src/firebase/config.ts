import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
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
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getMessaging, Messaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import { getAnalytics, Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import appletConfig from '../../firebase-applet-config.json';

const env = import.meta.env;

const apiKey = env.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || '';
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || '';
const projectId = env.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || '';
const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || '';
const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || '';
const appId = env.VITE_FIREBASE_APP_ID || appletConfig?.appId || '';
const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID || (appletConfig as any)?.measurementId || 'G-15PLS5HCF8';
export const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || appletConfig?.firestoreDatabaseId || '';

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
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let messaging: Messaging | null = null;
let analytics: Analytics | null = null;
let appCheckInstance: ReturnType<typeof initializeAppCheck> | null = null;

if (isFirebaseConfigured) {
  try {
    const existingApps = getApps();
    app = existingApps && existingApps.length > 0 && existingApps[0] ? existingApps[0] : initializeApp(firebaseConfig);

    // Firebase App Check with reCAPTCHA Enterprise
    const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY || appletConfig?.recaptchaSiteKey || '6Le-GMItAAAAAJQeoGFLzB7crB0JgnkL_eLkNYY5';

    if (typeof window !== 'undefined') {
      try {
        appCheckInstance = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
        console.log('[Firebase App Check] تم تفعيل Firebase App Check بنجاح باستخدام reCAPTCHA Enterprise.');
      } catch (appCheckErr) {
        console.warn('[Firebase App Check] Initialization issue:', appCheckErr);
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

    // Firebase Storage
    try {
      storage = getStorage(app);
    } catch (storageErr) {
      console.warn('Firebase Storage initialization issue:', storageErr);
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

    // Firebase Analytics (Guarded by isSupported for browser/iframe environments)
    isAnalyticsSupported().then((supported) => {
      if (supported && app) {
        try {
          analytics = getAnalytics(app);
          if (import.meta.env.DEV) {
            console.info('✅ Firebase Analytics initialized successfully with measurementId:', measurementId);
          }
        } catch (analyticsErr) {
          console.warn('Firebase Analytics setup notice:', analyticsErr);
        }
      }
    }).catch(() => {
      // Analytics unsupported in this specific runtime
    });

    // Firebase Cloud Messaging (Guarded by isSupported for environments with Notification & SW support)
    isMessagingSupported().then((supported) => {
      if (supported && app && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          messaging = getMessaging(app);
          if (import.meta.env.DEV) {
            console.info('✅ Firebase Cloud Messaging initialized successfully');
          }
        } catch (msgErr) {
          console.warn('Firebase Messaging setup notice:', msgErr);
        }
      }
    }).catch(() => {
      // Messaging unsupported in this specific environment
    });

    if (import.meta.env.DEV) {
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

/**
 * Returns the active Firestore instance, auto-recovering if it was terminated or uninitialized.
 */
export const getDb = (): Firestore => {
  const customDbId = firestoreDatabaseId && firestoreDatabaseId !== '(default)' ? firestoreDatabaseId : undefined;
  if (!app) {
    const existingApps = getApps();
    app = existingApps && existingApps.length > 0 && existingApps[0] ? existingApps[0] : initializeApp(firebaseConfig);
  }
  if (!db || (db as any)._isTerminated) {
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


