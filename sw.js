/* Service worker : pseudo-PWA.
   - mise en cache du "shell" (pages + CSS + JS) à l'installation
   - navigation : réseau d'abord, repli sur la copie en cache (hors ligne)
   - css/js/png : cache d'abord
   - jamais de cache sur /proxy (vidéos) ni sur les ressources externes. */
const V = "sn-v1";
const CORE = [
  "/index.html",
  "/favoris.html",
  "/historique.html",
  "/parametres.html",
  "/mentions-legales.html",
  "/movie.html",
  "/css/style.css",
  "/js/data.js",
  "/js/accounts.js",
  "/js/app.js",
  "/js/home.js",
  "/js/parametres.js",
  "/js/player.js",
  "/js/detail.js",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/proxy")) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(V).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (/\/css\/|\/js\/|\.png$|\.webmanifest/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(V).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});