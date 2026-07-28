import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { text, seoulCenter, KAKAO_API_KEY, GU_LIST } from '../constants';
import { makeTileLayer, drawMarkers, drawRoutes, requestBrouterRoute, routeHasCycleways, makeCurrentLocationIcon, makeOtherUserIcon } from '../utils/leaflet';
import { getCycleways, getRoutes, getRouteById, saveRoute as saveRouteApi, deleteRoutes as deleteRoutesApi } from '../api/routes';
import { reportLocation, getOtherLocations } from '../api/locations';

const GEOFENCE_RADIUS_M = 220;
const GEOFENCE_EXIT_M = 250;

function getLiveId(user) {
  if (user?.id) return user.id;
  let id = sessionStorage.getItem('liveLocId');
  if (!id) {
    id = String(1_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
    sessionStorage.setItem('liveLocId', id);
  }
  return Number(id);
}

export default function MapPage({ user: userProp, onBackHome }) {
  const user = userProp ?? (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const [mapLayer, setMapLayer] = useState('mapnik');
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [status, setStatus] = useState(text.routeHint);
  const [isRouting, setIsRouting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [cyclewayData, setCyclewayData] = useState(null);
  const [searchMode, setSearchMode] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [routeList, setRouteList] = useState([]);
  const [showRouteList, setShowRouteList] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const [locationShareEnabled, setLocationShareEnabled] = useState(false);

  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const bikeGeoLayerRef = useRef(null);
  const contextMenuRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const startPointRef = useRef(startPoint);
  const endPointRef = useRef(endPoint);
  const cyclewayDataRef = useRef(cyclewayData);
  const selectedRegionRef = useRef(selectedRegion);
  const bikeRouteRef = useRef([]);
  const shortestRouteRef = useRef([]);
  const currentLocMarkerRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const geofenceCircleRef = useRef(null);
  const lastPosRef = useRef(null);
  const otherMarkersRef = useRef(new Map());
  const othersInsideRef = useRef(new Map());

  useEffect(() => { startPointRef.current = startPoint; }, [startPoint]);
  useEffect(() => { endPointRef.current = endPoint; }, [endPoint]);
  useEffect(() => { cyclewayDataRef.current = cyclewayData; }, [cyclewayData]);
  useEffect(() => { selectedRegionRef.current = selectedRegion; }, [selectedRegion]);

  useEffect(() => {
    getCycleways()
      .then(data => setCyclewayData(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cyclewayData) return;

    if (bikeGeoLayerRef.current) {
      bikeGeoLayerRef.current.remove();
      bikeGeoLayerRef.current = null;
    }

    const features = selectedRegion === '전체'
      ? cyclewayData.features
      : cyclewayData.features.filter(f => f.properties.gu === selectedRegion);

    if (mapLayer !== 'cyclemap') {
      if (selectedRegion !== '전체') {
        const bounds = L.geoJSON({ type: 'FeatureCollection', features }).getBounds();
        if (bounds.isValid()) map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 });
      }
      return;
    }

    bikeGeoLayerRef.current = L.geoJSON(
      { type: 'FeatureCollection', features },
      { style: { color: '#2563eb', weight: 3, opacity: 0.75 } }
    ).addTo(map);

    if (selectedRegion !== '전체') {
      const bounds = bikeGeoLayerRef.current.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 });
      }
    }
  }, [cyclewayData, selectedRegion, mapLayer]);

  useEffect(() => {
    const container = mapNodeRef.current;
    if (!container) return;

    const map = L.map(container, {
      zoomControl: true,
      keepBuffer: 1,
      zoomSnap: 1,
      zoomDelta: 1,
      preferCanvas: true,
    }).setView(seoulCenter, 12);

    tileLayerRef.current = makeTileLayer('cyclemap').addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        map.invalidateSize({ animate: false });
      }
    });
    ro.observe(container);

    const timer = setTimeout(() => map.invalidateSize({ animate: false }), 200);

    return () => {
      ro.disconnect();
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    tileLayerRef.current.remove();
    tileLayerRef.current = makeTileLayer(mapLayer).addTo(map);
  }, [mapLayer]);

  // 실시간 현재 위치 추적 마커
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        lastPosRef.current = { lat: latitude, lng: longitude };
        if (!currentLocMarkerRef.current) {
          currentLocMarkerRef.current = L.marker([latitude, longitude], {
            icon: makeCurrentLocationIcon(),
            zIndexOffset: 1000,
            interactive: false,
          }).addTo(map);
          geofenceCircleRef.current = L.circle([latitude, longitude], {
            radius: GEOFENCE_RADIUS_M,
            color: '#2563eb',
            weight: 2,
            opacity: 0.6,
            fillColor: '#2563eb',
            fillOpacity: 0.08,
            interactive: false,
          });
          map.setView([latitude, longitude], 15);
        } else {
          currentLocMarkerRef.current.setLatLng([latitude, longitude]);
          geofenceCircleRef.current?.setLatLng([latitude, longitude]);
        }
      },
      (err) => {
        console.warn('위치 추적 실패:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (geoWatchIdRef.current != null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
      currentLocMarkerRef.current?.remove();
      currentLocMarkerRef.current = null;
      geofenceCircleRef.current?.remove();
      geofenceCircleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const myId = getLiveId(user);
    const myName = user?.name || `게스트${String(myId).slice(-4)}`;
    const markers = otherMarkersRef.current;
    const insideMap = othersInsideRef.current;

    const timer = setInterval(async () => {
      const myPos = lastPosRef.current;
      if (!myPos || !locationShareEnabled) return;

      try {
        await reportLocation({ userId: myId, name: myName, lat: myPos.lat, lng: myPos.lng });
        const others = (await getOtherLocations(myId)) || [];

        const seen = new Set();
        for (const o of others) {
          seen.add(o.userId);

          let marker = markers.get(o.userId);
          if (!marker) {
            marker = L.marker([o.lat, o.lng], { icon: makeOtherUserIcon(), zIndexOffset: 900 })
              .bindTooltip(o.name, { permanent: true, direction: 'top', offset: [0, -10] })
              .addTo(map);
            markers.set(o.userId, marker);
          } else {
            marker.setLatLng([o.lat, o.lng]);
          }

          const dist = map.distance([myPos.lat, myPos.lng], [o.lat, o.lng]);
          const wasInside = insideMap.get(o.userId) || false;
          const isInside = wasInside ? dist <= GEOFENCE_EXIT_M : dist <= GEOFENCE_RADIUS_M;
          if (isInside && !wasInside) {
            setStatus(`⚠️ ${o.name}님이 ${GEOFENCE_RADIUS_M}m 안에 접근! (거리 ${Math.round(dist)}m)`);
            marker.bindPopup(`${o.name} — ${Math.round(dist)}m 거리`).openPopup();
          } else if (!isInside && wasInside) {
            setStatus(`🚨 ${o.name}님이 범위를 벗어났습니다 (거리 ${Math.round(dist)}m)`);
            marker.bindPopup(`${o.name} — 범위 이탈 (${Math.round(dist)}m)`).openPopup();
          }
          insideMap.set(o.userId, isInside);
        }

        for (const [id, marker] of markers) {
          if (!seen.has(id)) {
            const name = marker.getTooltip()?.getContent() || '상대방';
            if (insideMap.get(id)) {
              setStatus(`📡 ${name}님 연결 끊김`);
            }
            marker.remove();
            markers.delete(id);
            insideMap.delete(id);
          }
        }
      } catch {
        // 오류는 다음 폴링에서 재시도
      }
    }, 3000);

    return () => {
      clearInterval(timer);
      markers.forEach(m => m.remove());
      markers.clear();
      insideMap.clear();
    };
  }, [user?.id, locationShareEnabled]);

  // 위치 공유 토글에 따라 원(동그라미) 보이기/숨기기
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geofenceCircleRef.current) return;

    if (locationShareEnabled) {
      geofenceCircleRef.current.addTo(map);
    } else {
      geofenceCircleRef.current.remove();
    }
  }, [locationShareEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleContextMenu = (e) => {
      e.originalEvent.preventDefault();
      const latlng = e.latlng;

      if (contextMenuRef.current) map.closePopup(contextMenuRef.current);

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:144px';

      const btnStart = document.createElement('button');
      btnStart.textContent = '시작지점으로 지정';
      btnStart.style.cssText = 'padding:8px 12px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500';

      const btnEnd = document.createElement('button');
      btnEnd.textContent = '도착지점으로 지정';
      btnEnd.style.cssText = 'padding:8px 12px;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500';

      btnStart.addEventListener('click', () => {
        setStartPoint({ lat: latlng.lat, lng: latlng.lng, label: text.startPlace });
        setStartQuery('');
        setStatus(text.routeHint);
        map.closePopup();
      });

      btnEnd.addEventListener('click', () => {
        setEndPoint({ lat: latlng.lat, lng: latlng.lng, label: text.endPlace });
        setEndQuery('');
        map.closePopup();
      });

      wrap.appendChild(btnStart);
      wrap.appendChild(btnEnd);

      contextMenuRef.current = L.popup({ closeButton: false })
        .setLatLng(latlng)
        .setContent(wrap)
        .openOn(map);
    };

    map.on('contextmenu', handleContextMenu);
    return () => map.off('contextmenu', handleContextMenu);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawMarkers(startPoint, endPoint, markerLayerRef.current);
    if (startPoint && endPoint) {
      findRoutes(startPoint, endPoint);
    } else {
      routeLayerRef.current?.clearLayers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoint, endPoint]);

  const openSearch = (type) => {
    setSearchMode(type);
    setSearchInput(type === 'start' ? startQuery : endQuery);
    setSearchResults([]);
  };

  const closeSearch = useCallback(() => {
    setSearchMode(null);
    setSearchInput('');
    setSearchResults([]);
  }, []);

  const fetchResults = useCallback(async (query) => {
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      const url = new URL('/v2/local/search/keyword.json', window.location.origin);
      url.searchParams.set('query', query);
      url.searchParams.set('size', '8');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Kakao API error', res.status, errText);
        setSearchResults([]);
        return;
      }
      const data = await res.json();
      setSearchResults((data.documents || []).map(d => ({
        label: d.place_name,
        address: d.road_address_name || d.address_name,
        lat: Number(d.y),
        lng: Number(d.x),
      })));
    } catch (err) {
      console.error('Kakao API fetch error:', err);
      setSearchResults([]);
    }
  }, []);

  const selectResult = useCallback((item) => {
    const point = { lat: item.lat, lng: item.lng, label: item.label };
    if (searchMode === 'start') {
      setStartPoint(point);
      setStartQuery(item.label);
    } else {
      setEndPoint(point);
      setEndQuery(item.label);
    }
    mapRef.current?.setView([item.lat, item.lng], 14);
    setSearchMode(null);
    setSearchInput('');
    setSearchResults([]);
  }, [searchMode]);

  // 저장 - 이름 입력받아서 전송
  const saveRoute = async () => {
    if (!startPoint || !endPoint) {
      alert('출발지와 도착지를 선택하세요');
      return;
    }

    const name = prompt('경로 이름을 입력하세요');
    if (!name) return;

    const body = {
      userId: user?.id ?? null,
      routeName: name,
      fromLat: startPoint.lat,
      fromLng: startPoint.lng,
      fromLabel: startPoint.label,
      toLat: endPoint.lat,
      toLng: endPoint.lng,
      toLabel: endPoint.label,
      bikeRoute: bikeRouteRef.current.map(p => ({ lat: p[0], lng: p[1] })),
      shortestRoute: shortestRouteRef.current.map(p => ({ lat: p[0], lng: p[1] })),
    };

    try {
      await saveRouteApi(body);
      alert('저장 완료!');
    } catch (e) {
      alert('저장 실패: ' + e.message);
    }
  };

  // 목록 불러오기
  const loadRouteList = async () => {
    const data = await getRoutes(user?.id ?? null);
    setRouteList(data);
    setCheckedIds([]);
    setShowRouteList(true);
  };

  const toggleCheck = (id) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    if (checkedIds.length === 0) return;
    if (!window.confirm(`선택한 ${checkedIds.length}개 경로를 삭제할까요?`)) return;
    try {
      await deleteRoutesApi(checkedIds);
      setRouteList(prev => prev.filter(r => !checkedIds.includes(r.id)));
      setCheckedIds([]);
    } catch (e) {
      alert('삭제 실패: ' + e.message);
    }
  };

  // 특정 경로 선택해서 지도에 표시
 const loadRouteById = async (id) => {
    const data = await getRouteById(id);

    console.log('불러온 데이터:', data); // 콘솔에서 확인용

    if (!data.bikeRoute?.length || !data.shortestRoute?.length) {
        alert('경로 데이터가 없습니다');
        return;
    }

    const bike = data.bikeRoute.map(p => [p.lat, p.lng]);
    const shortest = data.shortestRoute.map(p => [p.lat, p.lng]);

    setStartPoint({ lat: data.fromLat, lng: data.fromLng, label: data.fromLabel });
    setEndPoint({ lat: data.toLat, lng: data.toLng, label: data.toLabel });
    drawRoutes(bike, shortest, routeLayerRef.current, mapRef.current);
    setShowRouteList(false);
};

  const findRoutes = useCallback(async (from, to) => {
    setIsRouting(true);
    setStatus(text.searching);
    try {
      const [bikeRoute, shortestRoute] = await Promise.all([
        requestBrouterRoute(from, to, 'trekking'),
        requestBrouterRoute(from, to, 'shortest'),
      ]);
      bikeRouteRef.current = bikeRoute;
      shortestRouteRef.current = shortestRoute;
      drawRoutes(bikeRoute, shortestRoute, routeLayerRef.current, mapRef.current);
      const data = cyclewayDataRef.current;
      const region = selectedRegionRef.current;
      const features = data
        ? (region === '전체' ? data.features : data.features.filter(f => f.properties.gu === region))
        : [];
      setStatus(routeHasCycleways(bikeRoute, features) ? text.routeReady : text.noCycleways);

      // 경도/위도 데이터 콘솔 출력
      console.log('=== 경로 데이터 ===');
      console.log('출발지:', { 위도: from.lat, 경도: from.lng, 장소: from.label });
      console.log('도착지:', { 위도: to.lat, 경도: to.lng, 장소: to.label });
      console.log('자전거경로 좌표수:', bikeRoute.length);
      console.log('최단경로 좌표수:', shortestRoute.length);
      console.log('자전거경로 경도위도 데이터:', bikeRoute.map((p, i) => ({ 순번: i + 1, 위도: p[0], 경도: p[1] })));
      console.log('최단경로 경도위도 데이터:', shortestRoute.map((p, i) => ({ 순번: i + 1, 위도: p[0], 경도: p[1] })));
      console.log('선택된 경로', {
        출발지: { lat: from.lat, lng: from.lng, label: from.label },
        도착지: { lat: to.lat, lng: to.lng, label: to.label },
        자전거경로좌표수: bikeRoute.length,
        최단경로좌표수: shortestRoute.length,
        자전거경로: bikeRoute,
        최단경로: shortestRoute,
        timestamp: new Date().toISOString(),
      });
    } catch {
      setStatus(text.routeFailed);
      routeLayerRef.current?.clearLayers();
    } finally {
      setIsRouting(false);
    }
  }, []);

  const resetPlanner = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setStartQuery('');
    setEndQuery('');
    setStatus(text.routeHint);
    markerLayerRef.current?.clearLayers();
    routeLayerRef.current?.clearLayers();
    mapRef.current?.setView(seoulCenter, 12);
  }, []);

  return (
    <div className="mapOnlyPage">
      <header className="mapOnlyHeader">
        <a className="brand mapBrand" href="/" onClick={onBackHome}>PedalLink</a>
        <div>
          <h1 id="map-title">{text.mapTitle}</h1>
        </div>
        <div className="mapActions">
          <label className="layerSelect">
            <span>{text.layerLabel}</span>
            <select value={mapLayer} onChange={(e) => setMapLayer(e.target.value)}>
              <option value="mapnik">{text.defaultLayer}</option>
              <option value="cyclemap">{text.bicycleLayer}</option>
            </select>
          </label>
          <label className="regionSelect">
            <span>{text.regionLabel}</span>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
              <option value="전체">{text.regionAll}</option>
              {GU_LIST.map(gu => <option key={gu} value={gu}>{gu}</option>)}
            </select>
          </label>
          <a className="mapCloseButton" href="/" onClick={onBackHome}>{text.close}</a>
        </div>
      </header>

      <section className="mapWorkspace">
        <aside className={`routePlanner${searchMode ? ' searchActive' : ''}`} aria-label="Route planner">
          {searchMode ? (
            <>
              <div className="searchOverlayHeader">
                <button className="backBtn" type="button" onClick={closeSearch}>&#8592;</button>
                <input
                  autoFocus
                  className="searchOverlayInput"
                  value={searchInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchInput(val);
                    clearTimeout(searchDebounceRef.current);
                    searchDebounceRef.current = setTimeout(() => fetchResults(val), 300);
                  }}
                  placeholder={searchMode === 'start' ? text.startPlaceholder : text.endPlaceholder}
                  autoComplete="off"
                />
                {searchInput && (
                  <button className="clearBtn" type="button" onClick={() => { setSearchInput(''); setSearchResults([]); }}>&#10005;</button>
                )}
              </div>
              <ul className="searchResultsList">
                {searchResults.length === 0 && searchInput.trim() && (
                  <li className="noResult">검색 결과가 없습니다.</li>
                )}
                {searchResults.map((item, i) => (
                  <li key={i} onClick={() => selectResult(item)}>
                    <svg className="resultPin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <div className="resultInfo">
                      <span className="sug-name">{item.label}</span>
                      <span className="sug-addr">{item.address}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div style={{ padding: '12px', marginBottom: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="locationToggle"
                  checked={locationShareEnabled}
                  onChange={(e) => setLocationShareEnabled(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <label htmlFor="locationToggle" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '500', margin: '0' }}>
                  위치 공유
                </label>
              </div>
              <div className="pointInputWrapper">
                <div className="dotsColumn">
                  <span className="pointDot startDot" />
                  <span className="pointLine" />
                  <span className="pointDot endDot" />
                </div>
                <div className="fieldsColumn">
                  <button className="pointField" type="button" onClick={() => openSearch('start')}>
                    {startQuery
                      ? <span className="pointLabel">{startQuery}</span>
                      : <span className="pointPlaceholder">{text.startPlaceholder}</span>
                    }
                  </button>
                  <button className="pointField" type="button" onClick={() => openSearch('end')}>
                    {endQuery
                      ? <span className="pointLabel">{endQuery}</span>
                      : <span className="pointPlaceholder">{text.endPlaceholder}</span>
                    }
                  </button>
                </div>
              </div>
              <div className="routeLegend" aria-label="Route legend">
                <span className="routeSample bikeSample" />
                <span>{text.bikeRoute}</span>
                <span className="routeSample shortestSample" />
                <span>{text.shortestRoute}</span>
              </div>
              <p className="routeStatus" aria-live="polite">
                {isRouting ? text.searching : status}
              </p>
              {/* 저장/목록 버튼 */}
              <button className="resetButton" type="button" onClick={saveRoute}>
                경로 저장
              </button>
              <button className="resetButton" type="button" onClick={loadRouteList}>
                저장된 경로 목록
              </button>
              <button className="resetButton" type="button" onClick={resetPlanner}>{text.reset}</button>

              {/* 경로 목록 패널 */}
              {showRouteList && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>저장된 경로</h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {checkedIds.length > 0 && (
                        <button type="button" onClick={handleDelete} style={{ fontSize: '12px', padding: '3px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          삭제 ({checkedIds.length})
                        </button>
                      )}
                      <button type="button" onClick={() => setShowRouteList(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                  {routeList.length === 0 ? (
                    <p style={{ margin: '8px 0', fontSize: '12px', color: '#666' }}>저장된 경로가 없습니다.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                      {routeList.map(r => (
                        <li key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px', marginBottom: '6px', backgroundColor: checkedIds.includes(r.id) ? '#eff6ff' : '#fff', borderRadius: '4px', borderLeft: `3px solid ${checkedIds.includes(r.id) ? '#ef4444' : '#2563eb'}` }}>
                          <input
                            type="checkbox"
                            checked={checkedIds.includes(r.id)}
                            onChange={() => toggleCheck(r.id)}
                            style={{ marginTop: '3px', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => loadRouteById(r.id)}>
                            <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>{r.routeName}</div>
                            <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>{r.fromLabel} → {r.toLabel}</div>
                            <div style={{ fontSize: '11px', color: '#999' }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </aside>

        <div className="leafletMap" ref={mapNodeRef} />
      </section>
    </div>
  );
}
