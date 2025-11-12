// sw.js — cachea rutas y POIs, NO intercepta .pmtiles
const CACHE_NAME = 'primavera-cache-v17';

// === B) USAR VARIOS ARCHIVOS EN /routes_geojson ===
// Si usas individuales, pon la lista COMPLETA y QUITA la constante de A
const ROUTE_FILES = [
  './routes_geojson/1-2-mosca.geojson',
  './routes_geojson/arenosas.geojson',
  './routes_geojson/brujas.geojson',
  './routes_geojson/bosque-nutella.geojson',
  './routes_geojson/espinazo.geojson',
  './routes_geojson/by-pass-516314.geojson',
  './routes_geojson/extension-espinazo.geojson',
  './routes_geojson/huevona.geojson',
  './routes_geojson/mago-de-oz.geojson',
  './routes_geojson/pinitos-angel.geojson',
  './routes_geojson/relax.geojson',
  './routes_geojson/Ruta la catarina.geojson',
  './routes_geojson/toboganes-110689.geojson',
  './routes_geojson/torre-01.geojson',
  './routes_geojson/torre-03.geojson',
  './routes_geojson/vaca-muerta-rivers-combined.geojson'
];

const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './libs/openlocationcode.js',
  './data/pois.geojson'
  // OJO: NO metemos ./primavera.pmtiles aquí
];

// Construye la lista a precachear según la opción elegida
let PRECACHE = [...CORE];
// 👉 Deja UNA de estas dos líneas:

// PRECACHE.push(ONE_ROUTES_FILE);              // (A) 1 archivo fusionado
PRECACHE = [...CORE, ...ROUTE_FILES];     // (B) varios archivos

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ⚠️ No interceptar pmtiles ni glyphs (Range requests)
  if (url.pathname.endsWith('.pmtiles') || url.pathname.includes('/font/')) {
    return;
  }

  // Cache-first para rutas y POIs
  const isRoutes =
    url.pathname.endsWith('/data/routes.geojson') ||
    url.pathname.includes('/routes_geojson/');
  const isPois = url.pathname.endsWith('/data/pois.geojson');

  if (isRoutes || isPois) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;             // sirve offline
        try {
          const net = await fetch(event.request);
          if (net && net.ok) cache.put(event.request, net.clone());
          return net;
        } catch {
          // sin red y sin caché -> 404/placeholder simple
          return new Response('{}",',{ status: 200, headers: {'Content-Type':'application/json'} });
        }
      })
    );
    return;
  }

  // App shell (cache-first simple)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        try {
          if (event.request.method === 'GET' && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
        } catch {}
        return resp;
      });
    })
  );
});

