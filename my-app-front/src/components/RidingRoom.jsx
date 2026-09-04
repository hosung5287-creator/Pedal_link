import '../styles/ridingroom.css';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { makeTileLayer, makeCurrentLocationIcon, makeOtherUserIcon, makeHeadingIcon, bearingBetween, drawRoutes } from '../utils/leaflet';
import { reportLocation, getOtherLocations } from '../api/locations';
import { getRouteById } from '../api/routes';
import { stopPartyRide, getParty } from '../api/parties';
import { api } from '../api/client';

const letterOf = (name) => (name || '?').trim().charAt(0);

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 파티 도크/룸과 같은 "떠 있는 오버레이" 계열의 라이딩 전용 화면.
// 페이지 이동 없이, 지금 있던 화면 위에 지도+HUD만 있는 미니 라이딩 모드를 띄운다.
export default function RidingRoom({ party, user, onClose, onEnded, onPartyChange }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const myMarkerRef = useRef(null);
  const otherMarkersRef = useRef(new Map());
  const otherSpeedRef = useRef(new Map());
  const lastPosRef = useRef(null);
  const headingRef = useRef(0);
  const watchIdRef = useRef(null);
  const followingRef = useRef(true);
  const rideDistanceRef = useRef(0); // 폴링 콜백에서 최신 거리값을 읽기 위한 미러
  // 라이딩 시작 시각은 파티 공유값(rideStartedAt) 기준 — 각자 방을 연 시점이 아니라
  // 다 같은 시점부터 세야 경과 시간이 사람마다 다르게 보이지 않는다.
  const rideStartMsRef = useRef(party.rideStartedAt ? new Date(party.rideStartedAt).getTime() : Date.now());

  const isHost = party.hostId === user.id;

  const [rideTime, setRideTime] = useState(() => Math.max(0, Math.floor((Date.now() - rideStartMsRef.current) / 1000)));
  const [rideDistance, setRideDistance] = useState(0);
  const [mySpeedKmh, setMySpeedKmh] = useState(0);
  const [otherRiders, setOtherRiders] = useState([]);
  const [ending, setEnding] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [summary, setSummary] = useState(null); // 종료 후 기록 팝업

  // 지도 초기화
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

  // 파티에 연결된 코스(경로) 그리기 — 처음 한 번, GPS 위치가 아직 없어도 뜬다
  useEffect(() => {
    if (!party.routeId) return;
    let alive = true;
    getRouteById(party.routeId).then((data) => {
      if (!alive || !mapRef.current || !routeLayerRef.current) return;
      if (!data.bikeRoute?.length || !data.shortestRoute?.length) return;
      const bike = data.bikeRoute.map((p) => [p.lat, p.lng]);
      const shortest = data.shortestRoute.map((p) => [p.lat, p.lng]);
      drawRoutes(bike, shortest, routeLayerRef.current, mapRef.current);
    }).catch(() => {});
    return () => { alive = false; };
  }, [party.routeId]);

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
            if (moved > 5) setRideDistance((d) => { const next = d + moved; rideDistanceRef.current = next; return next; });
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

  // 라이딩 시간 타이머 — party.rideStartedAt 기준으로 계산해서 모두 같은 값을 본다
  useEffect(() => {
    const timer = setInterval(() => {
      setRideTime(Math.max(0, Math.floor((Date.now() - rideStartMsRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 내 위치 보고 + 다른 파티원 위치/속도 폴링
  useEffect(() => {
    let cancelled = false;
    const markers = otherMarkersRef.current;

    const timer = setInterval(async () => {
      const pos = lastPosRef.current;
      const map = mapRef.current;
      if (!pos || !map) return;

      try {
        await reportLocation({ userId: user.id, name: user.name, lat: pos.lat, lng: pos.lng });
        const others = (await getOtherLocations(user.id, party.id)) || [];
        if (cancelled || !mapRef.current) return;

        const seen = new Set();
        const list = [];
        for (const o of others) {
          seen.add(o.userId);

          let marker = markers.get(o.userId);
          if (!marker) {
            marker = L.marker([o.lat, o.lng], { icon: makeOtherUserIcon(), zIndexOffset: 900 }).addTo(map);
            markers.set(o.userId, marker);
          } else {
            marker.setLatLng([o.lat, o.lng]);
          }

          const now = Date.now();
          const prevSpeed = otherSpeedRef.current.get(o.userId);
          let speedKmh = prevSpeed?.speedKmh ?? 0;
          if (prevSpeed) {
            const dt = (now - prevSpeed.time) / 1000;
            if (dt >= 1) {
              const moved = map.distance([prevSpeed.lat, prevSpeed.lng], [o.lat, o.lng]);
              speedKmh = (moved / dt) * 3.6;
            }
          }
          otherSpeedRef.current.set(o.userId, { lat: o.lat, lng: o.lng, time: now, speedKmh });
          list.push({ userId: o.userId, name: o.name, speedKmh });
        }

        for (const [id, marker] of markers) {
          if (!seen.has(id)) {
            marker.remove();
            markers.delete(id);
            otherSpeedRef.current.delete(id);
          }
        }

        setOtherRiders(list);
      } catch {
        // 다음 폴링에서 재시도
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      markers.forEach((m) => m.remove());
      markers.clear();
      otherSpeedRef.current.clear();
    };
  }, [party.id, user.id, user.name]);

  // 참가자(비호스트) 전용 — 방장이 라이딩을 끝내면(rideStartedAt이 null이 됨) 감지해서
  // 내 기록을 저장하고 "라이딩이 종료되었습니다" 팝업을 띄운다.
  useEffect(() => {
    if (isHost) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const fresh = await getParty(party.id);
        if (cancelled || !fresh) return;
        if (!fresh.rideStartedAt) {
          clearInterval(timer);
          onPartyChange?.(fresh);

          const distanceKm = rideDistanceRef.current / 1000;
          const durationMin = Math.floor((Date.now() - rideStartMsRef.current) / 60000);
          if (rideDistanceRef.current > 0) {
            await api.post('/api/ride-records', {
              userId: user.id,
              distance: distanceKm,
              duration: durationMin,
              partyId: party.id,
            }).catch(() => {});
          }
          setSummary({
            distanceKm,
            durationMin,
            avgSpeedKmh: durationMin > 0 ? distanceKm / (durationMin / 60) : 0,
            endedByHost: true,
          });
        }
      } catch {
        // 다음 폴링에서 재시도
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [party.id, isHost, user.id]);

  const recenter = () => {
    followingRef.current = true;
    const pos = lastPosRef.current;
    if (pos) mapRef.current?.panTo([pos.lat, pos.lng], { animate: true });
  };

  // 라이딩 종료는 호스트만 — 그룹 라이딩이 언제 끝나는지는 방장이 정한다
  const handleEnd = async () => {
    if (!isHost || ending) return;
    setEnding(true);
    try {
      const distanceKm = rideDistance / 1000;
      const durationMin = Math.floor(rideTime / 60);
      if (rideDistance > 0) {
        await api.post('/api/ride-records', {
          userId: user.id,
          distance: distanceKm,
          duration: durationMin,
          partyId: party.id,
        }).catch(() => {});
      }
      // 파티(대기방)는 그대로 열어두고, rideStartedAt 만 지운다.
      // 파티 자체를 끝내려면 방장 제어판의 "파티 삭제"를 쓴다.
      const updated = await stopPartyRide(party.id, user.id).catch(() => null);
      // 도크의 로컬 상태를 바로 갱신 — 15초 폴링을 기다리지 않아도
      // 파티 룸에서 "라이딩 화면으로 이동" 버튼이 즉시 사라진다.
      if (updated) onPartyChange?.(updated);
      setSummary({ distanceKm, durationMin, avgSpeedKmh: durationMin > 0 ? distanceKm / (durationMin / 60) : 0 });
    } finally {
      setEnding(false);
    }
  };

  const closeSummary = () => {
    setSummary(null);
    onEnded?.();
  };

  return (
    <div className="rrBackdrop">
      <div className="rrRoom" role="dialog" aria-label={`${party.title} 라이딩`}>
        <div className="rrMap" ref={mapNodeRef} />

        <header className="rrTopBar">
          <div className="rrStats">
            <div className="rrStat"><strong>{mySpeedKmh.toFixed(1)}</strong><span>km/h</span></div>
            <div className="rrStat"><strong>{(rideDistance / 1000).toFixed(2)}</strong><span>km</span></div>
            <div className="rrStat"><strong>{fmtTime(rideTime)}</strong><span>경과</span></div>
          </div>
          <button type="button" className="rrClose" onClick={onClose} aria-label="파티창으로" title="파티창으로 돌아가기">
            ‹
          </button>
        </header>

        {geoError && <p className="rrGeoError">{geoError}</p>}

        <div className="rrRiders">
          <div className="rrRiderRow isMe">
            <span className="rrAvatar" aria-hidden="true">{letterOf(user?.name)}</span>
            <span className="rrRiderName">{user?.name} <em>나</em></span>
            <span className="rrRiderSpeed">{mySpeedKmh.toFixed(1)}</span>
          </div>
          {otherRiders.map((r) => (
            <div key={r.userId} className="rrRiderRow">
              <span className="rrAvatar" aria-hidden="true">{letterOf(r.name)}</span>
              <span className="rrRiderName">{r.name}</span>
              <span className="rrRiderSpeed">{r.speedKmh.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <button type="button" className="rrRecenterBtn" onClick={recenter} aria-label="내 위치로">⌖</button>

        {isHost && (
          <div className="rrEndBar">
            <button type="button" className="rrEndBtn" onClick={handleEnd} disabled={ending}>
              {ending ? '종료 중…' : '라이딩 종료'}
            </button>
          </div>
        )}

        {summary && (
          <div className="rrSummaryBackdrop">
            <div className="rrSummaryCard">
              <h3>{summary.endedByHost ? '라이딩이 종료되었습니다' : '라이딩 기록'}</h3>
              {summary.endedByHost && <p className="rrSummarySub">방장이 라이딩을 종료했어요</p>}
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
