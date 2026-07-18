// RoboTrack Service Worker (V9)
// Estratégia:
//  - HTML/navegação: NETWORK-FIRST -> o app sempre atualiza; cache é só fallback offline.
//  - Requisições cross-origin (Firebase / Firestore / gstatic): NÃO são interceptadas,
//    vão sempre à rede ao vivo. Isso é essencial para os saves na nuvem funcionarem.
//  - Todo same-origin (HTML, JS, CSS): NETWORK-FIRST -> nunca serve JS/CSS velho; cache é fallback offline.
const CACHE_NAME = 'robotrack-v9-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/css/styles.css',
  './src/model/data.js',
  './src/model/store.js',
  './src/model/firebase.js',
  './src/view/ui.js',
  './src/controller/controller.js'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // ativa a nova versão imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Cada arquivo é opcional: se um ícone não existir fisicamente, apenas ignora.
      Promise.all(urlsToCache.map(url =>
        fetch(url)
          .then(response => { if (response.ok) return cache.put(url, response); })
          .catch(() => console.log('PWA SW: arquivo pulado no cache:', url))
      ))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Nunca mexe em escritas (POST/PATCH/etc.) — deixa passar direto.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Requisições cross-origin (Firebase Auth, Firestore, gstatic CDN) vão SEMPRE à rede.
  // Interceptá-las ou cacheá-las quebraria login e sincronização de dados.
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').includes('text/html');

  // NETWORK-FIRST para todo same-origin (shell + módulos JS/CSS): sempre a versão mais
  // nova; cache é fallback offline. Evita ficar preso em JS/CSS antigos após um deploy.
  event.respondWith(
    fetch(req)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(req).then(r => r || (isNav ? caches.match('./index.html') : undefined)))
  );
});
