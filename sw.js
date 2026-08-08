// Study Manager — Service Worker
// Strategy:
//  - App shell (index.html, manifest, icons): network-first, falling back to
//    cache when offline. You're actively iterating on index.html, so this
//    always serves the latest version when online, and the last-known-good
//    version when offline.
//  - CDN dependencies (Font Awesome, Google Fonts, pdf.js): cache-first.
//    These are versioned/pinned URLs that never change content, so once
//    cached they're served instantly and never re-fetched. This also
//    transparently catches the *sub-resources* those stylesheets reference
//    (the actual .woff2 font files, pdf.worker.min.js, etc.) the first time
//    each is requested — no need to know their exact dynamic URLs in advance.
//
// Bump CACHE_VERSION whenever index.html (or anything in APP_SHELL) changes,
// so returning visitors pick up the update instead of a stale cached copy.
const CACHE_VERSION = 'v3';
const SHELL_CACHE = `study-manager-shell-${CACHE_VERSION}`;
const CDN_CACHE = `study-manager-cdn-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './icon-192-maskable-v2.png',
  './icon-512-maskable-v2.png',
  './apple-touch-icon-v2.png',
  './favicon-v2.ico',
];

// Known CDN entry points — precached up front so the very first offline
// visit (even before the user has opened every screen) already has icons,
// fonts, and the PDF library ready to go.
const CDN_SHELL = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
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
    // Cache each shell file individually (not addAll) — addAll is all-or-nothing,
    // so a single missing/renamed file (e.g. during the icon-path mixup earlier)
    // would silently void caching for every other file too. This way, one
    // failure only skips that one file.
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const res = await fetch(path);
        if (res && res.ok) await shellCache.put(path, res.clone());
      } catch (err) {
        console.warn('[sw] shell precache skipped:', path);
      }
    }));

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
