
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
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      primavera: { type: "vector", url: "pmtiles://./primavera.pmtiles" }
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#eef3f6" } },
      { id: "landcover", type: "fill", source: "primavera", "source-layer": "landcover",
        paint: { "fill-color": "#d9ebc6", "fill-opacity": 0.6 } },
      { id: "landuse", type: "fill", source: "primavera", "source-layer": "landuse",
        paint: { "fill-color": "#e6edd9", "fill-opacity": 0.5 } },
      { id: "park", type: "fill", source: "primavera", "source-layer": "park",
        paint: { "fill-color": "#cfe9b5", "fill-opacity": 0.6 } },
      { id: "water", type: "fill", source: "primavera", "source-layer": "water",
        paint: { "fill-color": "#b5d0e6" } },
      { id: "waterway", type: "line", source: "primavera", "source-layer": "waterway",
        paint: { "line-color": "#88b5d8", "line-width": 1 } },
      { id: "roads-casing", type: "line", source: "primavera", "source-layer": "transportation",
        paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 2.5, 16, 5] } },
      { id: "roads", type: "line", source: "primavera", "source-layer": "transportation",
        paint: { "line-color": "#666", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 14, 1.5, 16, 3] } },
      { id: "building", type: "fill", source: "primavera", "source-layer": "building",
        paint: { "fill-color": "#d7d3c8", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.0, 15, 0.6] } }
    ]
  },
  center: [-103.60, 20.65],
  zoom: 12
});

// Etiquetas usando fuente local
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
    layout: { 'text-field': ['get','name'], 'text-size': 12, 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular'] },
    paint: { 'text-color': '#557a9e', 'text-halo-color': '#eef3f6', 'text-halo-width': 1 }
  });

  map.addLayer({
    id: 'road-name',
    type: 'symbol',
    source: 'primavera',
    'source-layer': 'transportation_name',
    layout: { 'text-field': ['get','name'], 'text-size': 11, 'symbol-placement': 'line', 'text-font': ['Noto Sans Regular'] },
    paint: { 'text-color': '#555', 'text-halo-color': '#fff', 'text-halo-width': 0.5 }
  });
});

// =================== Utilidad: fetch JSON seguro ===================
async function safeFetchJSON(url){
  try { const r = await fetch(url, { cache: 'no-cache' }); if(!r.ok) return null; return await r.json(); }
  catch { return null; }
}

// =================== POIs (opcional) ===================
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
      'circle-color': ['match', ['get','type'],'signal','#1e88e5','restaurant','#ef6c00','safe','#43a047','#8e8e8e'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1
    }
  });
}

// =================== Rutas individuales ===================
const ROUTE_FILES = [
  "bosque-nutella.geojson","brujas.geojson","huevona.geojson","by-pass-516314.geojson",
  "vaca-muerta-rivers-combined.geojson","torre-03.geojson","espinazo.geojson","pinitos-angel.geojson",
  "1-2-mosca.geojson","relax.geojson","torre-01.geojson","extension-espinazo.geojson",
  "toboganes-110689.geojson","mago-de-oz.geojson","arenosas.geojson","ruta-la-catarina.geojson"
  // Si "Ruta la catarina.geojson" existe, agrégala aquí EXACTAMENTE con ese nombre
];

const ROUTE_COLORS = {
  "bosque-nutella.geojson": "#e41a1c",
  "brujas.geojson": "#17becf",
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
  "arenosas.geojson": "#66a61e",
  "ruta-la-catarina.geojson": "#377eb8"
};

// Dificultad por archivo (sin modificar los .geojson)
const DIFFICULTY_BY_FILE = {
  'bosque-nutella.geojson': 'green',
  'brujas.geojson': 'blue',
  'ruta-la-catarina.geojson': 'blue',
  'huevona.geojson': 'green',
  'by-pass-516314.geojson': 'blue',
  'vaca-muerta-rivers-combined.geojson': 'green',
  'torre-03.geojson': 'green',
  'espinazo.geojson': 'blue',
  'pinitos-angel.geojson': 'blue',
  '1-2-mosca.geojson': 'green',
  'relax.geojson': 'blue',
  'torre-01.geojson': 'blue',
  'extension-espinazo.geojson': 'blue',
  'toboganes-110689.geojson': 'blue',
  'mago-de-oz.geojson': 'black',
  'arenosas.geojson': 'blue'
};

