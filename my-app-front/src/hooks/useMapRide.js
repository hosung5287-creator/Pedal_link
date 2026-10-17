import { useCallback, useEffect, useRef, useState } from 'react';
import { submitRideRecord } from '../utils/rideRecords';

// 두 좌표 사이 거리(m) — Haversine
function distanceBetween(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

// 지도 페이지의 라이딩(시간·거리 측정 + 기록 저장).
// - stop() 하면 GPS·타이머를 멈추고 기록을 저장한다.
// - 라이딩 중에 페이지를 떠나면(언마운트) GPS·타이머를 해제하고 쌓인 기록을 저장한다.
// - 기록 확정은 stop·언마운트 중 한 번만.
// meta: { userId, partyId, getCourse } — 매 렌더 최신값을 쓴다.
//   getCourse() → { id, routeName } | null : 기록을 확정하는 순간 탄 코스(상승고도 계산용). 없으면 자유주행.
export function useMapRide({ userId, partyId = null, getCourse = null }, { submit = submitRideRecord } = {}) {
  const [isRiding, setIsRiding] = useState(false);
  const [rideTime, setRideTime] = useState(0);
  const [rideDistance, setRideDistance] = useState(0);

  const metaRef = useRef({ userId, partyId, getCourse });
  metaRef.current = { userId, partyId, getCourse };

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const anchorRef = useRef(null);     // 거리 누적 기준점 (5m 이상 움직여야 갱신)
  const distanceRef = useRef(0);
  const startMsRef = useRef(null);
  const ridingRef = useRef(false);
  const finalizedRef = useRef(true);  // 라이딩 중이 아닐 때는 확정할 기록이 없다

  const release = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const buildRecord = () => {
    const { userId: uid, partyId: pid, getCourse: course } = metaRef.current;
    if (!uid || distanceRef.current <= 0) return null;
    const c = course?.() || null;
    return {
      userId: uid,
      distance: distanceRef.current / 1000,
      duration: Math.floor((Date.now() - (startMsRef.current ?? Date.now())) / 60000),
      partyId: pid ?? null,
      // 코스를 탔을 때만 붙인다 — 백엔드가 이 코스로 상승고도를 계산한다
      ...(c?.id ? { routeId: c.id, routeName: c.routeName ?? null } : {}),
    };
  };

  const start = useCallback(() => {
    if (ridingRef.current) return;
    ridingRef.current = true;
    finalizedRef.current = false;
    anchorRef.current = null;          // 이전 라이딩의 기준 좌표가 남지 않게
    distanceRef.current = 0;
    startMsRef.current = Date.now();
    setIsRiding(true);
    setRideTime(0);
    setRideDistance(0);

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
        if (!ridingRef.current) return;
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!anchorRef.current) {
          anchorRef.current = here;
          return;
        }
        const d = distanceBetween(anchorRef.current, here);
        if (d > 5) { // 5m 이상만 거리 계산
          distanceRef.current += d;
          setRideDistance(distanceRef.current);
          anchorRef.current = here;
        }
      });
    }
    timerRef.current = setInterval(() => setRideTime((t) => t + 1), 1000);
  }, []);

  // 반환: { distanceM, durationMin, result } — result 는 저장 결과(기록이 없으면 null)
  const stop = useCallback(async () => {
    if (!ridingRef.current) return null;
    ridingRef.current = false;
    release();
    setIsRiding(false);
    const distanceM = distanceRef.current;
    const durationMin = Math.floor((Date.now() - (startMsRef.current ?? Date.now())) / 60000);
    if (finalizedRef.current) return { distanceM, durationMin, result: null };
    finalizedRef.current = true;
    const record = buildRecord();
    const result = record ? await submit(record) : null;
    return { distanceM, durationMin, result };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  // 언마운트 — 라이딩 중이었다면 정리하고 쌓인 기록을 저장한다
  // (StrictMode 의 가짜 정리는 라이딩 시작 전이라 finalizedRef 가 true — 아무것도 하지 않는다)
  useEffect(() => () => {
    ridingRef.current = false;
    release();
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const record = buildRecord();
    if (record) submit(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isRiding, rideTime, rideDistance, start, stop };
}
