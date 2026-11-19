/* Service Worker for 象棋 PWA — offline-first strategy */
const CACHE_VERSION = "xiangqi-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles.css",
  "./src/main.js",
  "./src/storage.js",
  "./src/ui/board.js",
  "./src/engine/core.js",
  "./src/engine/game.js",
  "./src/engine/moves.js",
  "./src/engine/ai.js",
  "./src/engine/setup.js",
  "./src/engine/repetition.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

/* Install: pre-cache all static assets */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {
      /* Some assets may 404 on first deploy — ignore failures */
    }).then(() => self.skipWaiting())
  );
});

/* Activate: clean old caches */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Fetch: cache-first for static assets, fallback to network */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((resp) => {
          // Cache successful same-origin responses
          if (resp.ok && resp.type === "basic") {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
