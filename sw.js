const CACHE_NAME = 'primavera-cache-v12';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './libs/openlocationcode.js',
  './data/routes.geojson',
  './data/pois.geojson',
  './primavera.pmtiles' // precache completo para uso offline
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE_NAME?null:caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo aplicamos esto al archivo .pmtiles
  if (url.pathname.endsWith('.pmtiles')) {
    const range = req.headers.get('Range');

    // Si es una petición con Range -> devolvemos 206 desde el blob cacheado
    if (range) {
      event.respondWith((async () => {
        // 1) Obtén el archivo desde caché; si no está, descárgalo y guarda (primera carga online)
        const cache = await caches.open(CACHE_NAME);
        let resp = await cache.match('./primavera.pmtiles');
        if (!resp) {
          // intenta obtenerlo de la red y guardarlo
          const net = await fetch('./primavera.pmtiles');
          await cache.put('./primavera.pmtiles', net.clone());
          resp = net;
        }

        const blob = await resp.blob();
        const size = blob.size;

        // 2) Parsear encabezado Range: bytes=start-end?
        const m = /bytes=(\d+)-(\d+)?/.exec(range);
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = (m && m[2]) ? Math.min(Number(m[2]), size - 1) : size - 1;

        // 3) Cortar el blob y responder como 206 Partial Content
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
      return; // importante: ya respondimos
    }

    // Si NO es Range, dejamos pasar a tu estrategia habitual (cache-first / network-first)
    // (opcionalmente puedes responder desde caché aquí también)
  }

  // 👇 tu handler existente (cache-first o como lo tengas)
  // event.respondWith( ... );
});
