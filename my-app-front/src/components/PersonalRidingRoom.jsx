import '../styles/ridingroom.css';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { makeTileLayer, makeCurrentLocationIcon, makeHeadingIcon, bearingBetween, drawRoutes } from '../utils/leaflet';
import { reportLocation, getOtherLocations } from '../api/locations';
import { getRouteById } from '../api/routes';
import { sendMatchRequest, getOutgoingMatches } from '../api/matches';
import { api } from '../api/client';

// MapPage의 지오펜스와 같은 값 — 50m 안에 들어오면 알림, 250m 밖으로 나가야 이탈로 친다(끊김 방지용 여유)
const GEOFENCE_RADIUS_M = 50;
const GEOFENCE_EXIT_M = 250;

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtProxDist(d) {
  if (d == null) return '';
  return d < 1000 ? `${Math.round(d)}m 근처` : `${(d / 1000).toFixed(1)}km`;
}

const letterOf = (name) => (name || '?').trim().charAt(0);

// 파티 없이 혼자 타는 라이딩 화면. RidingRoom과 같은 오버레이 골격을 쓰지만
// 참가자·방장·파티 종료 흐름이 없다 — 시작한 사람이 곧 끝내는 사람이다.
// route가 있으면 그 코스를 지도에 그려서 "코스 따라가기", 없으면 자유주행.
export default function PersonalRidingRoom({ user, route, onClose }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const myMarkerRef = useRef(null);
  const lastPosRef = useRef(null);
  const headingRef = useRef(0);
  const watchIdRef = useRef(null);
  const followingRef = useRef(true);
  const rideStartMsRef = useRef(Date.now());
  const othersInsideRef = useRef(new Map()); // userId -> 지오펜스 안에 있는지
  const proxTimerRef = useRef(null);
  const routeAscendMRef = useRef(null); // 코스 따라가기 모드일 때 그 코스의 상승고도 — 라이딩 기록에 스냅샷으로 남긴다

  const [rideTime, setRideTime] = useState(0);
  const [rideDistance, setRideDistance] = useState(0);
  const [mySpeedKmh, setMySpeedKmh] = useState(0);
  const [ending, setEnding] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [summary, setSummary] = useState(null);
  const [proxAlert, setProxAlert] = useState(null); // { userId, name, dist, entering }
  const [sentMatches, setSentMatches] = useState(new Set()); // 이미 매칭 신청을 보낸 userId
  const [matchSending, setMatchSending] = useState(false);

  const showProxAlert = (info) => {
    clearTimeout(proxTimerRef.current);
    setProxAlert(info);
    proxTimerRef.current = setTimeout(() => setProxAlert(null), 4500);
  };
  useEffect(() => () => clearTimeout(proxTimerRef.current), []);

  useEffect(() => {
    const map = L.map(mapNodeRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([37.5665, 126.9780], 15);
    makeTileLayer('mapnik').addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 코스 따라가기 모드면 처음 한 번 경로를 그려둔다 (GPS 위치가 없어도 뜬다)
  useEffect(() => {
    if (!route?.id) return;
    let alive = true;
    getRouteById(route.id).then((data) => {
      if (!alive) return;
      routeAscendMRef.current = data.ascendM ?? null;
      if (!mapRef.current || !routeLayerRef.current) return;
      if (!data.bikeRoute?.length || !data.shortestRoute?.length) return;
      const bike = data.bikeRoute.map((p) => [p.lat, p.lng]);
      const shortest = data.shortestRoute.map((p) => [p.lat, p.lng]);
      drawRoutes(bike, shortest, routeLayerRef.current, mapRef.current);
    }).catch(() => {});
    return () => { alive = false; };
  }, [route?.id]);

  // 내 위치 추적 — 마커/방향/거리/속도
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('이 브라우저에서 위치를 사용할 수 없어요.');
      return;
    }
    let cancelled = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled || !mapRef.current) return;
        const map = mapRef.current;
        const { latitude, longitude } = pos.coords;
        const prev = lastPosRef.current;

        if (typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)) {
          headingRef.current = pos.coords.heading;
        } else if (prev) {
          const moved = map.distance([prev.lat, prev.lng], [latitude, longitude]);
          if (moved > 3) headingRef.current = (bearingBetween(prev, { lat: latitude, lng: longitude }) + 360) % 360;
        }

        if (prev?.time) {
          const dt = (pos.timestamp - prev.time) / 1000;
          if (dt >= 1) {
            const moved = map.distance([prev.lat, prev.lng], [latitude, longitude]);
            setMySpeedKmh((moved / dt) * 3.6);
            if (moved > 5) setRideDistance((d) => d + moved);
          }
        }
        lastPosRef.current = { lat: latitude, lng: longitude, time: pos.timestamp };

        if (!myMarkerRef.current) {
          myMarkerRef.current = L.marker([latitude, longitude], { icon: makeCurrentLocationIcon(), zIndexOffset: 1000 }).addTo(map);
          map.setView([latitude, longitude], 16);
        } else {
          myMarkerRef.current.setLatLng([latitude, longitude]);
          myMarkerRef.current.setIcon(makeHeadingIcon(headingRef.current));
        }
        if (followingRef.current) map.panTo([latitude, longitude], { animate: true });
      },
      () => setGeoError('위치 권한을 허용해주세요.'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => {
      cancelled = true;
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // 라이딩 시간 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setRideTime(Math.floor((Date.now() - rideStartMsRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 내 위치를 서버에 계속 보고 + 위치공유 중인 다른 사람과의 거리로 지오펜스 감지
  useEffect(() => {
    let cancelled = false;
    const insideMap = othersInsideRef.current;

    const timer = setInterval(async () => {
      const pos = lastPosRef.current;
      const map = mapRef.current;
      if (!pos || !map) return;

      try {
        await reportLocation({ userId: user.id, name: user.name, lat: pos.lat, lng: pos.lng });
        const others = (await getOtherLocations(user.id)) || [];
        if (cancelled || !mapRef.current) return;

        const seen = new Set();
        for (const o of others) {
          if (o.userId === user.id) continue;
          seen.add(o.userId);
          const dist = map.distance([pos.lat, pos.lng], [o.lat, o.lng]);
          const wasInside = insideMap.get(o.userId) || false;
          const isInside = wasInside ? dist <= GEOFENCE_EXIT_M : dist <= GEOFENCE_RADIUS_M;
          if (isInside && !wasInside) {
            showProxAlert({ userId: o.userId, name: o.name, dist, entering: true });
          } else if (!isInside && wasInside) {
            showProxAlert({ userId: o.userId, name: o.name, dist, entering: false });
          }
          insideMap.set(o.userId, isInside);
        }
        for (const id of insideMap.keys()) {
          if (!seen.has(id)) insideMap.delete(id);
        }
      } catch {
        // 다음 폴링에서 재시도
      }
    }, 3000);

    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.name]);

  // 내가 이미 신청 보낸 사람 목록 — 알림에서 버튼을 "신청함"으로 바꾸는 데 쓴다
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const list = await getOutgoingMatches(user.id);
        if (alive) setSentMatches(new Set((list || []).map((m) => m.toUserId)));
      } catch { /* 무시 */ }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [user.id]);

  const handleSendMatch = async (toUserId) => {
    if (matchSending || sentMatches.has(toUserId)) return;
    setMatchSending(true);
    try {
      await sendMatchRequest(user.id, toUserId);
      setSentMatches((prev) => new Set(prev).add(toUserId));
    } catch {
      // 이미 신청했거나 상대가 파티에 속해 있는 경우 — 조용히 무시
    } finally {
      setMatchSending(false);
    }
  };

  const recenter = () => {
    followingRef.current = true;
    const pos = lastPosRef.current;
    if (pos) mapRef.current?.panTo([pos.lat, pos.lng], { animate: true });
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    try {
      const distanceKm = rideDistance / 1000;
      const durationMin = Math.floor(rideTime / 60);
      if (rideDistance > 0) {
        await api.post('/api/ride-records', {
          userId: user.id,
          distance: distanceKm,
          duration: durationMin,
          partyId: null,
          routeId: route?.id ?? null,
          routeName: route?.routeName ?? null,
          ascendM: routeAscendMRef.current,
        }).catch(() => {});
      }
      setSummary({ distanceKm, durationMin, avgSpeedKmh: durationMin > 0 ? distanceKm / (durationMin / 60) : 0 });
    } finally {
      setEnding(false);
    }
  };

  const closeSummary = () => {
    setSummary(null);
    onClose?.();
  };

  const title = route?.routeName || '자유주행';

  return (
    <div className="rrBackdrop">
      <div className="rrRoom" role="dialog" aria-label={`${title} 라이딩`}>
        <div className="rrMap" ref={mapNodeRef} />

        <header className="rrTopBar">
          <div className="rrStats">
            <div className="rrStat"><strong>{mySpeedKmh.toFixed(1)}</strong><span>km/h</span></div>
            <div className="rrStat"><strong>{(rideDistance / 1000).toFixed(2)}</strong><span>km</span></div>
            <div className="rrStat"><strong>{fmtTime(rideTime)}</strong><span>경과</span></div>
          </div>
          <button type="button" className="rrClose" onClick={onClose} aria-label="닫기" title="닫기">
            ‹
          </button>
        </header>

        <p className="rrModeTag">{route ? `코스: ${title}` : '자유주행'}</p>

        {geoError && <p className="rrGeoError">{geoError}</p>}

        {proxAlert && (
          <div className={`rrProxToast${proxAlert.entering ? '' : ' isLeaving'}`} role="status">
            <span className="rrAvatar" aria-hidden="true">{letterOf(proxAlert.name)}</span>
            <div className="rrProxText">
              <strong>{proxAlert.name}님이 {proxAlert.entering ? '근처에 왔어요' : '범위를 벗어났어요'}</strong>
              <span>{fmtProxDist(proxAlert.dist)}</span>
            </div>
            {proxAlert.entering && (
              <button
                type="button"
                className="rrProxMatchBtn"
                disabled={matchSending || sentMatches.has(proxAlert.userId)}
                onClick={() => handleSendMatch(proxAlert.userId)}
              >
                {sentMatches.has(proxAlert.userId) ? '신청함' : '매칭 신청'}
              </button>
            )}
          </div>
        )}

        <button type="button" className="rrRecenterBtn" onClick={recenter} aria-label="내 위치로">⌖</button>

        <div className="rrEndBar">
          <button type="button" className="rrEndBtn" onClick={handleEnd} disabled={ending}>
            {ending ? '종료 중…' : '라이딩 종료'}
          </button>
        </div>

        {summary && (
          <div className="rrSummaryBackdrop">
            <div className="rrSummaryCard">
              <h3>라이딩 기록</h3>
              <div className="rrSummaryStats">
                <div className="rrSummaryStat"><strong>{summary.distanceKm.toFixed(2)}</strong><span>km</span></div>
                <div className="rrSummaryStat"><strong>{summary.durationMin}</strong><span>분</span></div>
                <div className="rrSummaryStat"><strong>{summary.avgSpeedKmh.toFixed(1)}</strong><span>평균 km/h</span></div>
              </div>
              <button type="button" className="rrSummaryCloseBtn" onClick={closeSummary}>확인</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
