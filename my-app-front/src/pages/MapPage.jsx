import '../styles/map.css';

import BrandLogo from '../components/BrandLogo';

import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { text, seoulCenter, KAKAO_API_KEY, GU_LIST } from '../constants';
import { makeTileLayer, drawMarkers, drawRoutes, requestBrouterRoute, routeHasCycleways, makeCurrentLocationIcon, makeOtherUserIcon, makeHeadingIcon, bearingBetween } from '../utils/leaflet';
import { getCycleways, getRoutes, getRouteById, saveRoute as saveRouteApi, deleteRoutes as deleteRoutesApi } from '../api/routes';
import { reportLocation, getOtherLocations } from '../api/locations';
import { updateLocationSharing } from '../api/auth';
import { useLocationShare } from '../hooks/useLocationShare';
import { getParty, endParty, startPartyRide } from '../api/parties';
import { api } from '../api/client';

const GEOFENCE_RADIUS_M = 50;
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

// 근접 말풍선(B) — 파티원 마커에 붙는 커스텀 라벨.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtProxDist(d) {
  if (d == null) return '';
  return d < 1000 ? `${Math.round(d)}m 근처` : `${(d / 1000).toFixed(1)}km`;
}
function proxBubbleHtml(name, dist) {
  const letter = (name || '?').trim().charAt(0);
  return `<span class="proxAvatar">${escapeHtml(letter)}</span>`
    + `<span class="proxText"><strong>${escapeHtml(name)}</strong>`
    + `<span class="proxDist">${fmtProxDist(dist)}</span></span>`;
}

