// === Mapa base OSM (temporal para depurar sin PMTiles) ===
const statusEl = document.getElementById('status');
const plusEl   = document.getElementById('pluscode');
function setStatus(t){ if(statusEl) statusEl.textContent = t; }

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap'
      }
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
  },
  center: [-103.60, 20.65],
  zoom: 12,
  maxZoom: 18
});

// === Cargar rutas (fusionadas) ===
// Asegúrate de tener data/routes.geojson en el repo y válido.
async function loadRoutes() {
  try {
    const res = await fetch('./data/routes.geojson', { cache: 'no-cache' });
    if (!res.ok) { setStatus('No encontré data/routes.geojson'); return; }
    const geo = await res.json();

    // Validación simple
    if (!geo || !geo.type) {
      setStatus('routes.geojson inválido'); return;
    }

    if (map.getSource('routes')) map.removeSource('routes');
    map.addSource('routes', { type: 'geojson', data: geo });

    // Línea base en rojo (luego haremos colores por ruta)
    if (map.getLayer('routes-line')) map.removeLayer('routes-line');
    map.addLayer({
      id: 'routes-line',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': '#e41a1c',
        'line-width': 3
      }
    });

    setStatus('Rutas cargadas');
  } catch (e) {
    console.error(e);
    setStatus('Error cargando rutas');
  }
}

// === GPS + Plus Code ===
let userMarker = null;
function showUser(lat, lon) {
  const lngLat = [lon, lat];
  if (!userMarker) {
    userMarker = new maplibregl.Marker({ color: '#198cff' }).setLngLat(lngLat).addTo(map);
  } else {
    userMarker.setLngLat(lngLat);
  }
  try {
    // OpenLocationCode disponible si cargaste la lib (local o CDN)
    plusEl.textContent = (typeof OpenLocationCode !== 'undefined')
      ? OpenLocationCode.encode(lat, lon, 10)
      : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch { /* noop */ }
}

document.getElementById('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    setStatus('Este dispositivo no tiene geolocalización'); return;
  }
  navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude } = pos.coords;
    showUser(latitude, longitude);
    setStatus('Ubicación actualizada');
  }, err => {
    setStatus('Activa permisos de ubicación/GPS');
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
});

// Carga rutas al iniciar el mapa
map.on('load', loadRoutes);
