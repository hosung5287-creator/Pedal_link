# Leaflet.js — 지도 라이브러리

## 이 프로젝트에서 쓰인 곳
- MapPage에서 자전거 경로를 지도 위에 표시
- 출발지/도착지 마커 표시 (자전거 아이콘)
- 자전거도로(GeoJSON) 레이어 표시 — 지역(구)별 필터
- 경로 클릭 시 지도가 해당 범위로 자동 이동
- **내 현재 위치 마커 + 지오펜스 원(Circle)**
- **다른 접속자 마커(주황 점) + 이름표(Tooltip)**

관련 코드: `src/utils/leaflet.js`, `src/pages/MapPage.js`

---

## 핵심 개념

### 1. 지도 생성
```js
const map = L.map(domElement, {
  center: [37.5665, 126.9780],  // 위도, 경도 (서울 시청)
  zoom: 12,
});
```

### 2. 타일 레이어 (지도 배경 이미지)
지도 배경은 OpenStreetMap 같은 외부 서버에서 이미지 조각(타일)을 받아 붙인다.

```js
// utils/leaflet.js — makeTileLayer()
L.tileLayer(url, {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 18,
  updateWhenIdle: true,      // 드래그가 멈춘 뒤에만 타일 갱신 (요청 수 절감)
  updateWhenZooming: false,
  keepBuffer: 1,
}).addTo(map);
```

`constants.js` 의 `tileLayers` 에 `mapnik`(일반 지도) / `cyclemap`(자전거도로) 두 키가 있다.
현재 두 키의 URL은 같고, `cyclemap` 을 고르면 **DB에서 받은 자전거도로 GeoJSON 레이어를 위에 얹는** 방식이다.

### 3. 마커
```js
L.marker([37.5665, 126.9780]).bindPopup('서울 시청').addTo(map);
```

### 4. divIcon — HTML로 만드는 커스텀 마커 (이 프로젝트의 주력)
이미지 파일 대신 **HTML 문자열**을 마커로 쓴다. CSS 애니메이션도 넣을 수 있다.

```js
// 내 현재 위치 — 파란 점 + 퍼지는 물결 애니메이션
export function makeCurrentLocationIcon() {
  return L.divIcon({
    html: `<style>@keyframes locPulse { 0% {transform:scale(1);opacity:.6} 100% {transform:scale(2.4);opacity:0} }</style>
      <div style="position:relative;width:22px;height:22px;">
        <div style="...;animation:locPulse 1.8s ease-out infinite;"></div>
        <div style="...파란 점..."></div>
      </div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],   // 아이콘의 어느 지점이 좌표에 닿을지 (가운데)
  });
}
```

`utils/leaflet.js` 의 아이콘 3종:

| 함수 | 모양 | 용도 |
|------|------|------|
| `makeBikeIcon(borderColor)` | 흰 원 + 자전거 SVG + 아래 꼬리 | 출발지(파랑 `#2563eb`) / 도착지(초록 `#16a34a`) |
| `makeCurrentLocationIcon()` | 파란 점 + 물결 애니메이션 | 내 실시간 위치 |
| `makeOtherUserIcon()` | 주황 점(`#f97316`) | 다른 접속자 위치 |

> `iconAnchor` 주의: 핀 모양(`makeBikeIcon`)은 **뾰족한 끝**이 좌표에 닿아야 하므로
> `iconAnchor: [19, 50]` (아래 가운데). 점 모양은 **한가운데**라서 `[11, 11]`.

### 5. 폴리라인 — 경로 그리기
```js
// utils/leaflet.js — drawRoutes()
const shortestLine = L.polyline(shortestRoute, {
  color: '#60a5fa', dashArray: '8 8', weight: 6,   // 연파란 점선 = 최단경로
}).bindPopup(text.shortestRoute).addTo(layer);

const bikeLine = L.polyline(bikeRoute, {
  color: '#2563eb', weight: 6,                     // 진한 파란 실선 = 자전거경로
}).bindPopup(text.bikeRoute).addTo(layer);
```
**그리는 순서가 곧 겹침 순서다.** 최단경로를 먼저 그려서 자전거경로가 위에 보이게 했다.

### 6. Circle — 지오펜스 원
마커와 달리 **반경이 미터 단위**라서, 줌을 바꾸면 화면상 크기가 같이 변한다.

```js
// MapPage.js — 내 위치를 따라다니는 220m 원
geofenceCircleRef.current = L.circle([lat, lng], {
  radius: GEOFENCE_RADIUS_M,   // 220 (미터)
  color: '#2563eb', weight: 2, opacity: 0.6,
  fillColor: '#2563eb', fillOpacity: 0.08,
  interactive: false,          // 클릭 이벤트를 지도에 그대로 통과시킴
});

// 위치가 갱신되면 원도 따라 이동
geofenceCircleRef.current?.setLatLng([lat, lng]);
```
`interactive: false` 를 빼면 원 위를 클릭했을 때 지도 클릭(경로 지정)이 안 먹는다.

