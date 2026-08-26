/**
 * Workflow Updater — service worker for the serverless web app.
 *
 * Keeps the dashboard shell available offline and lets the app boot instantly
 * on repeat visits. Google Apps Script traffic is never touched here: sheet
 * reads are cached by web-boot.js (localStorage) and sheet writes must always
 * hit the network.
 */

const BUILD = '1617caa87b';
const SHELL_CACHE = `wu-shell-${BUILD}`;
const FONT_CACHE = `wu-fonts-${BUILD}`;
const KEEP = [SHELL_CACHE, FONT_CACHE];

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './app.js',
  './web-boot.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Cache each asset individually so one 404 cannot fail the whole install.
      Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isFontRequest(url) {
  return FONT_HOSTS.includes(url.hostname);
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put('./index.html', response.clone());
    return response;
  } catch (err) {
    const cached =
      (await caches.match('./index.html', { ignoreSearch: true })) ||
      (await caches.match('./', { ignoreSearch: true }));
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const network = fetch(request)
    .then((response) => {
      // Opaque font responses (status 0) are still worth storing.
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await network;
  if (response) return response;
  throw new Error('Offline and no cached copy available');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // Everything cross-origin (Apps Script above all) goes straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
