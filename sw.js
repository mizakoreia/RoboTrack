const CACHE_NAME = 'robotrack-v8-cache-v1';
const urlsToCache = [
  './Software_RoboTrack_V8.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // O cache.addAll() faz as requisições das rotas informadas e as guarda se baseando no offline.
        // Usamos catch para não estourar caso os icones.png não existam fisicamente nesta pasta ainda.
        urlsToCache.forEach(url => {
          fetch(url).then(response => {
            if (response.ok) cache.put(url, response);
          }).catch(e => console.log('Log PWA Arquivo Pulado:', url));
        });
      })
      .catch(err => console.log('PWA SW: Falha ao carregar cache estático', err))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna o payload em cache se houver, se não, tenta puxar da rede. 
        // Garante 100% de estabilidade offline para o arquivo HTML base e arquivos secundários.
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
