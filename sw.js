// Word Coach Ultra — offline-first cache with AUTO-UPDATE (v2.0.0)
// - network-first for navigations so users always get the newest app
// - versioned cache so old files are cleaned automatically
// - tells the page when a new version is ready (skipWaiting + message)
const CACHE = 'wcu-v2.0.1';
const CORE = ['./', './index.html', './styles.css', './app.js', './words.js', './auth.js', './manifest.webmanifest',
  './sounds/ui-click.ogg', './sounds/ui-good.ogg', './sounds/ui-bad.ogg', './sounds/ui-coin.ogg', './sounds/ui-flip.ogg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => undefined), // never fail install on a transient fetch error
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'WCU_APP_UPDATED', cache: CACHE }))),
  );
});

self.addEventListener('message', (e) => {
  // The page asks the SW to skip waiting and activate the new version now.
  if (e.data && e.data.type === 'WCU_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never intercept API/auth calls or cross-origin requests.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/functions/') || url.pathname.startsWith('/auth')) return;

  // Navigations: network-first so the user sees the newest version promptly,
  // with a fast offline fallback to the cached shell.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  // Everything else: stale-while-revalidate (instant from cache, refresh in background).
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
