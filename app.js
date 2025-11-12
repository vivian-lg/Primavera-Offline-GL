// =================== PMTiles: evita doble registro ===================
if (!window.__pmtilesProtocolAdded) {
  window.__pmtilesProtocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", window.__pmtilesProtocol.tile);
  window.__pmtilesProtocolAdded = true;
}

// =================== UI refs ===================
const statusEl = document.getElementById('status');
const plusEl   = document.getElementById('pluscode');
const guideEl  = document.getElementById('guide');
function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }

// =================== Mapa base (vector desde PMTiles) ===================
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    // Para ver etiquetas online. Para 100% offline, luego empaquetamos glyphs locales.
    glyphs: "./fonts/{fontstack}/{range}.pbf",
    sources: {
      primavera: { type: "vector", url: "pmtiles://./primavera.pmtiles" }
    },
    layers: [
      // Fondo
      { id: "bg", type: "background", paint: { "background-color": "#eef3f6" } },

      // Vegetación / usos de suelo
      { id: "landcover",
        type: "fill", source: "primavera", "source-layer": "landcover",
        paint: { "fill-color": "#d9ebc6", "fill-opacity": 0.6 } },

      { id: "landuse",
        type: "fill", source: "primavera", "source-layer": "landuse",
        paint: { "fill-color": "#e6edd9", "fill-opacity": 0.5 } },

      { id: "park",
        type: "fill", source: "primavera", "source-layer": "park",
        paint: { "fill-color": "#cfe9b5", "fill-opacity": 0.6 } },

      // Agua
      { id: "water",
        type: "fill", source: "primavera", "source-layer": "water",
        paint: { "fill-color": "#b5d0e6" } },

      { id: "waterway",
        type: "line", source: "primavera", "source-layer": "waterway",
        paint: { "line-color": "#88b5d8", "line-width": 1 } },

      // Caminos
      { id: "roads-casing",
        type: "line", source: "primavera", "source-layer": "transportation",
        paint: {
          "line-color": "#fff",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            10, 0.5, 14, 2.5, 16, 5
          ]
        }
      },
      { id: "roads",
        type: "line", source: "primavera", "source-layer": "transportation",
        paint: {
          "line-color": "#666",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            10, 0.3, 14, 1.5, 16, 3
          ]
        }
      },

      // Edificios
      { id: "building",
        type: "fill", source: "primavera", "source-layer": "building",
        paint: {
          "fill-color": "#d7d3c8",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.0, 15, 0.6]
        }
      }
    ]
  },
  center: [-103.60, 20.65],
  zoom: 12
  maxZoom: 14
});

