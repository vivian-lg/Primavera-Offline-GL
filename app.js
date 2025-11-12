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

// === Rutas individuales ===
const routeLayers = new Map(); // id -> {sourceId, layerId, bounds}

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

  const b = boundsOfGeoJSON(geo);
  routeLayers.set(route.id, {sourceId, layerId, bounds: b});
}

function boundsOfGeoJSON(geo){
  let minX= Infinity, minY= Infinity, maxX= -Infinity, maxY= -Infinity;
  for(const f of geo.features||[]){
    const g = f.geometry;
    const lines = g?.type==='LineString' ? [g.coordinates] :
                  g?.type==='MultiLineString' ? g.coordinates : [];
    for (const line of lines){
      for (const [x,y] of line){
        if (x<minX) minX=x; if (y<minY) minY=y;
        if (x>maxX) maxX=x; if (y>maxY) maxY=y;
      }
    }
  }
  if (!isFinite(minX)) return null;
  return [[minX,minY],[maxX,maxY]];
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

map.on('load', async ()=>{
  for (const r of ROUTES){ await loadOneRoute(r); }
  buildRoutesUI();
  setStatus('Mapa cargado');
});

