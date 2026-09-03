// IMPORTANT: Changez ce numéro à CHAQUE déploiement pour forcer la mise à jour du cache
const CACHE_VERSION = 'v3';
const CACHE_NAME = `bongasoil-cache-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/sample_data.js',
  '/manifest.json',
  '/icon.svg'
];

// Installation : mettre en cache les fichiers de base
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force l'activation immédiate de la nouvelle version
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activation : supprimer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
             .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie : Network First pour HTML/JS (toujours la dernière version si en ligne)
// Cache First pour le reste (rapide, fonctionne offline)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pour les fichiers JS/HTML : essayer le réseau d'abord, sinon cache
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Pour le reste (CSS, images) : cache d'abord
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
