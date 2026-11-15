/**
 * shared-net-offline/sw.js
 * ServiceWorker for Voxel.io offline-first play.
 * 
 * Caches:
 * - App shell: HTML, scripts, CSS
 * - Three.js engine and game bundles
 * - Audio files, icons, textures, voxel schematics
 * - Offline fallback page / index.html
 */

const CACHE_NAME = 'voxel-io-v1.0.0';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/favicon.svg',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[Voxel.io SW] Precache non-fatal error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first with network fallback and offline navigation support
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests and WebSocket / WebRTC streams
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset immediately
        return cachedResponse;
      }

      // Fetch from network, and store in dynamic cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Network failed (offline)
        // If navigating to a page, serve cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
