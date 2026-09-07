const CACHE = 'sdhz-v1';
const ASSETS = ['index.html', '工作汇总.html', '周总结.html', 'icon.png', 'manifest.webmanifest', 'sw.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: daily use works fully offline
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Normalize: root or /index.html -> index.html; otherwise the app file name
    const path = url.pathname;
    let target = 'index.html';
    if (!(path.endsWith('/') || path.endsWith('/index.html'))) {
      target = path.split('/').pop();
    }
    e.respondWith(
      caches.match(target).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(target, copy));
          return res;
        });
      })
    );
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});

// On-demand update: re-fetch everything from network into cache, then tell the page
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'UPDATE') return;
  e.waitUntil((async () => {
    try {
      const c = await caches.open(CACHE);
      for (const a of ASSETS) {
        const res = await fetch(a, { cache: 'no-store' });
        if (res && res.ok) await c.put(a, res.clone());
      }
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const cl of clients) cl.postMessage({ type: 'UPDATED' });
    } catch (err) {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const cl of clients) cl.postMessage({ type: 'UPDATE_FAILED' });
    }
  })());
});