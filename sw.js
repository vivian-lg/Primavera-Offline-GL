const CACHE_NAME = 'primavera-cache-v1';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './data/routes.geojson',
  './data/pois.geojson'
  // Nota: más adelante añadiremos './primavera.pmtiles' cuando lo tengas
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE_NAME?null:caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached=>{
      if (cached) return cached;
      return fetch(req).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c=>c.put(req, copy));
        return resp;
      }).catch(()=>cached);
    })
  );
});
