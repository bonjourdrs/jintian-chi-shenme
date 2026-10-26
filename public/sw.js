// Build replaces these constants with the exact application shell and revision.
const NAMESPACE = `jte-${encodeURIComponent(new URL(self.registration.scope).pathname)}-`;
const CACHE = `${NAMESPACE}static-__BUILD_ID__`;
const PRECACHE = [];
const COVER_CACHE = `${NAMESPACE}covers-v2`;
const COVER_LIMIT = 240;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([CACHE, COVER_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(NAMESPACE) && !keep.has(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function coverResponse(request) {
  const cache = await caches.open(COVER_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    try {
      await cache.delete(request);
      await cache.put(request, cached.clone());
    } catch { /* Keep serving the cached copy if storage is full. */ }
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    try {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - COVER_LIMIT)).map((key) => cache.delete(key)));
    } catch { /* Return the network image even when cache quota is exhausted. */ }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (url.pathname.endsWith("/sw.js")) return;
  event.respondWith((async () => {
    if (/\/assets\/dishes\//i.test(url.pathname)) return coverResponse(request);
    const cache = await caches.open(CACHE);
    if (request.mode === "navigate") {
      return (await cache.match(new URL("index.html", self.registration.scope).href)) || fetch(request);
    }
    // Module requests send Origin, while install-time precache requests may not.
    // These are public build assets; Vite's Vary: Origin must not break offline matching.
    return (await cache.match(request, { ignoreVary: true })) || fetch(request);
  })());
});
