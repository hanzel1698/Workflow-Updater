/**
 * Caches the app shell so the dashboard opens with no network, the way the installed Android app
 * does. Live sheet requests always go to the network — offline data comes from the localStorage
 * snapshot written by js/cache.js, so a stale sheet response is never served from here.
 */

// Namespaced because everything on this origin shares one cache storage, including what is left
// of the retired dashboard at /app/. Each app must only ever reap its own generations.
const CACHE_PREFIX = 'rdo-kkd-works-';
const CACHE_NAME = `${CACHE_PREFIX}v9`;

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
  './js/bulkReports.js',
  './js/excelImport.js',
  './js/pdfDocument.js',
  './js/vendor.js',
  './js/config.js',
  './js/model.js',
  './js/state.js',
  './js/chipOrder.js',
  './js/prefs.js',
  './js/cache.js',
  './js/repository.js',
  './js/report.js',
  './js/viewmodel.js',
  './js/ui/bulkScreen.js',
  './js/ui/chips.js',
  './js/ui/detailScreen.js',
  './js/ui/deviceLayout.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/exportDialog.js',
  './js/ui/filterSheet.js',
  './js/ui/icons.js',
  './js/ui/mainScreen.js',
  './js/ui/pdfExport.js',
  './js/ui/profileSheet.js',
  './js/ui/saveFiles.js',
  './js/ui/pullToRefresh.js',
  './js/ui/setupScreen.js',
  './js/ui/sheet.js',
  './js/ui/statusTone.js',
  './js/ui/theme.js',
  './js/ui/toast.js',
  './js/ui/whatsNew.js',
  './js/ui/workCard.js',
];
// The Excel screen's libraries (vendor/, ~750 KB) are left out: most visits never open that
// screen, and the stale-while-revalidate handler below keeps them once it has been opened.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache each asset individually so one 404 cannot fail the whole install.
        Promise.allSettled(APP_SHELL.map((asset) => cache.add(asset))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
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

  // Stale-while-revalidate: open instantly from the saved shell, and refresh it behind the scenes
  // so the next visit picks up a new release without waiting for a cache version bump.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      if (cached) return cached;
      return (await network) || (await cache.match('./index.html')) || Response.error();
    }),
  );
});
