// Coach Space Service Worker
const CACHE = 'cs-v2';
const STATIC = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/icon-180.png', '/timer-worker.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Сеть в первую очередь, кеш как запасной вариант
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // API не кешируем
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Push-уведомления (iOS 16.4+ PWA)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(
    data.title || '🏃 Coach Space',
    { body: data.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: 'cs-run', renotify: true }
  ));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
