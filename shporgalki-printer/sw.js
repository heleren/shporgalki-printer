const CACHE_NAME = 'shporgalki-v11';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/pdf-loader.js',
  './js/layout.js',
  './js/export.js',
  './js/vendor/pdf.min.js',
  './js/vendor/pdf.worker.min.js',
  './js/vendor/html2canvas.min.js',
  './js/vendor/jspdf.umd.min.js',
  './manifest.json',
  './assets/icons/icon.svg'
];

const ALL_RESOURCES = APP_SHELL;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ALL_RESOURCES);
    }).catch((err) => {
      console.error('Ошибка кэширования:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        return new Response('Нет подключения и ресурс не закэширован', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});
