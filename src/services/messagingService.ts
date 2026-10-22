import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { messaging, firebaseConfig, isFirebaseConfigured, getDb } from '../firebase/config';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
  receivedAt: string;
}

class MessagingService {
  private currentToken: string | null = null;
  private messageListeners: Array<(payload: PushNotificationPayload) => void> = [];
  private notificationHistory: PushNotificationPayload[] = [];

  constructor() {
    this.initForegroundListener();
  }

  /**
   * Check if push messaging is supported in current client environment
   */
  public async isMessagingSupported(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }
    try {
      return await isSupported();
    } catch {
      return false;
    }
  }

  /**
   * Request user permission for browser push notifications
   */
  public async requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Get device FCM token and register Service Worker
   */
  public async getDeviceToken(userId?: string): Promise<string | null> {
    if (!isFirebaseConfigured || !messaging) {
      return null;
    }

    try {
      const supported = await this.isMessagingSupported();
      if (!supported) {
        return null;
      }

      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return null;
      }

      // Register or locate service worker with dynamic credentials
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          const swParams = new URLSearchParams({
            projectId: firebaseConfig.projectId || '',
            apiKey: firebaseConfig.apiKey || '',
            authDomain: firebaseConfig.authDomain || '',
            messagingSenderId: firebaseConfig.messagingSenderId || '',
            appId: firebaseConfig.appId || '',
          });
          const swUrl = `/firebase-messaging-sw.js?${swParams.toString()}`;
          swRegistration = await navigator.serviceWorker.register(swUrl, {
            scope: '/'
          });
        } catch (swErr) {
          console.warn('Service worker registration notice:', swErr);
        }
      }

      // Get FCM token from Firebase
      const token = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
      });

      if (token) {
        this.currentToken = token;
        if (import.meta.env.DEV) {
          console.info('✅ FCM Device Token acquired:', token.substring(0, 15) + '...');
        }

        // Save token to user profile in Firestore if signed in
        if (userId) {
          try {
            const activeDb = getDb();
            const userRef = doc(activeDb, 'users', userId);
            await updateDoc(userRef, {
              fcmTokens: arrayUnion(token),
              fcmLastUpdated: new Date().toISOString(),
            });
          } catch (updateErr) {
            console.warn('Could not save FCM token to Firestore user document:', updateErr);
          }
        }

        return token;
      }

      return null;
    } catch (err) {
      console.warn('Could not retrieve FCM token:', err);
      return null;
    }
  }

  /**
   * Setup foreground notification handler
   */
  private async initForegroundListener() {
    try {
      const supported = await this.isMessagingSupported();
      if (!supported || !messaging) return;

      onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'إشعار جديد';
        const body = payload.notification?.body || '';
        const item: PushNotificationPayload = {
          title,
          body,
          icon: payload.notification?.icon || '/icon.svg',
          data: payload.data,
          receivedAt: new Date().toISOString(),
        };

        this.notificationHistory.unshift(item);
        if (this.notificationHistory.length > 30) this.notificationHistory.pop();

        this.messageListeners.forEach((listener) => listener(item));

        // Show browser native notification if permitted
        if (Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: item.icon,
            });
          } catch {
            // Native notification constructor may fail in some iframe environments
          }
        }
      });
    } catch {
      // Foreground listener setup failed silently
    }
  }

  /**
   * Subscribe to incoming foreground notifications
   */
  public onMessage(callback: (payload: PushNotificationPayload) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== callback);
    };
  }

  /**
   * Send a local test push notification (for testing & demonstration in UI)
   */
  public simulateTestPush(title: string, body: string): PushNotificationPayload {
    const item: PushNotificationPayload = {
      title,
      body,
      icon: '/icon.svg',
      receivedAt: new Date().toISOString(),
    };
    this.notificationHistory.unshift(item);
    this.messageListeners.forEach((listener) => listener(item));

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/icon.svg' });
      } catch {}
    }

    return item;
  }

  public getCurrentToken(): string | null {
    return this.currentToken;
  }

  public getNotificationHistory(): PushNotificationPayload[] {
    return this.notificationHistory;
  }
}

export const messagingService = new MessagingService();
