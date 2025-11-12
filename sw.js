// ⬅️ súbela cada vez que cambies el SW
const CACHE_NAME = 'primavera-cache-v16';

const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './libs/openlocationcode.js',
  './data/pois.geojson',
  './primavera.pmtiles', // precache completo para uso offline

  // Rutas (asegúrate que los nombres coincidan EXACTO con tus archivos)
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
  './routes_geojson/Ruta%20la%20catarina.geojson', // si tiene espacios, usa %20
  './routes_geojson/toboganes-110689.geojson',
  './routes_geojson/torre-01.geojson',
  './routes_geojson/torre-03.geojson',
  './routes_geojson/vaca-muerta-rivers-combined.geojson'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Glyphs locales -> cache-first
  if (url.pathname.includes('/fonts/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const resp = await fetch(req);
        cache.put(req, resp.clone());
        return resp;
      })
    );
    return;
  }

  // 2) PMTiles con soporte de Range (obligatorio para pmtiles.js)
  if (url.pathname.endsWith('.pmtiles')) {
    const range = req.headers.get('Range');

    // Peticiones parciales
    if (range) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        // intenta hacer match por la URL exacta de la request
        let resp = await cache.match(req);
        if (!resp) {
          // si no está en cache, intenta obtenerlo y guardarlo
          const net = await fetch(req);
          await cache.put(req, net.clone());
          resp = net;
        }

        const blob = await resp.blob();
        const size = blob.size;

        const m = /bytes=(\d+)-(\d+)?/.exec(range);
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = (m && m[2]) ? Math.min(Number(m[2]), size - 1) : size - 1;

        const chunk = blob.slice(start, end + 1);

        return new Response(chunk, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1),
            'Content-Type': 'application/octet-stream'
          }
        });
      })());
      return;
    }

    // Petición completa (sin Range) -> cache-first
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const resp = await fetch(req);
        cache.put(req, resp.clone());
        return resp;
      })
    );
    return;
  }

  // 3) Misma-origen GET -> cache-first sencillo (útil para tus .geojson, .js, .css)
  if (req.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          cache.put(req, resp.clone());
          return resp;
        } catch {
          // opcional: podrías devolver un fallback si es HTML
          return cached || new Response('Offline', { status: 503 });
        }
      })
    );
  }
});
