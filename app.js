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

const ROUTES = [
  { id:'catarina',   name:'Ruta la catarina', file:'routes_geojson/Ruta la catarina.geojson' },
  { id:'huevona',    name:'Huevona',           file:'routes_geojson/huevona.geojson' },
  { id:'bypass',     name:'By Pass',           file:'routes_geojson/by-pass-516314.geojson' },
  { id:'espinazo',   name:'Espinazo',          file:'routes_geojson/espinazo.geojson' },
  { id:'nutella',    name:'Bosque Nutella',    file:'routes_geojson/bosque-nutella.geojson' },
  { id:'vaca',       name:'Vaca Muerta (Rivers Combined)', file:'routes_geojson/vaca-muerta-rivers-combined.geojson' },
  { id:'torre03',    name:'Torre 03',          file:'routes_geojson/torre-03.geojson' },
  { id:'mosca',      name:'1-2 Mosca',         file:'routes_geojson/1-2-mosca.geojson' },
  { id:'arenosas',   name:'Arenosas',          file:'routes_geojson/arenosas.geojson' },
  { id:'brujas',     name:'Brujas',            file:'routes_geojson/brujas.geojson' },
  { id:'extensionespinazo', name:'Extension Espinazo', file:'routes_geojson/extension-espinazo.geojson' },
  { id:'magodeoz',   name:'Mago de Oz',        file:'routes_geojson/mago-de-oz.geojson' },
  { id:'pinitosangel', name:'Pinitos Angel',   file:'routes_geojson/pinitos-angel.geojson' },
  { id:'relax',      name:'Relax',             file:'routes_geojson/relax.geojson' },
  { id:'toboganes',  name:'Toboganes',         file:'routes_geojson/toboganes-110689.geojson' },
  { id:'torre01',    name:'Torre 01',          file:'routes_geojson/torre-01.geojson' }
];

const ROUTE_COLORS = {
  catarina:  '#377eb8',
  huevona:   '#e41a1c',
  bypass:    '#4daf4a',
  espinazo:  '#984ea3',
  nutella:   '#ff7f00',
  vaca:      '#a65628',
  torre03:   '#f781bf',
  mosca: "#8dd3c7",
  arenosas: "#999999",
  brujas:  "#66c2a5",
  extensionespinazo: "#fc8d62",
  magodeoz: "#1b9e77",
  pinitosangel: "#d95f02",
  relax: "#7570b3",
  toboganes: "#e7298a",
  torre01: "#66a61e"
};
function colorFor(id){ return ROUTE_COLORS[id] || '#8dd3c7'; }

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
    plusEl.textContent = (typeof OpenLocationCode !== 'undefined')
      ? OpenLocationCode.encode(lat, lon, 10)
      : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {}
}

// ---- Seguirme / UI ----
let followMe = false;
let hadFirstFix = false;
function setGuide(text){ 
  const el = document.getElementById('guide'); 
  if (el) el.textContent = text || '—';
}
function updateFollowUI(){
  const b = document.getElementById('btn-follow');
  if (!b) return;
  b.textContent = followMe ? '🧭 Seguirme: ON' : '🧭 Seguirme: OFF';
  b.style.opacity = followMe ? '1' : '0.85';
}
document.getElementById('btn-follow')?.addEventListener('click', ()=>{
  followMe = !followMe;
  updateFollowUI();
  if (followMe && lastPos){
    map.setCenter([lastPos.coords.longitude, lastPos.coords.latitude]);
  }
});

// Si el usuario mueve/zoomea el mapa, apaga seguirme (para no “pelear”)
map.on('dragstart', ()=>{ followMe=false; updateFollowUI(); });
map.on('zoomstart', ()=>{ followMe=false; updateFollowUI(); });
updateFollowUI();

// Guarda la última posición para el “seguir”
let lastPos = null;

// Mejora tu callback de watchPosition:
document.getElementById('btn-locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    setStatus('Este dispositivo no tiene geolocalización'); return;
  }
  navigator.geolocation.watchPosition(pos => {
    lastPos = pos;
    const { latitude, longitude } = pos.coords;
    showUser(latitude, longitude);

    // centra primera vez, luego solo si followMe está activo
    if (!hadFirstFix) {
      map.setCenter([longitude, latitude]);
      hadFirstFix = true;
    } else if (followMe) {
      map.setCenter([longitude, latitude]);
    }

    setStatus('Ubicación actualizada');
  }, err => {
    setStatus('Activa permisos de ubicación/GPS');
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
});

// === Rutas individuales ===
const routeLayers = new Map(); // id -> {sourceId, layerId, bounds}
const trailheads = []; // { id, name, kind: 'start'|'end', lat, lon }

async function loadOneRoute(route){
  const r = await fetch(route.file);
  if(!r.ok){ console.warn('No pude cargar', route.file); return; }
  const geo = await r.json();

  const sourceId = `route-src-${route.id}`;
  const layerId  = `route-lyr-${route.id}`;

  if (!map.getSource(sourceId)){
    map.addSource(sourceId, { type:'geojson', data: geo });
  }
  if (!map.getLayer(layerId)){
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': colorFor(route.id),
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 2,
          14, 4
        ]
      }
    });
  }

  // bounds
  const b = boundsOfGeoJSON(geo);
  routeLayers.set(route.id, {sourceId, layerId, bounds: b});

  // ---- trailheads (inicio/fin) a partir de la geometría ----
  const ends = firstLastFromGeoJSON(geo);
  if (ends?.start) {
    trailheads.push({
      id: route.id,
      name: route.name,
      kind: 'start',
      lat: ends.start[1], lon: ends.start[0]
    });
  }
  if (ends?.end) {
    trailheads.push({
      id: route.id,
      name: route.name,
      kind: 'end',
      lat: ends.end[1], lon: ends.end[0]
    });
  }
}