### 7. Tooltip — 항상 떠 있는 이름표
Popup은 클릭해야 열리지만, Tooltip은 `permanent: true` 로 항상 띄울 수 있다.

```js
L.marker([o.lat, o.lng], { icon: makeOtherUserIcon(), zIndexOffset: 900 })
  .bindTooltip(o.name, { permanent: true, direction: 'top', offset: [0, -10] })
  .addTo(map);
```
`zIndexOffset` 으로 겹침 순서를 조절한다 — 내 위치(1000) > 상대방(900) > 기본 마커.

### 8. GeoJSON 레이어
```js
// MapPage.js — 선택한 구(區)만 필터링해서 표시
const features = selectedRegion === '전체'
  ? cyclewayData.features
  : cyclewayData.features.filter(f => f.properties.gu === selectedRegion);

bikeGeoLayerRef.current = L.geoJSON(
  { type: 'FeatureCollection', features },
  { style: { color: '#2563eb', weight: 3, opacity: 0.75 } }
).addTo(map);
```
데이터 출처는 백엔드 `GET /api/cycleways` (PostGIS `ST_AsGeoJSON`).

### 9. LayerGroup — 레이어 묶음
여러 레이어를 그룹으로 묶어 한 번에 지우거나 추가.

```js
const layerGroup = L.layerGroup().addTo(map);
bikeLine.addTo(layerGroup);
layerGroup.clearLayers();   // 새 경로 그리기 전에 전부 삭제
```
MapPage의 `markerLayerRef`(마커용), `routeLayerRef`(경로용)가 이 방식이다.

### 10. 지도 이동 — fitBounds / flyToBounds
```js
// 두 선을 감싸는 범위로 즉시 이동+줌
map.fitBounds(L.featureGroup([bikeLine, shortestLine]).getBounds(), { padding: [40, 40] });

// 부드럽게 애니메이션하며 이동 (구 선택 시)
map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 });

// 범위가 비어있을 수 있으니 항상 확인
if (bounds.isValid()) map.flyToBounds(bounds);
```

### 11. map.distance — 두 좌표 사이 거리(미터)
지오펜스 판정에 쓴다. 내부적으로 구면 거리를 계산해준다.

```js
const dist = map.distance([myPos.lat, myPos.lng], [o.lat, o.lng]);  // 미터
```
> 라이딩 거리 누적에는 지도 객체가 없어도 되도록 직접 만든 Haversine 함수를 쓴다
> ([13_라이딩_기록.md](13_라이딩_기록.md) 참고). 같은 계산을 두 가지 방법으로 하는 셈.

---

## 좌표 순서 — 이 프로젝트 최대 함정
- **Leaflet**: `[위도(lat), 경도(lng)]`
- **GeoJSON / PostGIS / BRouter**: `[경도(lng), 위도(lat)]` ← 반대!

```js
// BRouter(GeoJSON) 응답 → Leaflet 용으로 뒤집기
coords: coordinates.map(([lng, lat]) => [lat, lng])

// Leaflet 배열 → 백엔드 저장용 객체
bikeRoute: bikeRouteRef.current.map(p => ({ lat: p[0], lng: p[1] }))

// 백엔드에서 PostGIS 저장 시 (RouteService.java)
new Coordinate(p.getLng(), p.getLat())   // (경도, 위도)
```

---

## React에서 Leaflet 사용 시 주의점
React는 가상 DOM을 쓰는데 Leaflet은 실제 DOM을 직접 조작한다.
→ `useRef` 로 실제 DOM 요소를 넘겨주고, `useEffect` 안에서 초기화한다.

```jsx
const mapNodeRef = useRef(null);
const mapRef = useRef(null);

useEffect(() => {
  mapRef.current = L.map(mapNodeRef.current, { center: seoulCenter, zoom: 12 });
  return () => { mapRef.current.remove(); mapRef.current = null; };  // 정리 필수
}, []);

return <div ref={mapNodeRef} style={{ height: '100%' }} />;
```

**비동기 콜백에서는 지도가 아직 살아있는지 확인해야 한다.**
```js
if (cancelled || !mapRef.current) return;  // 사라진 지도에 마커 추가 방지
```
개발 모드(StrictMode)에서 effect가 두 번 실행되면서 "옛 지도에 마커가 붙는" 버그가
실제로 났었고, 그래서 MapPage 곳곳에 이 방어 코드가 들어있다.

---

## 공부 리소스
- 공식 문서: https://leafletjs.com/reference.html