export default function MapPage({ user: userProp, partyId, onBackHome, onMoveParty, onMoveBrowse }) {
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

  // 근접 알림 토스트(A) — 파티원이 반경에 들어오거나 벗어날 때 상단에 잠깐 뜬다.
  const [proxAlert, setProxAlert] = useState(null); // { name, dist, entering }
  const proxTimer = useRef(null);
  const showProxAlert = (info) => {
    clearTimeout(proxTimer.current);
    setProxAlert(info);
    proxTimer.current = setTimeout(() => setProxAlert(null), 4500);
  };
  useEffect(() => () => { clearTimeout(proxTimer.current); clearTimeout(toastTimer.current); }, []);

  const [checkedIds, setCheckedIds] = useState([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [routeStats, setRouteStats] = useState(null);
  // 파티 라이딩 모드 — /map?partyId=N 으로 들어왔을 때만 채워진다
  const [party, setParty] = useState(null);
  // 팔로우 모드 — 지도 중심이 내 위치를 계속 따라간다 (라이딩 중에만 켠다)
  const [following, setFollowing] = useState(false);
  // 위치 공유는 파티 도크와 공유하는 상태 (localStorage + 이벤트 동기화)
  const [locationShareEnabled, setLocationShare] = useLocationShare(user?.id);

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
  // watchPosition 콜백은 최초 1회만 만들어지므로 state 를 직접 읽으면 낡은 값을 본다 → ref 로 본다
  const followingRef = useRef(false);
  const headingRef = useRef(0);
  const otherMarkersRef = useRef(new Map());
  const othersInsideRef = useRef(new Map());

  // 라이딩 관련 ref
  const rideTimerRef = useRef(null);
  const rideWatchIdRef = useRef(null);
  const rideStartPosRef = useRef(null);
  const rideStartTimeRef = useRef(null);

  useEffect(() => { followingRef.current = following; }, [following]);
  useEffect(() => { startPointRef.current = startPoint; }, [startPoint]);
  useEffect(() => { endPointRef.current = endPoint; }, [endPoint]);
  useEffect(() => { cyclewayDataRef.current = cyclewayData; }, [cyclewayData]);
  useEffect(() => { selectedRegionRef.current = selectedRegion; }, [selectedRegion]);

  useEffect(() => {
    getCycleways()
      .then(data => setCyclewayData(data))
      .catch(() => {});
  }, []);

  // 참가자 자동 출발 —
  // 호스트가 시작하면 party.rideStartedAt 이 채워진다. 참가자 화면은 그걸 폴링으로
  // 감지해 자기 타이머를 시작한다(거리는 각자 기기가 자기 GPS 로 측정).
  // 서버가 남의 거리를 알 수 없으므로 "같이 출발"만 신호로 맞추는 방식이다.
  useEffect(() => {
    if (!partyId || !party) return;
    const isHost = user?.id === party.hostId;
    if (isHost || isRiding || party.rideStartedAt) return;   // 호스트/이미 주행중/이미 시작됨 제외

    const timer = setInterval(async () => {
      try {
        const p = await getParty(partyId);
        if (p.rideStartedAt) {
          setParty(p);
          handleRideStart();
          showToast('호스트가 라이딩을 시작했습니다.');
        }
      } catch { /* 다음 주기에 재시도 */ }
    }, 5000);

    return () => clearInterval(timer);
    // handleRideStart 는 party 를 참조해 매번 새로 만들어지므로 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, party?.hostId, party?.rideStartedAt, isRiding, user?.id]);

  // ── 파티 라이딩 모드 ─────────────────────────────
  // /map?partyId=N 으로 들어오면 (1) 위치공유를 자동으로 켜고
  // (2) 파티에 걸린 코스를 지도에 그린다.
  useEffect(() => {
    if (!partyId) return;
    let alive = true;

    // 서로 보이지 않으면 파티 라이딩이 성립하지 않으므로 자동으로 켠다.
    // (사용자가 원하면 패널의 체크박스로 끌 수 있다)
    setLocationShare(true);

    (async () => {
      try {
        const p = await getParty(partyId);
        if (!alive) return;
        setParty(p);

        if (p.routeId) {
          const route = await getRouteById(p.routeId);
          if (!alive || !mapRef.current) return;
          if (route.bikeRoute?.length && route.shortestRoute?.length) {
            const bike = route.bikeRoute.map(pt => [pt.lat, pt.lng]);
            const shortest = route.shortestRoute.map(pt => [pt.lat, pt.lng]);
            bikeRouteRef.current = bike;
            shortestRouteRef.current = shortest;
            setStartPoint({ lat: route.fromLat, lng: route.fromLng, label: route.fromLabel });
            setEndPoint({ lat: route.toLat, lng: route.toLng, label: route.toLabel });
            drawRoutes(bike, shortest, routeLayerRef.current, mapRef.current);
          }
        }
        setStatus(`${p.title} — 파티 멤버 ${p.participants.length}명과 라이딩 중`);
      } catch {
        if (alive) showToast('파티 정보를 불러오지 못했습니다.', 'error');
      }
    })();

    return () => { alive = false; };
    // user 객체는 매 렌더 새로 만들어지므로 id 만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, user?.id]);

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

    // 사용자가 지도를 끌면 팔로우를 끈다.
    // 안 그러면 다른 곳을 보려고 옮겨도 다음 GPS 갱신 때 내 위치로 튕겨 돌아온다.
    map.on('dragstart', () => setFollowing(false));

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
        const prev = lastPosRef.current;
        lastPosRef.current = { lat: latitude, lng: longitude };

        // ── 진행 방향(heading) 결정 ──
        // 1순위: 기기가 준 heading. 단 정지 중이면 null 이 오는 경우가 많다.
        // 2순위: 직전 좌표와의 방위각. 단 GPS 흔들림으로 제자리에서도 값이 튀므로
        //        3m 이상 움직였을 때만 갱신한다. 둘 다 없으면 마지막 방향을 유지.
        if (typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)) {
          headingRef.current = pos.coords.heading;
        } else if (prev) {
          const moved = calculateDistance(prev.lat, prev.lng, latitude, longitude);
          if (moved > 3) {
            headingRef.current = (bearingBetween(prev, { lat: latitude, lng: longitude }) + 360) % 360;
          }
        }

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

          // 라이딩 중에는 화살표가 진행 방향을 가리키게 아이콘을 갈아끼운다
          if (followingRef.current) {
            currentLocMarkerRef.current.setIcon(makeHeadingIcon(headingRef.current));
          }
        }

        // 팔로우 모드: 지도 중심을 내 위치로. setView 가 아니라 panTo 를 쓰는 이유는
        // setView 가 매번 줌을 고정해 사용자가 확대/축소한 것을 되돌려버리기 때문이다.
        if (followingRef.current) {
          map.panTo([latitude, longitude], { animate: true, duration: 0.5 });
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
  // "내 위치로" — 지도를 내 위치로 옮기고 팔로우를 다시 켠다
  const recenter = useCallback(() => {
    const pos = lastPosRef.current;
    if (!pos) {
      showToast('아직 현재 위치를 받지 못했습니다.', 'error');
      return;
    }
    mapRef.current?.panTo([pos.lat, pos.lng], { animate: true });
    setFollowing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRideStart = useCallback(() => {
    setIsRiding(true);
    setFollowing(true);   // 라이딩 중에는 지도가 내 위치를 따라간다

    // 호스트가 시작하면 서버에 알려 참가자 화면도 같이 출발하게 한다
    if (party && user?.id === party.hostId && !party.rideStartedAt) {
      startPartyRide(party.id, user.id)
        .then(setParty)
        .catch(() => {});
    }
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
    setFollowing(false);
    // 방향 화살표를 원래의 현재위치 아이콘으로 되돌린다
    currentLocMarkerRef.current?.setIcon(makeCurrentLocationIcon());

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
          duration,
          partyId: party ? party.id : null,   // 파티 라이딩이면 함께 묶어 저장
        });
        showToast(`주행 기록 저장됨! ${(rideDistance / 1000).toFixed(2)}km · ${duration}분`);
      } catch (error) {
        console.error('주행 기록 저장 실패:', error);
        showToast('주행 기록 저장에 실패했습니다.', 'error');
      }
    }

    // 위치 공유 해제 — 라이딩이 끝나면 내 위치를 계속 뿌릴 이유가 없다
    setLocationShare(false);

    // 파티 라이딩이었고 내가 호스트면 파티도 종료한다.
    // 참가자는 본인 라이딩만 끝나고 파티 상태는 건드리지 않는다 (호스트 권한).
    if (party && user?.id === party.hostId) {
      try {
        const ended = await endParty(party.id, user.id);
        setParty(ended);
        showToast(text.rideEndedParty);
      } catch {
        showToast('파티 종료에 실패했습니다.', 'error');
      }
    } else if (party) {
      showToast(text.rideEndedSolo);
    }

    // 리셋
    rideStartPosRef.current = null;
    rideStartTimeRef.current = null;
    // party 는 라이딩 종료 시점의 값만 필요해 의존성에서 뺀다 (매번 콜백 재생성 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, rideTime, rideDistance, party]);

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
        const others = (await getOtherLocations(myId, partyId)) || [];
        // 네트워크 대기 중 지도가 제거됐으면 중단 — 옛 지도에 마커 추가 방지
        if (cancelled || !mapRef.current) return;

        const seen = new Set();
        for (const o of others) {
          seen.add(o.userId);

          let marker = markers.get(o.userId);
          if (!marker) {
            marker = L.marker([o.lat, o.lng], { icon: makeOtherUserIcon(), zIndexOffset: 900 })
              // B: 이름 대신 아바타+이름+거리 커스텀 말풍선. 거리는 아래에서 매 갱신마다 채운다.
              .bindTooltip('', { permanent: true, direction: 'top', offset: [0, -14], className: 'proxTooltip', opacity: 1 })
              .addTo(map);
            markers.set(o.userId, marker);
          } else {
            marker.setLatLng([o.lat, o.lng]);
          }

          const dist = map.distance([myPos.lat, myPos.lng], [o.lat, o.lng]);
          marker.setTooltipContent(proxBubbleHtml(o.name, dist));   // B: 말풍선 거리 갱신

          const wasInside = insideMap.get(o.userId) || false;
          const isInside = wasInside ? dist <= GEOFENCE_EXIT_M : dist <= GEOFENCE_RADIUS_M;
          // 왼쪽 패널 상태줄에는 더 이상 접근/이탈 문구를 쓰지 않는다.
          // 근접 알림은 도크(근처 탭)와 지도 토스트(A)가 담당한다.
          if (isInside && !wasInside) {
            showProxAlert({ name: o.name, dist, entering: true });
          } else if (!isInside && wasInside) {
            showProxAlert({ name: o.name, dist, entering: false });
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
  }, [user?.id, locationShareEnabled, partyId]);

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
      distanceKm: routeStats?.distanceKm ?? null,
      ascendM: routeStats?.ascendM ?? null,
      timeMin: routeStats?.timeMin ?? null,
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

  // 목록 불러오기 — 본인 경로만. 비로그인이면 호출하지 않는다.
  // (userId 없이 부르면 백엔드가 400 을 주고, 예전에는 남의 경로가 전부 나왔다)
  const loadRouteList = async () => {
    if (!user?.id) {
      showToast(text.routeListLoginNeeded, 'error');
      return;
    }
    try {
      const data = await getRoutes(user.id);
      setRouteList(data);
      setCheckedIds([]);
      setShowRouteList(true);
    } catch (e) {
      showToast('목록을 불러오지 못했습니다: ' + e.message, 'error');
    }
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
      drawRoutes(bikeRoute, shortestRoute, routeLayerRef.current, mapRef.current, bike.segments);
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

      <header className="mapTopbar">
        <nav className="navbar mapNav" aria-label={text.nav}>
          <a className="brand" href="/" onClick={onBackHome}><BrandLogo className="brandLogo" />PedalLink</a>
          <div className="navLinks">
            <a href="/browse" onClick={onMoveBrowse}>{text.browse}</a>
            <a href="/party" onClick={onMoveParty}>{text.party}</a>
            <a href="/">{text.nearby}</a>
            <a href="/map">{text.makeCourse}</a>
          </div>
          <a className="signupBackLink" href="/" onClick={onBackHome}>{text.partyBackHome}</a>
        </nav>
        {party && (
          <div className="mapPartyBanner">
            <strong>{party.title}</strong>
            <span>{text.partyRideBanner} · {party.participants.map(m => m.name).join(', ')}</span>
          </div>
        )}
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
              {/* 지도 설정 — 예전 상단 헤더에 있던 레이어/지역 선택을 패널로 옮김 */}
              <div className="plannerMapControls">
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
              </div>


              {/* 라이딩 섹션 */}
              <div className="plannerRideBox">
                {/* 시작/종료를 각각 두고, 지금 할 수 없는 쪽은 비활성으로 둔다 */}
                <div className="plannerRideAction">
                  <button
                    type="button"
                    onClick={handleRideStart}
                    disabled={isRiding}
                    className="plannerRideBtn"
                  >
                    {text.rideStart}
                  </button>
                  <button
                    type="button"
                    onClick={handleRideStop}
                    disabled={!isRiding}
                    className="plannerRideBtn isRiding"
                  >
                    {text.rideStop}
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
                  {routeStats.roadMix?.length > 0 && (
                    <div className="analysisGroup">
                      <h4 className="analysisTitle">길 구성</h4>
                      <div className="analysisTrack">
                        {routeStats.roadMix.map((r) => (
                          <span key={r.key} className="analysisSeg" style={{ width: `${r.pct}%`, background: r.color }} title={`${r.label} ${r.pct}%`} />
                        ))}
                      </div>
                      <ul className="analysisLegend">
                        {routeStats.roadMix.map((r) => (
                          <li key={r.key}>
                            <span className="legendDot" style={{ background: r.color }} />
                            <span className="legendName">{r.label}</span>
                            <span className="legendPct">{r.pct}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 저장/마커지우기는 한 줄, 목록은 아래 전체 폭 — 10px 간격 */}
              <div className="plannerActions">
                <div className="plannerActionsRow">
                  <button className="resetButton btn btn--solid" type="button" onClick={saveRoute}>
                    경로 저장
                  </button>
                  <button className="resetButton btn btn--solid" type="button" onClick={resetPlanner}>{text.reset}</button>
                </div>

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
                <button className="resetButton btn btn--solid plannerActionsWide" type="button" onClick={loadRouteList}>
                  저장된 경로 목록
                </button>
              </div>

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

        {/* A: 근접/이탈 순간 상단에 뜨는 알림 토스트 */}
        {proxAlert && (
          <div className={`mapProxToast${proxAlert.entering ? '' : ' isLeaving'}`} role="status">
            <span className="proxAvatar">{(proxAlert.name || '?').trim().charAt(0)}</span>
            <div className="mapProxText">
              <strong>{proxAlert.name}님이 {proxAlert.entering ? '근처에 왔어요' : '범위를 벗어났어요'}</strong>
              <span>{fmtProxDist(proxAlert.dist)} · {proxAlert.entering ? '다가오는 중' : '멀어지는 중'}</span>
            </div>
          </div>
        )}

        {/* 오른쪽 아래 플로팅 컨트롤 스택 (아래부터: 파티 도크(전역) · 내 위치로) — 위치 공유는 도크로 이동 */}
        <div className="mapFabStack">
          <button
            type="button"
            className={`mapFab${following ? ' isOn' : ''}`}
            onClick={recenter}
            title={following ? '내 위치 따라가는 중' : '내 위치로'}
            aria-label="내 위치로"
            aria-pressed={following}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
              <path d="M12 1v3M12 20v3M1 12h3M20 12h3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
