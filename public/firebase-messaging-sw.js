// Firebase Cloud Messaging Service Worker for Shaker Car Rental
// Handles background notifications when app is not open or in background

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker dynamically from query params
try {
  const urlParams = new URLSearchParams(self.location.search);
  const projectId = urlParams.get('projectId');
  const apiKey = urlParams.get('apiKey');
  const authDomain = urlParams.get('authDomain');
  const messagingSenderId = urlParams.get('messagingSenderId');
  const appId = urlParams.get('appId');

  if (projectId && apiKey) {
    firebase.initializeApp({
      projectId,
      apiKey,
      authDomain: authDomain || `${projectId}.firebaseapp.com`,
      messagingSenderId: messagingSenderId || '',
      appId: appId || '',
    });
  }
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Init notice:', e);
}

try {
  const messaging = firebase.messaging();

  // Handle background push messages
  messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message: ', payload);
    
    const notificationTitle = payload?.notification?.title || payload?.data?.title || 'شركة شادي شاكر لتأجير السيارات';
    const notificationOptions = {
      body: payload?.notification?.body || payload?.data?.body || 'لديك إشعار جديد بخصوص حجزك أو حسابك.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      dir: 'rtl',
      lang: 'ar',
      data: payload?.data || {},
      actions: [
        { action: 'open_app', title: 'فتح التطبيق' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (msgErr) {
  // Silent fallback if messaging is unavailable
}

// Handle notification click to navigate to the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
