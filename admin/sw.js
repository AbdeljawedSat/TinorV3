// Service worker de la console TinOR : permet d'installer la console comme une
// application (Android : « Ajouter à l'écran d'accueil ») et de l'ouvrir sans
// réseau. Les appels à l'API (/api/...) ne sont JAMAIS mis en cache : les
// données affichées viennent toujours du serveur.
const CACHE = 'tinor-console-v1';
const FICHIERS = ['tinor_admin.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(c => c !== CACHE).map(c => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // Réseau d'abord (toujours la dernière version de la console), cache en secours hors ligne.
  e.respondWith(
    fetch(e.request)
      .then(rep => { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(e.request, copie)); return rep; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('tinor_admin.html')))
  );
});
