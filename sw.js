const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon.ico',
];  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
];

const CDN_ORIGINS = [
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shellCache = await caches.open(SHELL_CACHE);
    await shellCache.addAll(APP_SHELL).catch(err => console.warn('[sw] shell precache partial failure', err));

    const cdnCache = await caches.open(CDN_CACHE);
    // Fetch CDN entries individually (not addAll) so one failure — e.g. no
    // network on first install — doesn't abort caching the rest.
    await Promise.all(CDN_SHELL.map(async url => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res && res.ok) await cdnCache.put(url, res.clone());
      } catch (err) {
        console.warn('[sw] CDN precache skipped (offline during install):', url);
      }
    }));

    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== SHELL_CACHE && key !== CDN_CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isCdnRequest(url) {
  return CDN_ORIGINS.some(origin => url.startsWith(origin));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept writes

  const url = req.url;

  // ── CDN assets: cache-first (they're pinned/versioned, content never changes) ──
  if (isCdnRequest(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req, { mode: req.mode === 'navigate' ? 'same-origin' : 'cors' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        // Truly offline and never cached — let it fail; the app's own
        // Unicode icon fallback and system-font fallback take over from here.
        throw err;
      }
    })());
    return;
  }

  // ── App shell (same-origin): network-first, falling back to cache ──
  if (url.startsWith(self.location.origin)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        // Navigations fall back to the cached app shell (SPA-style)
        if (req.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        throw err;
      }
    })());
  }
});
