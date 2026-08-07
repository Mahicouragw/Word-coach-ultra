// Word Coach Ultra v4.0 Pro — offline-first with AUTO-UPDATE
// Real dictionary 682 words, fuzzy search, voice, SRS, achievements, offline cache
const CACHE = 'wcu-v4.0.1';
const CORE = [
  './', './index.html', './styles.css', './app.js', './words.js', './auth.js', './manifest.webmanifest',
  './js/utils.js', './js/storage.js', './js/search.js', './js/audio.js', './js/achievements.js', './js/srs.js',
  './sounds/ui-click.ogg', './sounds/ui-good.ogg', './sounds/ui-bad.ogg', './sounds/ui-coin.ogg', './sounds/ui-flip.ogg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
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
  if (e.data && e.data.type === 'WCU_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/functions/') || url.pathname.startsWith('/auth')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(()=>{});
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit)=> hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res)=>{
          if (res && res.ok){
            const copy=res.clone();
            caches.open(CACHE).then((c)=>c.put(e.request, copy)).catch(()=>{});
          }
          return res;
        })
        .catch(()=> cached);
      return cached || network;
    })
  );
});
