const prefix = `trocki-okey:${self.registration.scope}:`;
const cacheName = prefix + '1';
const assets = [
  './index.html', './style.css', './game.mjs', './rules.mjs', './install.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const cachedPaths = new Set(assets.map(asset => new URL(asset, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    assets.map(asset => new Request(asset, {cache: 'reload'}))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  const home = request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  if (home || cachedPaths.has(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(home ? './index.html' : request)) || fetch(request);
    })());
  }
});
