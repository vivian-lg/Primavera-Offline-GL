// sw.js — PMTiles offline con soporte de Range/HEAD correcto
const CACHE_NAME = 'primavera-cache-v23';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './libs/openlocationcode.js',
  // Nota: NO pongas aquí una string fija distinta a la request real,
  // el fetch usará la URL absoluta real y esa será la clave.
  './primavera.pmtiles'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k === CACHE_NAME ? null : caches.delete(k)));
    await self.clients.claim();
  })());
});

// Usa la MISMA request como clave de caché que llega en fetch
async function getPmtilesBlobForRequest(req) {
  const cache = await caches.open(CACHE_NAME);

  // 1) intentamos con la request exacta (URL absoluta con el subpath de GitHub Pages)
  let resp = await cache.match(req);

  // 2) fallback: por si en el PRECACHE quedó una ruta relativa tipo './primavera.pmtiles'
  if (!resp) {
    const rel = new Request('./primavera.pmtiles', { method: 'GET' });
    resp = await cache.match(rel);
  }

  // 3) si aún no está, la traemos de la red y la guardamos usando LA request exacta
  if (!resp) {
    const net = await fetch(req, { cache: 'reload' });
    await cache.put(req, net.clone());
    resp = net;
  }

  return await resp.blob();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Fuentes/glyphs locales (si luego las empaquetas). Usa includes o termina con .pbf
  if (url.pathname.includes('/fonts/') || url.pathname.endsWith('.pbf')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      const net = await fetch(req);
      if (req.method === 'GET' && net.ok) await cache.put(req, net.clone());
      return net;
    })());
    return;
  }

  // 2) PMTiles: HEAD / Range / GET normal con la misma clave de request
  if (url.pathname.endsWith('.pmtiles')) {
    event.respondWith((async () => {
      const blob = await getPmtilesBlobForRequest(req);
      const size = blob.size;

      // HEAD: MapLibre a veces lo usa para checar Content-Length
      if (req.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(size),
            'Accept-Ranges': 'bytes',
            'Content-Type': 'application/octet-stream'
          }
        });
      }

      const range = req.headers.get('Range');
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

      // GET completo sin Range
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

  // 3) Cache-first para el resto de assets
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      if (req.method === 'GET' && net.ok) {
        await cache.put(req, net.clone());
      }
      return net;
    } catch {
      return cached || Response.error();
    }
  })());
});


