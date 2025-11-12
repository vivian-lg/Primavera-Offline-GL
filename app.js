// Evita doble registro del protocolo PMTiles
if (!window.__pmtilesProtocolAdded) {
  window.__pmtilesProtocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", window.__pmtilesProtocol.tile);
  window.__pmtilesProtocolAdded = true;
}

// UI refs
const statusEl = document.getElementById('status');
const plusEl   = document.getElementById('pluscode');
const guideEl  = document.getElementById('guide');
function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }

// Crea el mapa usando tu archivo local PMTiles (vector)
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    // OJO: Esto sirve fuentes de texto desde internet. Si quieres 100% offline,
    // luego te enseño a empaquetar glyphs locales. Por ahora déjalo así o elimina capas de texto.
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
            10, 0.5,
            14, 2.5,
            16, 5
          ]
        }
      },
      { id: "roads",
        type: "line", source: "primavera", "source-layer": "transportation",
        paint: {
          "line-color": "#666",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            10, 0.3,
            14, 1.5,
            16, 3
          ]
        }
      },

      // Edificios
      { id: "building",
        type: "fill", source: "primavera", "source-layer": "building",
        paint: {
          "fill-color": "#d7d3c8",
          "fill-opacity": [
            "interpolate", ["linear"], ["zoom"],
            13, 0.0,
            15, 0.6
          ]
        }
      }

      // (Opcional) Etiquetas:
      // Agrega luego capas 'symbol' usando 'place' o 'poi' si mantienes glyphs online.
      // Ejemplo:
      // { id: "place-label",
      //   type: "symbol", source: "primavera", "source-layer": "place",
      //   layout: { "text-field": ["get", "name"], "text-size": 12 },
      //   paint: { "text-color": "#334", "text-halo-color": "#eef3f6", "text-halo-width": 1 }
      // }
    ]
  },
  center: [-103.60, 20.65],
  zoom: 12
});





// ====== CARGA DATOS (de momento estarán vacíos; los crearás en pasos siguientes)
async function safeFetchJSON(url){
  try { const r = await fetch(url); if(!r.ok) return null; return await r.json(); }
  catch { return null; }
}

async function addRoutes(){
  const routes = await safeFetchJSON('./data/routes.geojson');
  if(!routes){ setStatus('Sin routes.geojson (aún).'); return; }
  map.addSource('routes', { type:'geojson', data: routes });
  map.addLayer({
    id:'routes-line',
    type:'line',
    source:'routes',
    paint:{
      'line-width': 3,
      'line-color': ['case',
        ['==',['get','difficulty'],'easy'],   '#4caf50',
        ['==',['get','difficulty'],'medium'], '#ff9800',
        ['==',['get','difficulty'],'hard'],   '#e53935',
        /* default */ '#999'
      ]
    }
  });
}

async function addPOIs(){
  const pois = await safeFetchJSON('./data/pois.geojson');
  if(!pois) return;
  map.addSource('pois', { type:'geojson', data: pois });
  map.addLayer({
    id:'pois',
    type:'symbol',
    source:'pois',
    layout:{
      'icon-image': 'marker',
      'icon-size': 1,
      'text-field': ['get','name'],
      'text-offset': [0, 1.0],
      'text-size': 11,
      'icon-allow-overlap': true
    },
    paint:{ 'text-color':'#e9edf1' }
  });
}

map.on('load', async ()=>{ await addRoutes(); await addPOIs(); setStatus('Mapa cargado'); });

// ====== Filtros (funcionarán cuando existan las capas)
function applyFilters(){
  const fe = document.getElementById('f-easy')?.checked;
  const fm = document.getElementById('f-medium')?.checked;
  const fh = document.getElementById('f-hard')?.checked;
  if (map.getLayer('routes-line')){
    map.setFilter('routes-line', [
      'match', ['get','difficulty'],
      'easy', fe ? 'easy' : 'x',
      'medium', fm ? 'medium' : 'x',
      'hard', fh ? 'hard' : 'x',
      'x'
    ]);
  }
}
['f-easy','f-medium','f-hard'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change', applyFilters);
});
map.on('idle', applyFilters);

// ====== GPS + Plus Code + Seguirme
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
document.getElementById('btn-locate').addEventListener('click', startLocate);
document.getElementById('btn-follow').addEventListener('click', ()=>{
  followMe = !followMe; updateFollowUI();
  if (followMe && lastPos){ map.setCenter([lastPos.coords.longitude, lastPos.coords.latitude]); }
});
map.on('dragstart', ()=>{ followMe=false; updateFollowUI(); });
map.on('zoomstart', ()=>{ followMe=false; updateFollowUI(); });
updateFollowUI();

document.getElementById('btn-copy').addEventListener('click', ()=>{
  navigator.clipboard?.writeText(plusEl.textContent || '');
  setStatus('Plus Code copiado');
});

// Zoom/mostrar/ocultar (cuando existan capas)
document.getElementById('btn-zoom-all').addEventListener('click', ()=>{
  const src = map.getSource('routes'); if(!src) return;
  const data = src._data || src._options?.data;
  if (!data?.features?.length) return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const f of data.features){
    const g=f.geometry;
    const lines = g.type==='LineString' ? [g.coordinates] : g.type==='MultiLineString' ? g.coordinates : [];
    for (const line of lines){
      for (const [x,y] of line){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; }
    }
  }
  if (isFinite(minX)) map.fitBounds([[minX,minY],[maxX,maxY]], {padding:40});
});
document.getElementById('btn-hide-all').addEventListener('click', ()=>{
  if (map.getLayer('routes-line')) map.setLayoutProperty('routes-line','visibility','none');
  if (map.getLayer('pois')) map.setLayoutProperty('pois','visibility','none');
});
document.getElementById('btn-show-all').addEventListener('click', ()=>{
  if (map.getLayer('routes-line')) map.setLayoutProperty('routes-line','visibility','visible');
  if (map.getLayer('pois')) map.setLayoutProperty('pois','visibility','visible');
});

// Rumbo/distancia (lo activaremos al elegir punto, más adelante)
function setGuideText(txt){ if(guideEl) guideEl.textContent = txt; }
setGuideText('—');
