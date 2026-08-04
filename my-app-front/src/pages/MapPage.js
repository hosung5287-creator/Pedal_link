import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { text, seoulCenter, KAKAO_API_KEY, GU_LIST } from '../constants';
import { makeTileLayer, drawMarkers, drawRoutes, requestBrouterRoute, routeHasCycleways, makeCurrentLocationIcon } from '../utils/leaflet';
import { getCycleways, getRoutes, getRouteById, saveRoute as saveRouteApi, deleteRoutes as deleteRoutesApi } from '../api/routes';
import { riderApi } from '../api/client'; // riderApi 불러오기

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

  // 실시간 GPS 라이딩 관련 State 및 Ref
  const [isRiding, setIsRiding] = useState(false);       // 라이딩 중 여부
  const [rideTime, setRideTime] = useState(0);           // 경과 시간 (초)
  const [rideDistance, setRideDistance] = useState(0);   // 누적 이동 거리 (m)

  const rideTimerRef = useRef(null);
  const lastPosRef = useRef(null);                       // 직전 GPS 좌표
  const rideWatchIdRef = useRef(null);                   // GPS 감시 ID

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
        if (!currentLocMarkerRef.current) {
          currentLocMarkerRef.current = L.marker([latitude, longitude], {
            icon: makeCurrentLocationIcon(),
            zIndexOffset: 1000,
            interactive: false,
          }).addTo(map);
          map.setView([latitude, longitude], 15);
        } else {
          currentLocMarkerRef.current.setLatLng([latitude, longitude]);
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
    };
  }, []);

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

  // 저장 - 경로 이름 입력받아서 전송
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

  // 🚴‍♂️ 1) 실시간 라이딩 시작
  const handleStartRide = () => {
    const riderId = user?.id || 1; // 유저 ID가 없으면 기본값 1 적용

    setIsRiding(true);
    setRideTime(0);
    setRideDistance(0);
    lastPosRef.current = null;

    // 타이머 (1초마다 시간 증가)
    rideTimerRef.current = setInterval(() => {
      setRideTime(prev => prev + 1);
    }, 1000);

    // GPS 위치 실시간 추적 및 DB 실시간 업데이트 (rider_real_time_location)
    if (navigator.geolocation) {
      rideWatchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const currentLatLng = L.latLng(latitude, longitude);

          // A. 실시간 위치 DB 업데이트 전송 (1번 테이블)
          await riderApi.updateRealTimeLocation(riderId, latitude, longitude);

          // B. 누적 이동 거리 계산
          if (lastPosRef.current) {
            const dist = lastPosRef.current.distanceTo(currentLatLng);
            // GPS 오차 보정 (0.5m ~ 50m 사이의 이동만 누적)
            if (dist > 0.5 && dist < 50) {
              setRideDistance(prev => prev + dist);
            }
          }
          lastPosRef.current = currentLatLng;
        },
        (err) => console.warn('GPS 추적 실패:', err.message),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    }
  };

  // 🚴‍♂️ 2) 라이딩 종료 및 히스토리 DB 저장 (rider_activity_history)
  const handleStopRideAndSave = async () => {
    clearInterval(rideTimerRef.current);
    if (rideWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(rideWatchIdRef.current);
    }
    setIsRiding(false);

    const riderId = user?.id || 1;
    const finalDistanceKm = Number((rideDistance / 1000).toFixed(2));  // km 단위
    const durationMinutes = Math.max(1, Math.round(rideTime / 60));    // 분 단위 (최소 1분)

    // 평균 속도 (km/h) = 이동거리(km) / 시간(시간)
    const hours = rideTime / 3600;
    const averageSpeed = hours > 0 ? Number((finalDistanceKm / hours).toFixed(2)) : 0;

    const historyData = {
      riderId: riderId,
      routeDistance: finalDistanceKm,
      durationMinutes: durationMinutes,
      averageSpeed: averageSpeed,
      startedAt: new Date(Date.now() - rideTime * 1000).toISOString(),
      endedAt: new Date().toISOString()
    };

    try {
      const res = await riderApi.saveActivityHistory(historyData);
      alert(`주행 완료!\n- 주행 거리: ${finalDistanceKm} km\n- 주행 시간: ${durationMinutes} 분\n- 평균 속도: ${averageSpeed} km/h\n\n히스토리가 성공적으로 DB에 저장되었습니다.`);
      console.log('저장 결과:', res);
    } catch (e) {
      console.error('주행 기록 저장 실패:', e);
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

    console.log('불러온 데이터:', data);

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

              {/* 실시간 라이딩 제어 대시보드 */}
              <div style={{ margin: '12px 0', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                {isRiding ? (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: 'bold' }}>실시간 라이딩 중...</span>
                      <h2 style={{ margin: '4px 0', fontSize: '24px', color: '#0284c7' }}>
                        {(rideDistance / 1000).toFixed(2)} <span style={{ fontSize: '14px' }}>km</span>
                      </h2>
                      <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                        {Math.floor(rideTime / 60)}분 {rideTime % 60}초
                      </p>
                    </div>
                    <button
                      className="resetButton"
                      type="button"
                      onClick={handleStopRideAndSave}
                      style={{ backgroundColor: '#ef4444', color: '#fff', fontWeight: 'bold', width: '100%' }}
                    >
                      주행 종료 및 DB 저장
                    </button>
                  </>
                ) : (
                  <button
                    className="resetButton"
                    type="button"
                    onClick={handleStartRide}
                    style={{ backgroundColor: '#16a34a', color: '#fff', fontWeight: 'bold', width: '100%' }}
                  >
                    라이딩 시작하기
                  </button>
                )}
              </div>
              
              {/* 경로 저장 버튼 */}
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