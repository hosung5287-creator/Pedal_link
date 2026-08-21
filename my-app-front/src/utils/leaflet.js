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

export function makeCurrentLocationIcon() {
  return L.divIcon({
    html: `<style>
      @keyframes locPulse {
        0% { transform: scale(1); opacity: 0.6; }
        100% { transform: scale(2.4); opacity: 0; }
      }
    </style>
    <div style="position:relative;width:22px;height:22px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#2563eb;animation:locPulse 1.8s ease-out infinite;"></div>
      <div style="position:absolute;top:4px;left:4px;width:14px;height:14px;background:#2563eb;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
    </div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

export function makeOtherUserIcon() {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;background:#f97316;border:2.5px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
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

// BRouter 응답의 properties(요약) + messages(구간별 도로정보)를 분석 데이터로 가공
function parseBrouterStats(props) {
  const distanceM = Number(props['track-length']) || 0;
  const ascendM = Number(props['filtered ascend']) || 0;
  const timeSec = Number(props['total-time']) || 0;

  const messages = props.messages || [];
  const header = messages[0] || [];
  const dIdx = header.indexOf('Distance');
  const wIdx = header.indexOf('WayTags');

  const surfaceM = {};
  const highwayM = {};
  if (dIdx >= 0 && wIdx >= 0) {
    for (let i = 1; i < messages.length; i++) {
      const seg = Number(messages[i][dIdx]) || 0;
      const tags = messages[i][wIdx] || '';
      let surface = 'unknown';
      let highway = 'unknown';
      tags.split(/\s+/).forEach((t) => {
        const [k, v] = t.split('=');
        if (k === 'surface') surface = v;
        else if (k === 'highway') highway = v;
      });
      surfaceM[surface] = (surfaceM[surface] || 0) + seg;
      highwayM[highway] = (highwayM[highway] || 0) + seg;
    }
  }

  const toSorted = (obj) => {
    const total = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(obj)
      .map(([key, meters]) => ({ key, meters, pct: Math.round((meters / total) * 100) }))
      .sort((a, b) => b.meters - a.meters);
  };

  return {
    distanceKm: Math.round(distanceM / 100) / 10,
    ascendM,
    timeMin: Math.round(timeSec / 60),
    surfaces: toSorted(surfaceM),
    highways: toSorted(highwayM),
  };
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
  const feature = geojson.type === 'FeatureCollection' ? geojson.features?.[0] : geojson;
  const coordinates = feature?.geometry?.coordinates;

  if (!coordinates?.length) throw new Error('Route geometry missing');

  return {
    coords: coordinates.map(([lng, lat]) => [lat, lng]),
    stats: parseBrouterStats(feature?.properties || {}),
  };
}

// 진행 방향을 가리키는 화살표 마커 (heading-up).
// Leaflet 코어는 지도 회전을 지원하지 않으므로, 지도는 북쪽 고정(north-up)으로 두고
// 마커만 방위각만큼 돌린다. 스트라바 등 대부분의 자전거 앱이 쓰는 방식이다.
export function makeHeadingIcon(headingDeg) {
  return L.divIcon({
    html: `<div style="width:34px;height:34px;transform:rotate(${headingDeg}deg);transform-origin:50% 50%;">
      <svg viewBox="0 0 34 34" width="34" height="34">
        <circle cx="17" cy="17" r="15" fill="#2563eb" fill-opacity="0.18"/>
        <!-- 위(0도)가 북쪽. 부모 div 를 돌려서 진행 방향을 향하게 한다 -->
        <path d="M17 4 L25 26 L17 21 L9 26 Z" fill="#2563eb" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// 두 좌표 사이의 방위각(북쪽 기준 시계방향 0~360도).
// geolocation 의 coords.heading 은 정지 상태에서 null 이 오는 경우가 많아,
// 직전 위치와 현재 위치로 직접 계산하는 편이 라이딩 중에는 더 안정적이다.
export function bearingBetween(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = toRad(from.lat), lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;   // -180~180 → 아래에서 0~360 으로 정규화
}
