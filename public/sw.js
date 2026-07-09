// Bump CACHE_VERSION bij elke app-wijziging: de gewijzigde bytes zorgen dat de
// browser een nieuwe service worker detecteert, die dankzij skipWaiting +
// clients.claim de controle overneemt, waarna de client automatisch herlaadt
// (zie PWARegister.tsx). Zo hoeft de gebruiker nooit handmatig te verversen.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `sportcoach-${CACHE_VERSION}`;

// Install - cache shell en meteen activeren (niet wachten op sluiten van tabs)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/schema',
        '/checkin',
        '/coach',
        '/manifest.json',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate - oude caches opruimen en de controle over open clients overnemen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and API requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
