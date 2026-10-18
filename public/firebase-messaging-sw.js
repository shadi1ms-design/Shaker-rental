// Firebase Cloud Messaging Service Worker for Shaker Car Rental

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

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
  // Silent catch
}

try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    const notificationTitle = payload?.notification?.title || payload?.data?.title || 'شركة شاكر لتأجير السيارات';
    const deepLinkUrl = payload?.data?.url || '/';

    const notificationOptions = {
      body: payload?.notification?.body || payload?.data?.body || 'لديك إشعار جديد بخصوص حجزك أو حسابك.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      dir: 'rtl',
      lang: 'ar',
      data: {
        ...(payload?.data || {}),
        url: deepLinkUrl,
      },
      actions: [
        { action: 'open_app', title: 'فتح التطبيق' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (msgErr) {
  // Silent fallback
}

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
