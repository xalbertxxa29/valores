const CACHE_NAME = 'gestor-ofrecimientos-v8'; // Nueva versión para forzar la actualización
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'firebase-config.js',
  'manifest.json',
  'icon-192x192.jpeg' // Nombre del archivo corregido
];

// Instalar el Service Worker y guardar los archivos base en caché.
self.addEventListener('install', event => {
  // skipWaiting() fuerza al nuevo Service Worker a activarse inmediatamente.
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Cache abierto y guardando recursos base.');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activar y limpiar cachés antiguos.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => {
          console.log('Service Worker: Limpiando caché antiguo:', name);
          return caches.delete(name);
        })
      );
    })
  );
});

// Interceptar peticiones.
self.addEventListener('fetch', event => {
  // Las peticiones a Firebase siempre van a la red.
  if (event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Estrategia: Network Falling Back to Cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});