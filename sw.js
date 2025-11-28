// sw.js — PMTiles con HEAD/Range correctos y sin Content-Encoding
const CACHE_NAME = 'primavera-cache-v30';
const PRECACHE = [
  // App shell
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',

  // Librerías usadas por la app
  './libs/pmtiles.js',
  './libs/openlocationcode.js',

  // Datos
  './primavera.pmtiles',            // vector tiles offline
  //'./data/pois.geojson', // quitar?
  './data/paramedics.geojson',
  './data/checkpoints.geojson',

  // Glyphs (mínimos para español: latín básico + extendido)
  './fonts/Noto Sans Regular/0-255.pbf',
  './fonts/Noto Sans Regular/256-511.pbf',

  './routes_geojson/1-2-mosca.geojson',
  './routes_geojson/arenosas.geojson',
  './routes_geojson/brujas.geojson',
  './routes_geojson/by-pass-516314.geojson',
  './routes_geojson/espinazo.geojson',
  './routes_geojson/extension-espinazo.geojson',
  './routes_geojson/huevona.geojson',
  './routes_geojson/mago-de-oz.geojson',
  './routes_geojson/pinitos-angel.geojson',
  './routes_geojson/relax.geojson',
  './routes_geojson/toboganes-110689.geojson',
  './routes_geojson/torre-01.geojson',
  './routes_geojson/torre-03.geojson',
  './routes_geojson/vaca-muerta-rivers-combined.geojson',
  './routes_geojson/bosque-nutella.geojson',
  './routes_geojson/ruta-la-catarina.geojson'
  './manifest.json',

];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function getPmtilesBlob() {
  const cache = await caches.open(CACHE_NAME);
  let resp = await cache.match('./primavera.pmtiles');
  if (!resp) {
    const net = await fetch('./primavera.pmtiles', { cache: 'reload' });
    await cache.put('./primavera.pmtiles', net.clone());
    resp = net;
  }
  return await resp.blob();
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

    // 1) Glyphs locales: cache-first
  if (url.pathname.startsWith('/fonts/') || url.pathname.includes('/fonts/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      try {
        const net = await fetch(event.request);
        if (net.ok) cache.put(event.request, net.clone());
        return net;
      } catch {
        return hit || Response.error();
      }
    })());
    return;
  }
    // 2) PMTiles con HEAD/Range correctos
  if (url.pathname.endsWith('.pmtiles')) {
    const req = event.request;
    const method = req.method;
    const range = req.headers.get('Range');

    event.respondWith((async () => {
      const blob = await getPmtilesBlob();
      const size = blob.size;

      if (method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(size),
            'Accept-Ranges': 'bytes',
            'Content-Type': 'application/octet-stream'
          }
        });
      }

  // Intercepta SIEMPRE el pmtiles
 /* if (url.pathname.endsWith('/primavera.pmtiles') || url.pathname.endsWith('primavera.pmtiles')) {
   // const range = event.request.headers.get('Range');
   // const method = event.request.method;

    event.respondWith((async () => {
      const blob = await getPmtilesBlob();
      const size = blob.size; 

      if (method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(size),
            'Accept-Ranges': 'bytes',
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
          }
        });
      } */
  

      if (range) {
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
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable', //quitar
          }
        });
      }

      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable', //quitar?
        }
      });
    })());
    return;
  }

  // Cache-first para lo demás
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const net = await fetch(event.request);
      if (event.request.method === 'GET' && net.ok) {
        cache.put(event.request, net.clone());
      }
      return net;
    } catch {
      return cached || Response.error();
    }
  })());
});
