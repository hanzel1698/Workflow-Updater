/**
 * Caches the app shell so the dashboard opens with no network, the way the installed Android app
 * does. Live sheet requests always go to the network — offline data comes from the localStorage
 * snapshot written by js/cache.js, so a stale sheet response is never served from here.
 */

const CACHE_NAME = 'rdo-kkd-works-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './release_notes.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/config.js',
  './js/model.js',
  './js/state.js',
  './js/chipOrder.js',
  './js/prefs.js',
  './js/cache.js',
  './js/repository.js',
  './js/report.js',
  './js/viewmodel.js',
  './js/ui/chips.js',
  './js/ui/detailScreen.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/exportDialog.js',
  './js/ui/filterSheet.js',
  './js/ui/icons.js',
  './js/ui/mainScreen.js',
  './js/ui/pdfExport.js',
  './js/ui/profileSheet.js',
  './js/ui/pullToRefresh.js',
  './js/ui/setupScreen.js',
  './js/ui/sheet.js',
  './js/ui/statusTone.js',
  './js/ui/toast.js',
  './js/ui/whatsNew.js',
  './js/ui/workCard.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Apps Script / live sheet traffic

  // Network-first for release notes, so a new "What's New" is picked up on the next visit.
  if (url.pathname.endsWith('/release_notes.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (response.ok && response.type === 'basic') {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => caches.match('./index.html')),
    ),
  );
});