// Colores por dificultad
const DIFF_COLORS = {
  green: '#3CB371', // verde
  blue:  '#1E90FF', // azul
  black: '#111111'  // negro
};

function colorForDifficultyName(filename){
  const diff = DIFFICULTY_BY_FILE[filename] || 'blue';
  return DIFF_COLORS[diff] || '#999';
}

const PALETTE = ["#377eb8","#e41a1c","#4daf4a","#984ea3","#ff7f00","#a65628","#f781bf","#999999",
                 "#66c2a5","#fc8d62","#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#17becf"];
function stableColorFor(name){
  if (ROUTE_COLORS[name]) return ROUTE_COLORS[name];
  let h = 0; for (let i=0;i<name.length;i++){ h=((h<<5)-h)+name.charCodeAt(i); h|=0; }
  return PALETTE[Math.abs(h)%PALETTE.length];
}

const ROUTE_DATA = {};   // file -> GeoJSON
const ROUTE_IDS  = {};   // file -> {srcId, layerId}
const trailheads = [];   // { id, name, kind:'start'|'end', lat, lon }

function bboxOfGeoJSON(geo){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const f of geo.features || []){
    const g=f.geometry; if(!g) continue;
    const lines = g.type==='LineString' ? [g.coordinates]
               : g.type==='MultiLineString' ? g.coordinates : [];
    for(const line of lines){
      for(const [x,y] of line){
        if(x<minX)minX=x; if(y<minY)minY=y;
        if(x>maxX)maxX=x; if(y>maxY)maxY=y;
      }
    }
  }
  if(!isFinite(minX)) return null;
  return [[minX,minY],[maxX,maxY]];
}

function firstLastFromGeoJSON(geo){
  const lines=[];
  for(const f of geo.features||[]){
    const g=f.geometry;
    if(g?.type==='LineString') lines.push(g.coordinates);
    else if(g?.type==='MultiLineString') lines.push(...g.coordinates);
  }
  if(!lines.length) return null;
  let best=lines[0], bestLen=0;
  for(const L of lines){
    let acc=0;
    for(let i=1;i<L.length;i++){
      const [x1,y1]=L[i-1], [x2,y2]=L[i];
      acc += Math.hypot(x2-x1,y2-y1);
    }
    if(acc>bestLen){ bestLen=acc; best=L; }
  }
  return { start: best[0], end: best[best.length-1] };
}

async function addOneRoute(file){
  try{
    const res = await fetch(`./routes_geojson/${file}`);
    if(!res.ok){ setStatus(`No pude cargar ${file}`); return; }
    const geo = await res.json();
    ROUTE_DATA[file] = geo;

    // nombre para UI
    let displayName = file.replace(/\.geojson$/i,'');
    try {
      const f = geo.features?.find(ft => ft.properties?.name);
      if (f?.properties?.name) displayName = f.properties.name;
    } catch {}

   // const color = stableColorFor(file);
    const srcId   = 'r_src_'   + file.replace(/[^\w]/g,'_');
    const layerId = 'r_layer_' + file.replace(/[^\w]/g,'_');

    map.addSource(srcId, { type:'geojson', data: geo });
    const color = colorForDifficultyName(file);
    map.addLayer({
      id: layerId,
      type: 'line',
      source: srcId,
      paint: { 'line-color': color, 'line-width': [
      'interpolate', ['linear'], ['zoom'],
      10, 2,
      14, 4
    ] }
    });

    ROUTE_IDS[file] = { srcId, layerId };

    // UI fila
    const list = document.getElementById('routes-list');
    const wrap = document.createElement('div'); wrap.className='route-item';
    const swatch = document.createElement('div'); swatch.className='route-color'; swatch.style.background=color;
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked=true;
    const nameEl = document.createElement('span'); nameEl.className='route-name'; nameEl.textContent=displayName;
    const zoomBtn = document.createElement('button'); zoomBtn.className='route-zoom'; zoomBtn.textContent='🔍'; zoomBtn.title='Zoom a esta ruta';
    wrap.append(swatch, chk, nameEl, zoomBtn); list.appendChild(wrap);

    chk.addEventListener('change', ()=>{
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility', chk.checked?'visible':'none');
    });
    zoomBtn.addEventListener('click', ()=>{
      const b=bboxOfGeoJSON(geo); if (b) map.fitBounds(b,{padding:40});
    });

    // trailheads
    const ends = firstLastFromGeoJSON(geo);
    if (ends?.start) trailheads.push({ id:file, name:displayName, kind:'start', lat:ends.start[1], lon:ends.start[0] });
    if (ends?.end)   trailheads.push({ id:file, name:displayName, kind:'end',   lat:ends.end[1],   lon:ends.end[0] });

  }catch(e){
    console.error(e);
    setStatus(`Error cargando ${file}`);
  }
}

