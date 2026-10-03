import '../styles/ridingroom.css';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { makeTileLayer, makeCurrentLocationIcon, makeHeadingIcon, makeOtherUserIcon, bearingBetween, drawRoutes } from '../utils/leaflet';
import { reportLocation, getOtherLocations } from '../api/locations';
import { getRouteById } from '../api/routes';
import { sendMatchRequest, getOutgoingMatches } from '../api/matches';
import { getProfile } from '../api/users';
import { useLocationShare } from '../hooks/useLocationShare';
import { submitRideRecord } from '../utils/rideRecords';
import { text } from '../constants';

// MapPage의 지오펜스와 같은 값 — 50m 안에 들어오면 알림, 250m 밖으로 나가야 이탈로 친다(끊김 방지용 여유)
const GEOFENCE_RADIUS_M = 50;
const GEOFENCE_EXIT_M = 250;
// 이 거리 안이면 지도에 핀을 그려서 "근처에 누가 있는지" 보이게 한다 (매칭 가능 여부와는 별개)
const VISIBLE_M = 500;

const GENDER_LABEL = { male: '남성', female: '여성' };

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

// 기록 저장 결과 → 요약 팝업 안내 문구
const SAVE_NOTE = {
  queued: text.rideSaveQueued,
  rejected: text.rideSaveFailed,
  lost: text.rideSaveFailed,
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 핀에 마우스를 올리거나(PC) 탭하면(모바일) 뜨는 프로필 미리보기 카드.
// profile이 'loading'이면 아직 안 불러온 것, null이면 실패한 것 — 둘 다 이름/거리만 보여준다.
function profileTooltipHtml(name, dist, profile) {
  const head = `<div class="rrProfileHead">`
    + `<span class="rrProfileAvatar">${escapeHtml(letterOf(name))}</span>`
    + `<div class="rrProfileHeadText"><strong>${escapeHtml(name)}</strong><span class="rrProfileDist">${fmtProxDist(dist)}</span></div>`
    + `</div>`;

  if (!profile || profile === 'loading') {
    return `<div class="rrProfileCard">${head}<p class="rrProfileLoading">${profile === 'loading' ? '불러오는 중…' : '정보를 불러오지 못했어요'}</p></div>`;
  }

  const metaParts = [];
  if (GENDER_LABEL[profile.gender]) metaParts.push(GENDER_LABEL[profile.gender]);
  if (profile.age) metaParts.push(`${profile.age}세`);
  if (profile.region) metaParts.push(profile.region);
  const meta = metaParts.length ? `<div class="rrProfileMeta">${escapeHtml(metaParts.join(' · '))}</div>` : '';
  const bike = profile.bikeInfo ? `<div class="rrProfileMeta">🚲 ${escapeHtml(profile.bikeInfo)}</div>` : '';
  const bio = profile.bio ? `<p class="rrProfileBio">${escapeHtml(profile.bio)}</p>` : '';

  return `<div class="rrProfileCard">${head}${meta}${bike}${bio}</div>`;
}

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
  const otherMarkersRef = useRef(new Map()); // userId -> Leaflet 마커 (VISIBLE_M 안에 있는 사람만)
  const profileCacheRef = useRef(new Map()); // userId -> 프로필 | 'loading' | null(실패)
  const proxTimerRef = useRef(null);
  const rideDistanceRef = useRef(0); // 언마운트 시 저장용 최신 거리 미러
  const finalizedRef = useRef(false); // 기록 확정은 종료 버튼·언마운트 중 한 번만
  const stoppedRef = useRef(false);

  const [shareOn, setShare] = useLocationShare(user.id);
  const shareOnRef = useRef(shareOn);
  useEffect(() => { shareOnRef.current = shareOn; }, [shareOn]);

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
        if (cancelled || stoppedRef.current || !mapRef.current) return;
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
            if (moved > 5) {
              rideDistanceRef.current += moved;
              setRideDistance(rideDistanceRef.current);
            }
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
      if (stoppedRef.current) return;
      setRideTime(Math.floor((Date.now() - rideStartMsRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 내 위치를 서버에 계속 보고 + 위치공유 중인 다른 사람과의 거리로 지오펜스 감지 + 근처 핀 표시
  useEffect(() => {
    let cancelled = false;
    const insideMap = othersInsideRef.current;
    const markers = otherMarkersRef.current;
    const profiles = profileCacheRef.current;

    const timer = setInterval(async () => {
      const pos = lastPosRef.current;
      const map = mapRef.current;
      if (!pos || !map || stoppedRef.current) return;

      try {
        // 위치 공유가 꺼져 있으면 내 위치는 보내지 않는다(남의 위치 조회는 유지)
        if (shareOnRef.current) {
          await reportLocation({ userId: user.id, name: user.name, lat: pos.lat, lng: pos.lng });
        }
        const others = (await getOtherLocations(user.id)) || [];
        if (cancelled || !mapRef.current) return;

        const seen = new Set();
        for (const o of others) {
          if (o.userId === user.id) continue;
          seen.add(o.userId);
          const dist = map.distance([pos.lat, pos.lng], [o.lat, o.lng]);

          // 지오펜스 진입/이탈 알림 (매칭 신청은 여기서 뜬다)
          const wasInside = insideMap.get(o.userId) || false;
          const isInside = wasInside ? dist <= GEOFENCE_EXIT_M : dist <= GEOFENCE_RADIUS_M;
          if (isInside && !wasInside) {
            showProxAlert({ userId: o.userId, name: o.name, dist, entering: true });
          } else if (!isInside && wasInside) {
            showProxAlert({ userId: o.userId, name: o.name, dist, entering: false });
          }
          insideMap.set(o.userId, isInside);

          // 근처(VISIBLE_M 이내)면 핀을 그리고, 마우스오버/탭하면 프로필 미리보기
          if (dist <= VISIBLE_M) {
            let marker = markers.get(o.userId);
            if (!marker) {
              marker = L.marker([o.lat, o.lng], { icon: makeOtherUserIcon(), zIndexOffset: 900 })
                .bindTooltip(profileTooltipHtml(o.name, dist, profiles.get(o.userId)), {
                  direction: 'top', offset: [0, -14], className: 'rrProfileTooltip', opacity: 1,
                })
                .addTo(map);
              marker.on('click', () => marker.openTooltip()); // 모바일은 호버가 없으니 탭으로도 열리게
              markers.set(o.userId, marker);

              profiles.set(o.userId, 'loading');
              getProfile(o.userId).then((p) => {
                profiles.set(o.userId, p);
                const m = markers.get(o.userId);
                const myPos = lastPosRef.current;
                if (m && myPos) {
                  const freshDist = map.distance([myPos.lat, myPos.lng], m.getLatLng());
                  m.setTooltipContent(profileTooltipHtml(o.name, freshDist, p));
                }
              }).catch(() => { profiles.set(o.userId, null); });
            } else {
              marker.setLatLng([o.lat, o.lng]);
              marker.setTooltipContent(profileTooltipHtml(o.name, dist, profiles.get(o.userId)));
            }
          } else {
            const marker = markers.get(o.userId);
            if (marker) { marker.remove(); markers.delete(o.userId); profiles.delete(o.userId); }
          }
        }

        for (const id of insideMap.keys()) {
          if (!seen.has(id)) insideMap.delete(id);
        }
        for (const [id, marker] of markers) {
          if (!seen.has(id)) { marker.remove(); markers.delete(id); profiles.delete(id); }
        }
      } catch {
        // 다음 폴링에서 재시도
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      markers.forEach((m) => m.remove());
      markers.clear();
      profiles.clear();
    };
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

  // 기록 확정 — 종료 버튼과 언마운트(닫기·파티 전환) 공통. 한 번만 실행된다.
  const buildRecord = () => {
    const distanceM = rideDistanceRef.current;
    if (distanceM <= 0) return null;
    return {
      userId: user.id,
      distance: distanceM / 1000,
      duration: Math.floor((Date.now() - rideStartMsRef.current) / 60000),
      partyId: null,
      routeId: route?.id ?? null,
      routeName: route?.routeName ?? null,
    };
  };

  // 종료 없이 화면이 닫히면(닫기·파티로 전환) 쌓인 기록을 버리지 않고 저장한다.
  // 저장할 기록이 있을 때만 확정 표시를 한다 — 개발 모드(StrictMode)의 가짜 정리(거리 0)가
  // 확정으로 굳어 이후 종료 버튼·실제 언마운트 저장을 막지 않게 하기 위해서다.
  useEffect(() => () => {
    if (finalizedRef.current) return;
    const record = buildRecord();
    if (!record) return;
    finalizedRef.current = true;
    submitRideRecord(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = async () => {
    if (ending || finalizedRef.current) return;
    finalizedRef.current = true;
    stoppedRef.current = true;
    if (watchIdRef.current) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setEnding(true);
    try {
      const record = buildRecord();
      const distanceKm = rideDistanceRef.current / 1000;
      const durationMin = Math.floor((Date.now() - rideStartMsRef.current) / 60000);
      const result = record ? await submitRideRecord(record) : null;
      setSummary({
        distanceKm,
        durationMin,
        avgSpeedKmh: durationMin > 0 ? distanceKm / (durationMin / 60) : 0,
        saveNote: (result && SAVE_NOTE[result.kind]) || '',
      });
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
        {!shareOn && (
          <div className="rrShareOff" role="status">
            <span>{text.rideLocShareOff}</span>
            <button type="button" onClick={() => setShare(true)}>{text.rideLocShareTurnOn}</button>
          </div>
        )}

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
              {summary.saveNote && <p className="rrSummaryNote" role="alert">{summary.saveNote}</p>}
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
