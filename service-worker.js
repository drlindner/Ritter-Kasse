const CACHE_NAME = "ritter-kasse-20260701-003";

// index.html wird bewusst NICHT gecached.
// Dadurch bleibt die App künftig nicht dauerhaft auf einer alten index.html hängen.
const CORE_ASSETS = [
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./version.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith("ritter-kasse-") && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigation und index.html immer frisch aus dem Netz holen.
  if (request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // Metadaten ebenfalls frisch bevorzugen.
  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("/manifest.json")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Statische Dateien: Cache zuerst, dann Netz.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
