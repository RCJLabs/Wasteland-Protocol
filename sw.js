// Wasteland Protocol service worker.
// Bump CACHE on release so clients discard the previous build's assets.
const CACHE = 'wasteland-v2';

// Only the shell is precached. The game preloads its own art on boot, so the art set
// populates the cache at runtime on the first visit - which keeps this file from having
// to duplicate (and drift from) ASSET_LIST in index.html.
const SHELL = ['./', './index.html', './styles.css', './game.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The first visit loads its art before this worker controls the page, so those requests
// never reach the fetch handler. The page hands us its asset list once we are ready.
self.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_ART' || !Array.isArray(data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const url of data.urls) { if (!(await cache.match(url))) missing.push(url); }
    await Promise.allSettled(missing.map(url => cache.add(url)));
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Navigations go to the network first so a new build lands immediately; the cached
  // copy is the offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Art and everything else: cache first, filling the cache on first fetch.
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) { const cache = await caches.open(CACHE); cache.put(req, res.clone()); }
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