function loadAllRoutes(){ ROUTE_FILES.forEach(addOneRoute); }

// Botones globales
document.getElementById('btn-show-all')?.addEventListener('click', ()=>{
  for(const f in ROUTE_IDS){ const {layerId}=ROUTE_IDS[f]; if(map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility','visible'); }
  document.querySelectorAll('#routes-list input[type="checkbox"]').forEach(c=> c.checked = true);
});
document.getElementById('btn-hide-all')?.addEventListener('click', ()=>{
  for(const f in ROUTE_IDS){ const {layerId}=ROUTE_IDS[f]; if(map.getLayer(layerId)) map.setLayoutProperty(layerId,'visibility','none'); }
  document.querySelectorAll('#routes-list input[type="checkbox"]').forEach(c=> c.checked = false);
});
document.getElementById('btn-zoom-all')?.addEventListener('click', ()=>{
  let union=null;
  for(const f in ROUTE_DATA){
    const {layerId}=ROUTE_IDS[f]||{};
    if (!layerId || map.getLayoutProperty(layerId,'visibility')==='none') continue;
    const b=bboxOfGeoJSON(ROUTE_DATA[f]); if(!b) continue;
    union = union
      ? [[Math.min(union[0][0],b[0][0]), Math.min(union[0][1],b[0][1])],
         [Math.max(union[1][0],b[1][0]), Math.max(union[1][1],b[1][1])]]
      : b;
  }
  if (union) map.fitBounds(union,{padding:60,duration:600});
  else setStatus('No hay rutas visibles para ajustar el zoom');
});

// =================== GPS + Plus Code + Seguirme ===================
let watchId=null, lastPos=null, followMe=false, hadFirstFix=false, userMarker=null;
function updateFollowUI(){
  const b=document.getElementById('btn-follow'); if(!b) return;
  b.textContent = followMe ? '🧭 Seguirme: ON' : '🧭 Seguirme: OFF';
  b.style.opacity = followMe ? '1' : '0.85';
}
function showUser(lat, lon){
  const here=[lon,lat];
  if(!userMarker) userMarker=new maplibregl.Marker({color:'#5cc8ff'}).setLngLat(here).addTo(map);
  else userMarker.setLngLat(here);
  if(!hadFirstFix){ map.setCenter(here); hadFirstFix=true; }
  else if(followMe){ map.setCenter(here); }
  try{ plusEl.textContent = OpenLocationCode.encode(lat, lon, 10); }catch{}
}
function startLocate(){
  if(!('geolocation' in navigator)){ setStatus('Sin geolocalización'); return; }
  if(watchId){ setStatus('Ubicación activa'); return; }
  watchId = navigator.geolocation.watchPosition(pos=>{
    lastPos=pos; showUser(pos.coords.latitude, pos.coords.longitude); setStatus('Ubicación actualizada');
  }, err=>{ setStatus('Habilita permisos de ubicación/GPS'); }, {enableHighAccuracy:true,maximumAge:3000,timeout:15000});
}
document.getElementById('btn-locate')?.addEventListener('click', startLocate);
document.getElementById('btn-follow')?.addEventListener('click', ()=>{
  followMe=!followMe; updateFollowUI();
  if(followMe && lastPos){ map.setCenter([lastPos.coords.longitude,lastPos.coords.latitude]); }
});
map.on('dragstart', ()=>{ followMe=false; updateFollowUI(); });
map.on('zoomstart', ()=>{ followMe=false; updateFollowUI(); });
updateFollowUI();

// =================== Navegar a salida (rumbo/distancia) ===================
function toRad(d){ return d*Math.PI/180; }
function toDeg(r){ return r*180/Math.PI; }
function haversine(lat1,lon1,lat2,lon2){
  const R=6371000, dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
function bearing(lat1,lon1,lat2,lon2){
  const y=Math.sin(toRad(lon2-lon1))*Math.cos(toRad(lat2));
  const x=Math.cos(toRad(lat1))*Math.sin(toRad(lat2))-Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2-lon1));
  return (toDeg(Math.atan2(y,x))+360)%360;
}
function humanDistance(m){ return m<1000?`${m.toFixed(0)} m`:`${(m/1000).toFixed(2)} km`; }
function setGuide(text){ if(guideEl) guideEl.textContent=text||'—'; }

function drawGuideLine(fromLon,fromLat,toLon,toLat){
  if(map.getLayer('guide-line')) map.removeLayer('guide-line');
  if(map.getSource('guide-src')) map.removeSource('guide-src');
  const geo={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[fromLon,fromLat],[toLon,toLat]]}}]};
  map.addSource('guide-src',{type:'geojson',data:geo});
  map.addLayer({id:'guide-line',type:'line',source:'guide-src',paint:{'line-color':'#111','line-dasharray':[2,2],'line-width':2}});
}
function nearestTrailhead(lat,lon){
  if(!trailheads.length) return null;
  let best=null,bestD=Infinity;
  for(const th of trailheads){
    const d=haversine(lat,lon,th.lat,th.lon);
    if(d<bestD){bestD=d; best={th,dist:d};}
  }
  return best;
}
document.getElementById('btn-navigate')?.addEventListener('click', ()=>{
  if(!lastPos){ setStatus('Primero activa tu ubicación'); return; }
  const {latitude:lat,longitude:lon}=lastPos.coords;
  const best=nearestTrailhead(lat,lon);
  if(!best){ setStatus('No hay salidas detectadas'); return; }
  const {th,dist}=best; const brg=bearing(lat,lon,th.lat,th.lon);
  setGuide(`Salida: ${th.name} (${th.kind}) • ${humanDistance(dist)} • Rumbo ${brg.toFixed(0)}°`);
  drawGuideLine(lon,lat,th.lon,th.lat);
  map.fitBounds([[lon,lat],[th.lon,th.lat]],{padding:60,duration:600});
});

function applyDifficultyFilters(){
  const showGreen = document.getElementById('f-green')?.checked;
  const showBlue  = document.getElementById('f-blue')?.checked;
  const showBlack = document.getElementById('f-black')?.checked;

  for (const f in ROUTE_IDS){
    const { layerId } = ROUTE_IDS[f] || {};
    if (!layerId || !map.getLayer(layerId)) continue;

    const diff = DIFFICULTY_BY_FILE[f] || 'blue';
    const visible =
      (diff === 'green' && showGreen) ||
      (diff === 'blue'  && showBlue)  ||
      (diff === 'black' && showBlack);

    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }
}

// listeners
['f-green','f-blue','f-black'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change', applyDifficultyFilters);
});
// aplica una vez cuando ya estén las capas listas
map.on('idle', applyDifficultyFilters);

// =================== Arranque ===================
map.on('load', async ()=>{
  loadAllRoutes();
  await addPOIs();
  setStatus('Mapa cargado');
});
