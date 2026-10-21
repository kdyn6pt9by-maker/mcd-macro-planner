// Offline support: the app keeps working when the network is down or blocks the site.
// Pages: network first, cached copy if offline. Build assets (/_next/static) are immutable: cache first.
const CACHE = "mcd-macro-v1";
// Works at the domain root (Vercel) or under a sub-path (GitHub Pages).
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const PAGES = ["/", "/?tab=mcd", "/?tab=log", "/progress/", "/stats/", "/spending/", "/settings/", "/quick/", "/manifest.json", "/icon-192.png"].map((p) => BASE + p);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(PAGES.map((p) => c.add(p)))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname === BASE + "/version.json") return;

  if (url.pathname.startsWith(BASE + "/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match(url.pathname).then((h) => h || caches.match(BASE + "/")))
      )
  );
});