// Devuelve [lon,lat] del primer y último punto
function firstLastFromGeoJSON(geo){
  const lines = [];
  for(const f of geo.features||[]){
    const g = f.geometry;
    if (g?.type === 'LineString') lines.push(g.coordinates);
    else if (g?.type === 'MultiLineString') lines.push(...g.coordinates);
  }
  if (!lines.length) return null;
  // elige la línea más larga como principal
  let best = lines[0], bestLen = 0;
  for (const L of lines){
    let acc=0;
    for (let i=1;i<L.length;i++){
      const [x1,y1]=L[i-1], [x2,y2]=L[i];
      const d = Math.hypot(x2-x1, y2-y1);
      acc += d;
    }
    if (acc>bestLen){ bestLen=acc; best=L; }
  }
  const start = best[0];
  const end   = best[best.length-1];
  return { start, end };
}

function buildRoutesUI(){
  const list = document.getElementById('routes-list');
  list.innerHTML = '';

  for(const r of ROUTES){
    const row = document.createElement('div');
    row.className = 'route-item';

    const sw = document.createElement('div');
    sw.className = 'route-color';
    sw.style.background = colorFor(r.id);

    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = true;
    chk.id = `chk-${r.id}`;

    const name = document.createElement('label');
    name.className = 'route-name';
    name.setAttribute('for', chk.id);
    name.textContent = r.name;

    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'route-zoom';
    zoomBtn.textContent = '🔍';

    row.append(sw, chk, name, zoomBtn);
    list.appendChild(row);

    chk.addEventListener('change', ()=>{
      const layerId = `route-lyr-${r.id}`;
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, 'visibility', chk.checked ? 'visible' : 'none');
    });

    zoomBtn.addEventListener('click', ()=>{
      const info = routeLayers.get(r.id);
      if (info?.bounds) map.fitBounds(info.bounds, {padding: 40, duration: 500});
    });
  }

  document.getElementById('btn-hide-all')?.addEventListener('click', ()=>{
    for(const r of ROUTES){
      const layerId = `route-lyr-${r.id}`;
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility','none');
      const c = document.getElementById(`chk-${r.id}`); if (c) c.checked = false;
    }
  });
  document.getElementById('btn-show-all')?.addEventListener('click', ()=>{
    for(const r of ROUTES){
      const layerId = `route-lyr-${r.id}`;
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility','visible');
      const c = document.getElementById(`chk-${r.id}`); if (c && !c.checked) c.checked = true;
    }
  });
  document.getElementById('btn-zoom-all')?.addEventListener('click', ()=>{
    let union=null;
    for(const r of ROUTES){
      const info = routeLayers.get(r.id);
      if (info?.bounds){
        union = union
          ? [[Math.min(union[0][0],info.bounds[0][0]), Math.min(union[0][1],info.bounds[0][1])],
             [Math.max(union[1][0],info.bounds[1][0]), Math.max(union[1][1],info.bounds[1][1])]]
          : info.bounds;
      }
    }
    if (union) map.fitBounds(union, {padding:60, duration:600});
  });
}
// ---- Geodesia básica ----
function toRad(d){ return d * Math.PI/180; }
function toDeg(r){ return r * 180/Math.PI; }

function haversine(lat1, lon1, lat2, lon2){
  const R = 6371000; // m
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
function bearing(lat1, lon1, lat2, lon2){
  const y = Math.sin(toRad(lon2-lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2-lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function humanDistance(m){
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m/1000).toFixed(2)} km`;
}

let navLine = null; // capa/feature para la línea guía

function drawGuideLine(fromLon, fromLat, toLon, toLat){
  // elimina línea previa
  if (map.getLayer('guide-line')) map.removeLayer('guide-line');
  if (map.getSource('guide-src')) map.removeSource('guide-src');

  const geo = {
    type:'FeatureCollection',
    features:[{
      type:'Feature',
      geometry:{ type:'LineString', coordinates:[[fromLon,fromLat],[toLon,toLat]] },
      properties:{}
    }]
  };
  map.addSource('guide-src', { type:'geojson', data: geo });
  map.addLayer({
    id:'guide-line',
    type:'line',
    source:'guide-src',
    paint:{
      'line-color':'#111',
      'line-dasharray':[2,2],
      'line-width': 2
    }
  });
}

function nearestTrailhead(lat, lon){
  if (!trailheads.length) return null;
  let best=null, bestD=Infinity;
  for (const th of trailheads){
    const d = haversine(lat, lon, th.lat, th.lon);
    if (d < bestD){ bestD = d; best = {th, dist:d}; }
  }
  return best;
}

document.getElementById('btn-navigate')?.addEventListener('click', ()=>{
  if (!lastPos){ setStatus('Primero activa tu ubicación'); return; }
  const { latitude:lat, longitude:lon } = lastPos.coords;

  const best = nearestTrailhead(lat, lon);
  if (!best){ setStatus('No hay salidas detectadas'); return; }

  const { th, dist } = best;
  const brg = bearing(lat, lon, th.lat, th.lon);
  setGuide(`Salida: ${th.name} (${th.kind}) • ${humanDistance(dist)} • Rumbo ${brg.toFixed(0)}°`);
  drawGuideLine(lon, lat, th.lon, th.lat);

  // Opcional: acercar un poco para ver la línea
  map.fitBounds([[lon,lat],[th.lon,th.lat]], { padding: 60, duration: 600 });
});


map.on('load', async ()=>{
  for (const r of ROUTES){ await loadOneRoute(r); }
  buildRoutesUI();
  setStatus('Mapa cargado');
});

