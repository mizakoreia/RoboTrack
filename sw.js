// RoboTrack Service Worker (V9)
// Estratégia:
//  - HTML/navegação: NETWORK-FIRST -> o app sempre atualiza; cache é só fallback offline.
//  - Requisições cross-origin (Firebase / Firestore / gstatic): NÃO são interceptadas,
//    vão sempre à rede ao vivo. Isso é essencial para os saves na nuvem funcionarem.
//  - Assets estáticos same-origin: cache-first para carregamento rápido offline.
const CACHE_NAME = 'robotrack-v9-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
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

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // NETWORK-FIRST: busca a versão mais recente do app; usa cache só se offline.
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // CACHE-FIRST para outros assets estáticos same-origin.
  event.respondWith(caches.match(req).then(r => r || fetch(req)));
});
