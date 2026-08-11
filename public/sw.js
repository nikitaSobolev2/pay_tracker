/* PayTracker service worker — network-first shell + travel/transactions GET. */
const CACHE = "paytracker-v5";
const FILE_CACHE = "paytracker-files-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/logo.ico",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key !== FILE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiGetCacheable(url) {
  if (url.pathname === "/api/travels" || url.pathname.startsWith("/api/travels/")) {
    return true;
  }
  if (
    url.pathname === "/api/transactions" ||
    url.pathname.startsWith("/api/transactions/")
  ) {
    return true;
  }
  return false;
}

function isTicketFile(url) {
  return url.pathname.startsWith("/api/files/travel-ticket/");
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) {
    return true;
  }
  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo.ico" ||
    url.pathname === OFFLINE_URL ||
    url.pathname.startsWith("/icons/")
  ) {
    return true;
  }
  return false;
}

async function offlineFallback() {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(OFFLINE_URL);
  if (cached) {
    return cached;
  }
  return new Response(
    "<!doctype html><title>Offline</title><h1>You're offline</h1><p>No internet connection.</p>",
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function networkFirstNavigate(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      void cache.put(request, response.clone());
    }
    return response;
  } catch {
    const exact = await cache.match(request);
    if (exact) {
      return exact;
    }
    const url = new URL(request.url);
    const byPath = await cache.match(url.pathname);
    if (byPath) {
      return byPath;
    }
    // Prefer a previously opened locale home over the static offline page.
    for (const path of ["/en", "/ru", "/"]) {
      const home = await cache.match(path);
      if (home) {
        return home;
      }
    }
    return offlineFallback();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === "basic") {
      void cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(FILE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && response.status === 200) {
    void cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  if (isTicketFile(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isApiGetCacheable(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