// Etiquetas (opcional; requieren glyphs online)
map.on('load', () => {
  map.addLayer({
    id: 'place-label',
    type: 'symbol',
    source: 'primavera',
    'source-layer': 'place',
    layout: {
      'text-field': ['coalesce', ['get','name'], ['get','name:es'], ['get','name:en']],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 14]
    },
    paint: { 'text-color': '#2f3440', 'text-halo-color': '#eef3f6', 'text-halo-width': 1 }
  });

  map.addLayer({
    id: 'water-name',
    type: 'symbol',
    source: 'primavera',
    'source-layer': 'water_name',
    layout: { 'text-field': ['get','name'], 'text-size': 12, 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular']},
    paint: { 'text-color': '#557a9e', 'text-halo-color': '#eef3f6', 'text-halo-width': 1 }
  });

  map.addLayer({
    id: 'road-name',
    type: 'symbol',
    source: 'primavera',
    'source-layer': 'transportation_name',
    layout: { 'text-field': ['get','name'], 'text-size': 11, 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular']},
    paint: { 'text-color': '#555', 'text-halo-color': '#fff', 'text-halo-width': 0.5 }
  });
});

// =================== Utilidades ===================
async function safeFetchJSON(url){
  try { const r = await fetch(url); if(!r.ok) return null; return await r.json(); }
  catch { return null; }
}

// =================== POIs: círculos (offline-friendly) ===================
async function addPOIs(){
  const pois = await safeFetchJSON('./data/pois.geojson');
  if(!pois) return;

  map.addSource('pois', { type:'geojson', data: pois });

  map.addLayer({
    id:'pois-circles',
    type:'circle',
    source:'pois',
    paint:{
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 6],
      'circle-color': [
        'match', ['get','type'],
        'signal', '#1e88e5',
        'restaurant', '#ef6c00',
        'safe', '#43a047',
        /* default */ '#8e8e8e'
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1
    }
  });

  // (Opcional) etiquetas si mantienes glyphs online:
  // map.addLayer({ ... "type":"symbol" ... })
}

// =================== Rutas: selección individual + colores fijos ===================
// 1) Lista de archivos EXACTOS en /routes_geojson
const ROUTE_FILES = [
  "bosque-nutella.geojson",
  "brujas.geojson",
  "Ruta la catarina.geojson",
  "huevona.geojson",
  "by-pass-516314.geojson",
  "vaca-muerta-rivers-combined.geojson",
  "torre-03.geojson",
  "espinazo.geojson",
  "pinitos-angel.geojson",
  "1-2-mosca.geojson",
  "relax.geojson",
  "torre-01.geojson",
  "extension-espinazo.geojson",
  "toboganes-110689.geojson",
  "mago-de-oz.geojson",
  "arenosas.geojson"
];

// 2) Colores fijos por archivo
const ROUTE_COLORS = {
  "bosque-nutella.geojson": "#e41a1c",
  "brujas.geojson": "#17becf",
  "Ruta la catarina.geojson": "#377eb8",
  "huevona.geojson": "#4daf4a",
  "by-pass-516314.geojson": "#984ea3",
  "vaca-muerta-rivers-combined.geojson": "#ff7f00",
  "torre-03.geojson": "#a65628",
  "espinazo.geojson": "#f781bf",
  "pinitos-angel.geojson": "#999999",
  "1-2-mosca.geojson": "#66c2a5",
  "relax.geojson": "#fc8d62",
  "torre-01.geojson": "#1b9e77",
  "extension-espinazo.geojson": "#d95f02",
  "toboganes-110689.geojson": "#7570b3",
  "mago-de-oz.geojson": "#e7298a",
  "arenosas.geojson": "#66a61e"
};

// 3) Paleta de respaldo + hash estable (para archivos nuevos)
const PALETTE = ["#377eb8","#e41a1c","#4daf4a","#984ea3","#ff7f00","#a65628",
                 "#f781bf","#999999","#66c2a5","#fc8d62","#1b9e77","#d95f02",
                 "#7570b3","#e7298a","#66a61e","#17becf"];
function stableColorFor(name){
  if (ROUTE_COLORS[name]) return ROUTE_COLORS[name];
  let h = 0;
  for (let i=0; i<name.length; i++){ h=((h<<5)-h)+name.charCodeAt(i); h|=0; }
  return PALETTE[Math.abs(h)%PALETTE.length];
}

// 4) Estructuras para administrar rutas
const ROUTE_DATA = {};   // file -> GeoJSON
const ROUTE_IDS  = {};   // file -> {srcId, layerId}

// 5) BBox util (LineString/MultiLineString)
function bboxOfGeoJSON(geo){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const f of geo.features || []){
    const g = f.geometry; if(!g) continue;
    const groups = g.type==='LineString' ? [g.coordinates]
                 : g.type==='MultiLineString' ? g.coordinates
                 : [];
    for(const line of groups){
      for(const [x,y] of line){
        if(x<minX)minX=x; if(y<minY)minY=y;
        if(x>maxX)maxX=x; if(y>maxY)maxY=y;
      }
    }
  }
  if (!isFinite(minX)) return null;
  return [[minX,minY],[maxX,maxY]];
}

// 6) Cargar una ruta -> source+layer + fila UI
async function addOneRoute(file){
  try{
    const res = await fetch(`./routes_geojson/${file}`);
    if(!res.ok){ setStatus(`No pude cargar ${file}`); return; }
    const geo = await res.json();
    ROUTE_DATA[file] = geo;

    // nombre amigable (si viene en properties.name)
    let displayName = file.replace(/\.geojson$/i,'');
    try{
      const f = geo.features?.find(ft => ft.properties?.name);
      if (f && f.properties.name) displayName = f.properties.name;
    }catch{}

    const color = stableColorFor(file);
    const srcId   = 'r_src_'   + file.replace(/[^\w]/g,'_');
    const layerId = 'r_layer_' + file.replace(/[^\w]/g,'_');

    map.addSource(srcId, { type:'geojson', data: geo });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: srcId,
      paint: { 'line-color': color, 'line-width': 3 }
    });

    ROUTE_IDS[file] = {srcId, layerId};

    // UI
    const list = document.getElementById('routes-list');
    const wrap = document.createElement('div');
    wrap.className = 'route-item';

    const swatch = document.createElement('div');
    swatch.className = 'route-color';
    swatch.style.background = color;

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = true;

    const nameEl = document.createElement('span');
    nameEl.className = 'route-name';
    nameEl.textContent = displayName;

    const btnZoom = document.createElement('button');
    btnZoom.className = 'route-zoom';
    btnZoom.title = 'Zoom a esta ruta';
    btnZoom.textContent = '🔍';

    wrap.append(swatch, chk, nameEl, btnZoom);
    list.appendChild(wrap);

    // Mostrar/ocultar
    chk.addEventListener('change', ()=>{
      if (map.getLayer(layerId)){
        map.setLayoutProperty(layerId, 'visibility', chk.checked ? 'visible':'none');
      }
    });

    // Zoom a bbox de esa ruta
    btnZoom.addEventListener('click', ()=>{
      const b = bboxOfGeoJSON(geo);
      if (b) map.fitBounds(b, {padding: 40});
    });

  }catch(e){
    setStatus(`Error cargando ${file}`);
  }
}

