// sw.js — PMTiles offline con soporte de Range/HEAD correcto
const CACHE_NAME = 'primavera-cache-v22';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './libs/openlocationcode.js',
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

  // 1) Fuentes (glyphs) locales si las agregas después
  if (url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const resp = await fetch(event.request);
        cache.put(event.request, resp.clone());
        return resp;
      })
    );
    return;
  }

  // 2) PMTiles: HEAD / Range / GET normal
  if (url.pathname.endsWith('.pmtiles')) {
    const req = event.request;
    const method = req.method;
    const range = req.headers.get('Range');

    event.respondWith((async () => {
      const blob = await getPmtilesBlob();
      const size = blob.size;

      // HEAD: devolver sólo cabeceras, MapLibre usa esto para Content-Length
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

      // GET con Range -> 206 Partial Content con el slice exacto
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

      // GET sin Range: devolver el archivo completo (con Accept-Ranges)
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

  // 3) Cache-first simple para el resto
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const net = await fetch(event.request);
      // opcional: cachear assets GET navegables
      if (event.request.method === 'GET' && net.ok) {
        cache.put(event.request, net.clone());
      }
      return net;
    } catch {
      return cached || Response.error();
    }
  })());
});


