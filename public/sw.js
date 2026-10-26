const CACHE = "jte-static-v105";
/** Runtime dish-cover cache — survives SW version bumps; not in deploy quota. */
const COVER_CACHE = "jte-covers-v1";
const KEEP = new Set([CACHE, COVER_CACHE]);
const PRECACHE = [
  "./manifest.webmanifest",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./apple-touch-icon.png",
  "./assets/ui/app-icon.png",
  /* Theme paper textures — avoid FOUC on switch / offline */
  "./assets/themes/cafe-paper.png",
  "./assets/themes/chalk-board.png",
  "./assets/themes/market-wash.png",
  "./assets/themes/midnight-paper.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  /* Do not skipWaiting here — page shows「有新版本 · 刷新」when waiting. */
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isHtmlOrJs(url) {
  const path = url.pathname;
  if (path.endsWith(".js") || path.endsWith(".mjs")) return true;
  if (path.endsWith(".html") || path.endsWith("/")) return true;
  if (/\/assets\/.+\.js$/i.test(path)) return true;
  return false;
}

function isDishCover(url) {
  const path = url.pathname;
  /* Real dish photos under assets/dishes/ (incl. web/ subfolder) — never Codex dish art. */
  return /\/assets\/dishes\//i.test(path);
}

function isStaticIcon(url) {
  const path = url.pathname;
  return (
    path.endsWith(".png") ||
    path.endsWith(".svg") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".webp") ||
    path.endsWith(".ico") ||
    path.endsWith("manifest.webmanifest")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("/manifest.webmanifest")) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  /* Dish covers: durable cache-first — avoid re-download when browsing offline. */
  if (isDishCover(url)) {
    event.respondWith(
      caches.open(COVER_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        }),
      ),
    );
    return;
  }

  if (isHtmlOrJs(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (isStaticIcon(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