// 7) Cargar todas
function loadAllRoutes(){ ROUTE_FILES.forEach(addOneRoute); }

// 8) Botones globales
document.getElementById('btn-show-all')?.addEventListener('click', ()=>{
  for(const f in ROUTE_IDS){
    const {layerId} = ROUTE_IDS[f];
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility','visible');
  }
  document.querySelectorAll('#routes-list input[type="checkbox"]').forEach(c=> c.checked = true);
});

document.getElementById('btn-hide-all')?.addEventListener('click', ()=>{
  for(const f in ROUTE_IDS){
    const {layerId} = ROUTE_IDS[f];
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility','none');
  }
  document.querySelectorAll('#routes-list input[type="checkbox"]').forEach(c=> c.checked = false);
});

document.getElementById('btn-zoom-all')?.addEventListener('click', ()=>{
  // BBox de todas las rutas visibles
  let union = null;
  for (const f in ROUTE_DATA){
    const {layerId} = ROUTE_IDS[f] || {};
    if (!layerId || map.getLayoutProperty(layerId,'visibility')==='none') continue;
    const b = bboxOfGeoJSON(ROUTE_DATA[f]);
    if (!b) continue;
    if (!union) union = b;
    else {
      union = [
        [Math.min(union[0][0], b[0][0]), Math.min(union[0][1], b[0][1])],
        [Math.max(union[1][0], b[1][0]), Math.max(union[1][1], b[1][1])]
      ];
    }
  }
  if (union) map.fitBounds(union, {padding: 40});
  else setStatus('No hay rutas visibles para ajustar el zoom');
});

// 9) Carga al inicio
map.on('load', async ()=>{
  loadAllRoutes();
  await addPOIs();
  setStatus('Mapa cargado');
});

// =================== GPS + Plus Code + Seguirme ===================
let watchId=null, lastPos=null, followMe=false, hadFirstFix=false, userMarker=null;
function updateFollowUI(){
  const b = document.getElementById('btn-follow');
  if (!b) return;
  b.textContent = followMe ? '🧭 Seguirme: ON' : '🧭 Seguirme: OFF';
  b.style.opacity = followMe ? '1' : '0.8';
}
function showUser(lat, lon){
  const here = [lon, lat];
  if(!userMarker){
    userMarker = new maplibregl.Marker({color:'#5cc8ff'}).setLngLat(here).addTo(map);
  } else {
    userMarker.setLngLat(here);
  }
  if (!hadFirstFix) { map.setCenter(here); hadFirstFix=true; }
  else if (followMe) { map.setCenter(here); }
  try{ plusEl.textContent = OpenLocationCode.encode(lat, lon, 8); }catch(e){}
}
function startLocate(){
  if(!('geolocation' in navigator)){ setStatus('Sin geolocalización'); return; }
  if (watchId){ setStatus('Ubicación activa'); return; }
  watchId = navigator.geolocation.watchPosition(pos=>{
    lastPos = pos;
    showUser(pos.coords.latitude, pos.coords.longitude);
    setStatus('Ubicación actualizada');
  }, err=>{
    setStatus('No pude obtener ubicación (habilita GPS y permisos)');
  }, {enableHighAccuracy:true, maximumAge:3000, timeout:15000});
}
document.getElementById('btn-locate')?.addEventListener('click', startLocate);
document.getElementById('btn-follow')?.addEventListener('click', ()=>{
  followMe = !followMe; updateFollowUI();
  if (followMe && lastPos){ map.setCenter([lastPos.coords.longitude, lastPos.coords.latitude]); }
});
map.on('dragstart', ()=>{ followMe=false; updateFollowUI(); });
map.on('zoomstart', ()=>{ followMe=false; updateFollowUI(); });
updateFollowUI();

document.getElementById('btn-copy')?.addEventListener('click', ()=>{
  navigator.clipboard?.writeText(plusEl?.textContent || '');
  setStatus('Plus Code copiado');
});

// =================== Rumbo/guía (placeholder) ===================
function setGuideText(txt){ if(guideEl) guideEl.textContent = txt; }
setGuideText('—');
