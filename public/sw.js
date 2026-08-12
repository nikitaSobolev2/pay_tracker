/* PayTracker service worker — network-first shell + travel/transactions GET. */
const CACHE = "paytracker-v7";
const FILE_CACHE = "paytracker-files-v1";
const OFFLINE_URL = "/offline.html";
const PDF_WORKER_URL = "/pdf.worker.min.mjs";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/logo.ico",
  "/icons/icon-192.png",
  PDF_WORKER_URL,
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

function isAppFile(url) {
  return url.pathname.startsWith("/api/files/");
}

function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) {
    return true;
  }
  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo.ico" ||
    url.pathname === OFFLINE_URL ||
    url.pathname === PDF_WORKER_URL ||
    url.pathname.startsWith("/icons/")
  ) {
    return true;
  }
  return false;
}

/** iframe/embed/object loads — never fall back to the app shell HTML. */
function isEmbeddedDocument(request) {
  return (
    request.destination === "iframe" ||
    request.destination === "embed" ||
    request.destination === "object"
  );
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

function fileUnavailableResponse() {
  return new Response("File unavailable offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
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

async function cacheFirstFile(request) {
  const cache = await caches.open(FILE_CACHE);
  const cached =
    (await cache.match(request)) ||
    (await cache.match(new URL(request.url).pathname));
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      void cache.put(request, response.clone());
    }
    return response;
  } catch {
    return fileUnavailableResponse();
  }
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

  // PDF/image iframe "navigate" must use the file cache — never the app shell.
  if (isTicketFile(url) || isAppFile(url)) {
    event.respondWith(cacheFirstFile(request));
    return;
  }

  if (request.mode === "navigate") {
    if (isEmbeddedDocument(request) || url.pathname.startsWith("/api/")) {
      event.respondWith(
        fetch(request).catch(() => fileUnavailableResponse()),
      );
      return;
    }
    event.respondWith(networkFirstNavigate(request));
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
