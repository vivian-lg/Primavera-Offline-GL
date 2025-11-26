// sw.js — PMTiles offline con soporte de Range/HEAD + glyphs + rutas/pois
const CACHE_NAME = 'primavera-cache-v23';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './libs/openlocationcode.js',
  './primavera.pmtiles',
  './fonts/Noto Sans Regular/0-255.pbf',
  './fonts/Noto Sans Regular/256-511.pbf',
  './data/pois.geojson'
  // Puedes agregar aquí rutas fijas si quieres precachearlas también
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k))))
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

  // 1) Glyphs locales (cache-first)
  if (url.pathname.includes('/fonts/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const net = await fetch(event.request);
      if (net.ok) cache.put(event.request, net.clone());
      return net;
    })());
    return;
  }

  // 2) PMTiles: HEAD / Range / GET
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
            'Content-Type': 'application/octet-stream'
          }
        });
      }

      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
          'Content-Type': 'application/octet-stream'
        }
      });
    })());
    return;
  }

  // 3) Rutas y POIs: cache-first
  if (url.pathname.includes('/routes_geojson/') || url.pathname.endsWith('/data/pois.geojson')) {
    event.respondWith((async () => {
      const c = await caches.open(CACHE_NAME);
      const hit = await c.match(event.request);
      if (hit) return hit;
      const net = await fetch(event.request);
      if (net.ok) c.put(event.request, net.clone());
      return net;
    })());
    return;
  }

  // 4) Resto: prefer cache y si no hay, red
  event.respondWith((async () => {
    const c = await caches.open(CACHE_NAME);
    const hit = await c.match(event.request);
    if (hit) return hit;
    try {
      const net = await fetch(event.request);
      if (event.request.method === 'GET' && net.ok) c.put(event.request, net.clone());
      return net;
    } catch {
      return hit || Response.error();
    }
  })());
});
