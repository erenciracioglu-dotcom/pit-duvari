// Pit Duvari servis calisani: uygulama dosyalari onbellekten, veri once agdan (cevrimdisiyken son kopya).
const V = 'pd-v4';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'assets/app.css',
  'assets/js/main.js', 'assets/js/core/util.js', 'assets/js/core/i18n.js', 'assets/js/core/names.js', 'assets/js/core/store.js',
  'assets/js/core/data.js', 'assets/js/core/colors.js', 'assets/js/core/ui.js', 'assets/js/core/charts.js', 'assets/js/core/palette.js',
  'assets/js/views/home.js', 'assets/js/views/common.js', 'assets/js/views/news.js',
  'assets/fonts/archivo-latin-wdth-normal.woff2', 'assets/fonts/archivo-latin-ext-wdth-normal.woff2', 'assets/icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pd-') && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // OpenF1, Open-Meteo vb. dogrudan
  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  // uygulama dosyalari: onbellekten ver, arkada tazele
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => cached || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
    return cached || net;
  }));
});
