import L from 'leaflet';
import { tileLayers, text } from '../constants';

export function makeTileLayer(key) {
  return L.tileLayer(tileLayers[key].url, {
    attribution: tileLayers[key].attribution,
    maxZoom: 18,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 1,
  });
}

export function makeBikeIcon(borderColor) {
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:38px;height:50px;">
      <div style="
        width:38px;height:38px;
        background:#fff;
        border:2.5px solid ${borderColor};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.28);
        flex-shrink:0;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${borderColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5.5" cy="17.5" r="3.5"/>
          <circle cx="18.5" cy="17.5" r="3.5"/>
          <path d="M15 6a1 1 0 0 0-1-1h-1l-4 8h6l1-4"/>
          <path d="M9 17.5 12 10l3 7.5"/>
          <path d="M14 5h2"/>
        </svg>
      </div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid ${borderColor};margin-top:-1px;"></div>
    </div>`,
    className: '',
    iconSize: [38, 50],
    iconAnchor: [19, 50],
    popupAnchor: [0, -52],
  });
}

export function drawMarkers(startPoint, endPoint, layer) {
  if (!layer) return;
  layer.clearLayers();
  if (startPoint) {
    L.marker([startPoint.lat, startPoint.lng], { icon: makeBikeIcon('#2563eb') })
      .bindPopup(`${text.startPlace}: ${startPoint.label}`)
      .addTo(layer);
  }
  if (endPoint) {
    L.marker([endPoint.lat, endPoint.lng], { icon: makeBikeIcon('#16a34a') })
      .bindPopup(`${text.endPlace}: ${endPoint.label}`)
      .addTo(layer);
  }
}

export function drawRoutes(bikeRoute, shortestRoute, layer, map) {
  if (!layer || !map) return;
  if (!bikeRoute?.length || !shortestRoute?.length) return;
  layer.clearLayers();

  const shortestLine = L.polyline(shortestRoute, {
    color: '#60a5fa',
    dashArray: '8 8',
    opacity: 0.95,
    weight: 6,
  }).bindPopup(text.shortestRoute).addTo(layer);

  const bikeLine = L.polyline(bikeRoute, {
    color: '#2563eb',
    opacity: 0.95,
    weight: 6,
  }).bindPopup(text.bikeRoute).addTo(layer);

  map.fitBounds(L.featureGroup([shortestLine, bikeLine]).getBounds(), {
    padding: [40, 40],
  });
}

export function routeHasCycleways(routePoints, features) {
  if (!features || features.length === 0) return false;
  const THRESHOLD = 0.0002; // ~20m
  const step = Math.max(1, Math.floor(routePoints.length / 80));
  for (let i = 0; i < routePoints.length; i += step) {
    const [plat, plng] = routePoints[i];
    for (const feature of features) {
      const geom = feature.geometry;
      if (!geom) continue;
      const lines = geom.type === 'LineString' ? [geom.coordinates]
        : geom.type === 'MultiLineString' ? geom.coordinates : [];
      for (const line of lines) {
        for (let j = 0; j < line.length - 1; j++) {
          const [alng, alat] = line[j];
          const [blng, blat] = line[j + 1];
          const dx = blng - alng, dy = blat - alat;
          const len2 = dx * dx + dy * dy;
          const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((plng - alng) * dx + (plat - alat) * dy) / len2));
          const dist = Math.hypot(plng - (alng + t * dx), plat - (alat + t * dy));
          if (dist < THRESHOLD) return true;
        }
      }
    }
  }
  return false;
}

export async function requestBrouterRoute(from, to, profile) {
  const url = new URL('https://brouter.de/brouter');
  url.searchParams.set('lonlats', `${from.lng},${from.lat}|${to.lng},${to.lat}`);
  url.searchParams.set('profile', profile);
  url.searchParams.set('alternativeidx', '0');
  url.searchParams.set('format', 'geojson');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Route request failed');

  const geojson = await response.json();
  const coordinates =
    geojson.type === 'FeatureCollection'
      ? geojson.features?.[0]?.geometry?.coordinates
      : geojson.geometry?.coordinates;

  if (!coordinates?.length) throw new Error('Route geometry missing');
  return coordinates.map(([lng, lat]) => [lat, lng]);
}
