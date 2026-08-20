import '../styles/map.css';

import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { text, seoulCenter, KAKAO_API_KEY, GU_LIST } from '../constants';
import { makeTileLayer, drawMarkers, drawRoutes, requestBrouterRoute, routeHasCycleways, makeCurrentLocationIcon, makeOtherUserIcon } from '../utils/leaflet';
import { getCycleways, getRoutes, getRouteById, saveRoute as saveRouteApi, deleteRoutes as deleteRoutesApi } from '../api/routes';
import { reportLocation, getOtherLocations } from '../api/locations';
import { updateLocationSharing } from '../api/auth';
import { api } from '../api/client';

const GEOFENCE_RADIUS_M = 220;
const GEOFENCE_EXIT_M = 250;

// 사용자 ID 가져오기 — 로그인한 경우 DB ID, 비로그인 시 세션 스토리지에 임의 생성
function getLiveId(user) {
  if (user?.id) return user.id;
  let id = sessionStorage.getItem('liveLocId');
  if (!id) {
    id = String(1_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
    sessionStorage.setItem('liveLocId', id);
  }
  return Number(id);
}

// 경로 분석 표시용 — 노면/도로종류 한글 라벨 + 색상 팔레트
const SURFACE_LABELS = {
  asphalt: '아스팔트', paving_stones: '보도블록', concrete: '콘크리트', sett: '돌포장',
  compacted: '다짐길', fine_gravel: '고운자갈', gravel: '자갈', unpaved: '비포장',
  ground: '흙길', dirt: '흙길', sand: '모래', grass: '잔디', wood: '목재', unknown: '미표기',
};
const HIGHWAY_LABELS = {
  cycleway: '자전거도로', path: '소로', footway: '보행로', pedestrian: '보행자도로',
  residential: '주택가길', living_street: '생활도로', service: '이면도로', track: '농로',
  unclassified: '기타도로', tertiary: '3차로', secondary: '2차로', primary: '간선도로',
  trunk: '자동차도로', steps: '계단', unknown: '미표기',
};
const ANALYSIS_PALETTE = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#64748b', '#eab308'];

// 노면/도로종류 분포 — 가로 막대 + 범례
function AnalysisBar({ title, items, labels }) {
  const top = items.slice(0, 6);
  return (
    <div className="analysisGroup">
      <h4 className="analysisTitle">{title}</h4>
      <div className="analysisTrack">
        {top.map((it, i) => (
          <span
            key={it.key}
            className="analysisSeg"
            style={{ width: `${it.pct}%`, background: ANALYSIS_PALETTE[i % ANALYSIS_PALETTE.length] }}
            title={`${labels[it.key] || it.key} ${it.pct}%`}
          />
        ))}
      </div>
      <ul className="analysisLegend">
        {top.map((it, i) => (
          <li key={it.key}>
            <span className="legendDot" style={{ background: ANALYSIS_PALETTE[i % ANALYSIS_PALETTE.length] }} />
            <span className="legendName">{labels[it.key] || it.key}</span>
            <span className="legendPct">{it.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveRouteName, setSaveRouteName] = useState('');
  const [toast, setToast] = useState(null); // { msg, type: 'info'|'error' }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toastTimer = useRef(null);

  const showToast = (msg, type = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  const [checkedIds, setCheckedIds] = useState([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [routeStats, setRouteStats] = useState(null);
  const [locationShareEnabled, setLocationShareEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('locationShareEnabled');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // 라이딩 관련 상태
  const [isRiding, setIsRiding] = useState(false);
  const [rideTime, setRideTime] = useState(0);
  const [rideDistance, setRideDistance] = useState(0);

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

  // 라이딩 관련 ref
  const rideTimerRef = useRef(null);
  const rideWatchIdRef = useRef(null);
  const rideStartPosRef = useRef(null);
  const rideStartTimeRef = useRef(null);

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
      zoomControl: false, // 기본(왼쪽 위) 끄고 아래에서 오른쪽 위로 추가
      keepBuffer: 1,
      zoomSnap: 1,
      zoomDelta: 1,
      preferCanvas: true,
    }).setView(seoulCenter, 12);

    // 확대/축소 버튼을 오른쪽 위로 (왼쪽 검색 패널에 안 가리게)
    L.control.zoom({ position: 'topright' }).addTo(map);

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

    let cancelled = false;
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // 지도가 이미 제거됐거나(언마운트) 재생성됐으면 무시 — 옛 지도에 마커 추가 방지
        if (cancelled || !mapRef.current) return;
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
      cancelled = true;
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

  const handleLocationShareChange = useCallback(async (checked) => {
    setLocationShareEnabled(checked);
    localStorage.setItem('locationShareEnabled', JSON.stringify(checked));

    if (user?.id) {
      try {
        await updateLocationSharing(user.id, checked);
      } catch (error) {
        console.warn('오프라인: localStorage에만 저장됨', error);
      }
    }
  }, [user?.id]);

  // 거리 계산 함수 (Haversine)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // 지구 반지름 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  };

  // 라이딩 시작
  const handleRideStart = useCallback(() => {
    setIsRiding(true);
    setRideTime(0);
    setRideDistance(0);
    rideStartTimeRef.current = Date.now();

    if (!navigator.geolocation) return;

    rideWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        if (!rideStartPosRef.current) {
          rideStartPosRef.current = { lat: latitude, lng: longitude };
        } else {
          const dist = calculateDistance(
            rideStartPosRef.current.lat, rideStartPosRef.current.lng,
            latitude, longitude
          );
          if (dist > 5) { // 5m 이상만 거리 계산
            setRideDistance(prev => prev + dist);
            rideStartPosRef.current = { lat: latitude, lng: longitude };
          }
        }
      }
    );

    // 타이머 시작
    rideTimerRef.current = setInterval(() => {
      setRideTime(prev => prev + 1);
    }, 1000);
  }, []);

  // 라이딩 종료
  const handleRideStop = useCallback(async () => {
    setIsRiding(false);

    // GPS 감시 중지
    if (rideWatchIdRef.current) {
      navigator.geolocation.clearWatch(rideWatchIdRef.current);
      rideWatchIdRef.current = null;
    }

    // 타이머 중지
    if (rideTimerRef.current) {
      clearInterval(rideTimerRef.current);
      rideTimerRef.current = null;
    }

    // 주행 기록 저장
    if (user?.id && rideDistance > 0) {
      try {
        const duration = Math.floor(rideTime / 60); // 분 단위
        await api.post('/api/ride-records', {
          userId: user.id,
          distance: rideDistance / 1000, // km로 변환
          duration
        });
        showToast(`주행 기록 저장됨! ${(rideDistance / 1000).toFixed(2)}km · ${duration}분`);
      } catch (error) {
        console.error('주행 기록 저장 실패:', error);
        showToast('주행 기록 저장에 실패했습니다.', 'error');
      }
    }

    // 리셋
    rideStartPosRef.current = null;
    rideStartTimeRef.current = null;
  }, [user?.id, rideTime, rideDistance]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
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
        // 네트워크 대기 중 지도가 제거됐으면 중단 — 옛 지도에 마커 추가 방지
        if (cancelled || !mapRef.current) return;

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
      cancelled = true;
      clearInterval(timer);
      markers.forEach(m => m.remove());
      markers.clear();
      insideMap.clear();
    };
    // user 객체는 매 렌더마다 새로 생성되므로 안정적인 user?.id 에만 의존 (의도된 것)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 온라인 복귀 시 localStorage의 설정을 DB와 동기화
  useEffect(() => {
    const handleOnline = async () => {
      if (!user?.id) return;
      const localValue = JSON.parse(localStorage.getItem('locationShareEnabled') || 'false');
      try {
        await updateLocationSharing(user.id, localValue);
      } catch (error) {
        console.warn('동기화 실패', error);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

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

  // 저장 버튼 → 모달 열기
  const saveRoute = () => {
    if (!startPoint || !endPoint) {
      showToast('출발지와 도착지를 선택하세요', 'error');
      return;
    }
    setSaveRouteName('');
    setSaveModalOpen(true);
  };

  // 모달 확인 → 실제 저장
  const confirmSaveRoute = async () => {
    if (!saveRouteName.trim()) return;
    const body = {
      userId: user?.id ?? null,
      routeName: saveRouteName.trim(),
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
      setSaveModalOpen(false);
      showToast('경로가 저장되었습니다');
    } catch (e) {
      showToast('저장 실패: ' + e.message, 'error');
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

  const handleDelete = () => {
    if (checkedIds.length === 0) return;
    setConfirmDelete(true);
  };

  const confirmHandleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteRoutesApi(checkedIds);
      setRouteList(prev => prev.filter(r => !checkedIds.includes(r.id)));
      setCheckedIds([]);
      showToast('삭제되었습니다');
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  };

  // 특정 경로 선택해서 지도에 표시
 const loadRouteById = async (id) => {
    const data = await getRouteById(id);

    console.log('불러온 데이터:', data); // 콘솔에서 확인용

    if (!data.bikeRoute?.length || !data.shortestRoute?.length) {
        showToast('경로 데이터가 없습니다', 'error');
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
      const [bike, short] = await Promise.all([
        requestBrouterRoute(from, to, 'trekking'),
        requestBrouterRoute(from, to, 'shortest'),
      ]);
      const bikeRoute = bike.coords;
      const shortestRoute = short.coords;
      setRouteStats(bike.stats);
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
    setRouteStats(null);
    markerLayerRef.current?.clearLayers();
    routeLayerRef.current?.clearLayers();
    // 지도 시점(중심·줌)은 그대로 유지 — 보던 위치에서 튀지 않게
  }, []);

  return (
    <div className="mapOnlyPage">
      {/* 토스트 알림 */}
      {toast && (
        <div className={`mapToast${toast.type === 'error' ? ' isError' : ''}`}>
          {toast.msg}
        </div>
      )}

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

      <section className={`mapWorkspace${panelOpen ? '' : ' panelClosed'}`}>
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
              <div className="plannerToggleRow">
                <input
                  type="checkbox"
                  id="locationToggle"
                  checked={locationShareEnabled}
                  onChange={(e) => handleLocationShareChange(e.target.checked)}
                />
                <label htmlFor="locationToggle">
                  위치 공유
                </label>
              </div>

              {/* 라이딩 섹션 */}
              <div className="plannerRideBox">
                <div className="plannerRideAction">
                  <button
                    onClick={isRiding ? handleRideStop : handleRideStart}
                    className={`plannerRideBtn${isRiding ? ' isRiding' : ''}`}
                  >
                    {isRiding ? '라이딩 종료' : '라이딩 시작'}
                  </button>
                </div>
                {isRiding && (
                  <div className="plannerRideStats">
                    <div>시간: {Math.floor(rideTime / 60)}:{(rideTime % 60).toString().padStart(2, '0')}</div>
                    <div>거리: {(rideDistance / 1000).toFixed(2)}km</div>
                  </div>
                )}
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

              {/* 경로 분석 (BRouter 데이터) */}
              {routeStats && (
                <div className="routeAnalysis">
                  <div className="analysisStats">
                    <div className="statTile">
                      <span className="statValue">{routeStats.distanceKm}</span>
                      <span className="statLabel">km</span>
                    </div>
                    <div className="statTile">
                      <span className="statValue">{routeStats.ascendM}</span>
                      <span className="statLabel">m 상승</span>
                    </div>
                    <div className="statTile">
                      <span className="statValue">{routeStats.timeMin}</span>
                      <span className="statLabel">분</span>
                    </div>
                  </div>
                  <AnalysisBar title="노면" items={routeStats.surfaces} labels={SURFACE_LABELS} />
                  <AnalysisBar title="도로 종류" items={routeStats.highways} labels={HIGHWAY_LABELS} />
                </div>
              )}

              {/* 저장/목록 버튼 */}
              <button className="resetButton btn btn--solid" type="button" onClick={saveRoute}>
                경로 저장
              </button>

              {/* 경로 이름 입력 모달 */}
              {saveModalOpen && (
                <div className="routeSaveModal">
                  <p>경로 이름을 입력하세요</p>
                  <input
                    type="text"
                    value={saveRouteName}
                    onChange={(e) => setSaveRouteName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveRoute(); if (e.key === 'Escape') setSaveModalOpen(false); }}
                    placeholder="예: 한강 자전거 코스"
                    autoFocus
                  />
                  <div className="routeSaveActions">
                    <button type="button" className="btn btn--solid" onClick={confirmSaveRoute} disabled={!saveRouteName.trim()}>저장</button>
                    <button type="button" className="btn" onClick={() => setSaveModalOpen(false)}>취소</button>
                  </div>
                </div>
              )}
              <button className="resetButton btn btn--solid" type="button" onClick={loadRouteList}>
                저장된 경로 목록
              </button>
              <button className="resetButton btn btn--solid" type="button" onClick={resetPlanner}>{text.reset}</button>

              {/* 경로 목록 패널 */}
              {showRouteList && (
                <div className="routeListPanel">
                  <div className="routeListHead">
                    <h3>저장된 경로</h3>
                    <div className="routeListActions">
                      {checkedIds.length > 0 && (
                        confirmDelete ? (
                          <span className="routeDeleteConfirm">
                            <span>{checkedIds.length}개 삭제?</span>
                            <button type="button" onClick={confirmHandleDelete} className="routeConfirmBtn isDanger">확인</button>
                            <button type="button" onClick={() => setConfirmDelete(false)} className="routeConfirmBtn isNeutral">취소</button>
                          </span>
                        ) : (
                          <button type="button" onClick={handleDelete} className="routeDeleteBtn">
                            삭제 ({checkedIds.length})
                          </button>
                        )
                      )}
                      <button type="button" onClick={() => setShowRouteList(false)} className="routeListClose">✕</button>
                    </div>
                  </div>
                  {routeList.length === 0 ? (
                    <p className="routeListEmpty">저장된 경로가 없습니다.</p>
                  ) : (
                    <ul className="routeListUl">
                      {routeList.map(r => (
                        <li key={r.id} className={`routeListItem${checkedIds.includes(r.id) ? ' isChecked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checkedIds.includes(r.id)}
                            onChange={() => toggleCheck(r.id)}
                          />
                          <div className="routeListInfo" onClick={() => loadRouteById(r.id)}>
                            <div className="routeListName">{r.routeName}</div>
                            <div className="routeListPath">{r.fromLabel} → {r.toLabel}</div>
                            <div className="routeListDate">{new Date(r.createdAt).toLocaleDateString()}</div>
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

        <button
          className="panelToggle"
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-label={panelOpen ? '검색 패널 접기' : '검색 패널 펼치기'}
          title={panelOpen ? '검색 패널 접기' : '검색 패널 펼치기'}
        >
          {panelOpen ? '‹' : '›'}
        </button>

        <div className="leafletMap" ref={mapNodeRef} />
      </section>
    </div>
  );
}
