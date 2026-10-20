/* Sporty PWA Service Worker for Background Push & Offline Shell */
const CACHE_NAME = 'sporty-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch((err) => {
      console.warn('[ServiceWorker]: Pre-cache skipped for dynamic asset', err);
    }))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/index.html'))
  );
});

/* Handle Web Push & Firebase Cloud Messaging background notifications */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Sporty Score Update',
    body: 'A game you follow has a new score update.',
    tag: 'sporty-score-alert',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      const notification = parsed.notification || parsed.data || parsed;
      payload = {
        title: notification.title || payload.title,
        body: notification.body || payload.body,
        tag: notification.tag || parsed.data?.gameId || payload.tag,
        data: {
          url: parsed.data?.url || '/',
          gameId: parsed.data?.gameId || null,
          leagueId: parsed.data?.leagueId || null
        }
      };
    } catch (err) {
      console.warn('[ServiceWorker]: Push payload text fallback', err);
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag,
      renotify: true,
      data: payload.data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: event.notification.data
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
