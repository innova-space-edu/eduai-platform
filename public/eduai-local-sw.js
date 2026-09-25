const CACHE_PREFIX = "eduai-local-shell-";
const CACHE_NAME = CACHE_PREFIX + "v1";
const CORE_URLS = [
  "/local-ai/offline",
  "/eduai-local/wllama.wasm",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

async function cacheSafeUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  for (const raw of urls) {
    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin !== self.location.origin) continue;
      if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/admin/")
      ) {
        continue;
      }
      if (
        url.pathname !== "/local-ai/offline" &&
        !url.pathname.startsWith("/_next/static/") &&
        !url.pathname.startsWith("/eduai-local/")
      ) {
        continue;
      }
      const response = await fetch(url.toString(), { credentials: "same-origin" });
      if (response.ok) await cache.put(url.toString(), response.clone());
    } catch {
      // La preparación offline es best-effort.
    }
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(cacheSafeUrls(event.data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) return;

  if (request.mode === "navigate" && url.pathname === "/local-ai/offline") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/local-ai/offline", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/local-ai/offline");
          return cached || Response.error();
        }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/eduai-local/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        });
      }),
    );
  }
});
