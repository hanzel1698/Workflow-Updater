/**
 * Retires the editable dashboard's service worker. Browsers that installed the dashboard keep
 * serving it from cache until this file changes, so this version deletes the dashboard's caches,
 * unregisters itself and reloads any open dashboard window from the network — which now serves
 * index.html's redirect to the works viewer.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Only the dashboard's own caches: the works viewer shares this origin's cache storage.
      await Promise.all(keys.filter((key) => key.startsWith('wu-')).map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.navigate(self.registration.scope).catch(() => {}));
    })(),
  );
});
