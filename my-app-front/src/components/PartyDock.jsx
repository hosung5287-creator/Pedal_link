import '../styles/partydock.css';

import { useEffect, useRef, useState } from 'react';
import { partyDock as t, text } from '../constants';
import { getParties, getParty, applyToParty } from '../api/parties';
import { getOtherLocations, reportLocation } from '../api/locations';
import { errorMessage } from '../api/client';
import { useLocationShare } from '../hooks/useLocationShare';
import { useChat } from '../hooks/useChat';
import { displayTime } from '../utils/chat';
import { markRead } from '../utils/chatUnread';
import { OPEN_RIDING_EVENT } from '../utils/riding';
import {
  flushPendingRides, pruneRideSessions, findEndedSessions, unknownSessionPartyIds, finalizePartySession,
  retryPendingSessionWrites,
} from '../utils/rideRecords';
import { getMyRoutesForParty } from '../api/parties';
import { sendMatchRequest, acceptMatch, rejectMatch } from '../api/matches';
import BrandLogo from './BrandLogo';
import PartyRoom from './PartyRoom';
import RidingRoom from './RidingRoom';
import PersonalRidingRoom from './PersonalRidingRoom';
import UserProfileModal from './UserProfileModal';
import { getMyStatus } from '../api/me';

const NEAR_M = 220;   // 이 거리 안이면 "접근 중" — 근처 모집 중 파티 범위(백엔드 PartyService.PARTY_RANGE_M)와 같다
const MATCH_M = 50;   // 이 거리 안이어야 매칭 신청 버튼이 뜬다 (지오펜스와 같은 기준)

// 라이딩 방이 닫혀 있는 사이 끝난 파티 라이딩의 기록을 대신 확정한다.
// list 는 방금 성공한 파티 목록 조회 결과. 목록에 없는 파티는 단건 조회로 404 가 확인될 때만 종료로 본다.
async function reconcileRideSessions(userId, list, openRidingPartyId) {
  retryPendingSessionWrites(); // 저장소에 못 쓴 확정 결과부터 다시 쓴다
  const rooms = [...list];
  const goneIds = new Set();
  for (const id of unknownSessionPartyIds({ userId, rooms })) {
    try {
      const p = await getParty(id);
      if (p) rooms.push(p);
    } catch (e) {
      if (e?.status === 404) goneIds.add(id);
    }
  }
  const ended = findEndedSessions({ userId, rooms, openRidingPartyId, goneIds });
  for (const { key, partyId, rideStartedAt } of ended) {
    const room = rooms.find((r) => r.id === partyId);
    const startedMs = new Date(rideStartedAt).getTime();
    await finalizePartySession({
      key,
      buildRecord: (session) => {
        if (!session || !(session.distanceM > 0)) return null;
        return {
          userId,
          distance: session.distanceM / 1000,
          // 종료 시각을 모르니 감지한 지금까지로 친다
          duration: Number.isFinite(startedMs) ? Math.max(0, Math.floor((Date.now() - startedMs) / 60000)) : 0,
          partyId,
          routeId: room?.routeId ?? null,
          routeName: room?.routeName ?? null,
        };
      },
    });
  }
  await flushPendingRides();
}

function distanceM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

function fmtDist(d) {
  if (d == null) return null;
  return d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`;
}

const letterOf = (name) => (name || '?').trim().charAt(0);

function PeopleIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 20c0-2 .8-3.8 2-5" />
    </svg>
  );
}

// 우측 하단 플로팅 도크 — 로그인하면 항상 열림.
// 탭: 근처(주변 라이더 찾기 + 위치공유) / 파티(즉석 개설·멤버) / 채팅(보류).
export default function PartyDock({ user, onMoveParty }) {
  const [party, setParty] = useState(null);
  const [allParties, setAllParties] = useState([]);
  const [open, setOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomInitialId, setRoomInitialId] = useState(null); // 파티 룸을 열 때 바로 보여줄 방
  const [ridingId, setRidingId] = useState(null); // 라이딩 룸이 떠 있는 파티 id
  const [tab, setTab] = useState('near');
  const [applyingId, setApplyingId] = useState(null);
  const [applyError, setApplyError] = useState('');
  const [locs, setLocs] = useState({});
  const [selected, setSelected] = useState(null); // 프로필 창을 연 사람 { userId, name }
  const [nearNotice, setNearNotice] = useState(''); // 멀어서 프로필을 못 여는 등 짧은 안내
  const nearNoticeTimer = useRef(null);
  const myPos = useRef(null);
  const [locShare, setLocShare] = useLocationShare(user?.id);
  // 파티 목록을 바로 다시 받게 하는 신호 — 위치 공유를 켜고 첫 위치를 보낸 직후 등
  const [partiesReload, setPartiesReload] = useState(0);

  // 개인 라이딩(파티 없이 혼자) — 시작 전 고르는 팝업 + 실제 떠 있는 세션
  const [soloPicker, setSoloPicker] = useState(false);
  const [soloRoutes, setSoloRoutes] = useState([]);
  const [soloRoutesLoading, setSoloRoutesLoading] = useState(false);
  const [soloConfig, setSoloConfig] = useState(null); // { route } | null

  // 폴링 콜백에서 "지금 실제로 떠 있는 라이딩 방"을 알기 위한 미러 — 값은 아래 ridingRoomParty 를 따라간다
  const ridingIdRef = useRef(null);

  // 오래된 라이딩 세션 정리 + 못 보낸 기록 재전송 (로그인 사용자 기준, 도크가 뜰 때 한 번)
  useEffect(() => {
    if (!user?.id) return;
    pruneRideSessions(user.id);
    flushPendingRides();
  }, [user?.id]);

  useEffect(() => {
    if (!soloPicker || !user?.id) return;
    let alive = true;
    setSoloRoutesLoading(true);
    getMyRoutesForParty(user.id).then((list) => {
      if (alive) { setSoloRoutes(list); setSoloRoutesLoading(false); }
    }).catch(() => { if (alive) setSoloRoutesLoading(false); });
    return () => { alive = false; };
  }, [soloPicker, user?.id]);

  const startSolo = (route) => {
    setSoloPicker(false);
    setOpen(false);
    setSoloConfig({ route: route || null });
  };

  // 매칭 신청 — 내가 보낸/받은 대기중 신청
  const [incomingMatches, setIncomingMatches] = useState([]);
  const [outgoingUserIds, setOutgoingUserIds] = useState(new Set());
  const [matchSendingId, setMatchSendingId] = useState(null);
  const [matchActingId, setMatchActingId] = useState(null);
  // 폴링 콜백이 항상 최신 soloConfig 를 보게 하는 미러 (인터벌을 매번 새로 만들지 않기 위해)
  const soloConfigRef = useRef(null);
  useEffect(() => { soloConfigRef.current = soloConfig; }, [soloConfig]);
  const handledAcceptedIdsRef = useRef(new Set());
  // 크루 라이딩 자동 이동 — 한 번 연 라이딩은 다시 자동으로 열지 않는다(닫으면 초록 버튼으로 다시 들어간다)
  const autoOpenedRef = useRef(new Set());
  // 방장이 나를 내보낸 파티 안내 — 서버는 파티가 끝날 때까지 계속 알려 주므로, 한 번 띄운 파티 id 는 사용자별로 기억해 둔다
  const [kickedNotice, setKickedNotice] = useState(null); // { partyId, title } | null

  // 내 상태 확인 (5초) — 받은·보낸 매칭 신청 + 크루 라이딩 자동 이동을 요청 하나로 받는다.
  // 화면이 안 보일 때(다른 탭·최소화)는 건너뛰고, 다시 보이면 바로 한 번 확인한다.
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const status = await getMyStatus(user.id);
        if (!alive) return;
        const incoming = status?.incomingMatches;
        const outgoing = status?.outgoingMatches;

        // 팀장이 크루 라이딩을 시작했고 내가 체크된 인원이면, 어느 화면에 있든 라이딩 화면을 연다
        const crewRiding = status?.crewRiding;
        if (crewRiding?.partyId && !autoOpenedRef.current.has(crewRiding.partyId)) {
          autoOpenedRef.current.add(crewRiding.partyId);
          setPartiesReload((n) => n + 1);   // 새로 만들어진 파티를 받아 와야 라이딩 화면이 그려진다
          setOpen(false);
          setRoomOpen(false);
          setRidingId(crewRiding.partyId);
        }

        // 방장에게 강퇴당한 파티 — 처음 알게 된 것만 안내하고, 파티 목록을 다시 받아 그 방을 닫는다
        const kickKey = `pl:kickedSeen:${user.id}`;
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(kickKey) || '[]'); } catch { seen = []; }
        const freshKick = (status?.kickedParties || []).find((k) => !seen.includes(k.partyId));
        if (freshKick) {
          try { localStorage.setItem(kickKey, JSON.stringify([...seen, freshKick.partyId].slice(-50))); } catch { /* 저장 못 해도 안내는 띄운다 */ }
          setKickedNotice(freshKick);
          setPartiesReload((n) => n + 1);
        }

        setIncomingMatches(incoming || []);
        setOutgoingUserIds(new Set((outgoing || []).filter((m) => m.status === 'pending').map((m) => m.toUserId)));

        // 내가 개인 라이딩 중에 보낸 신청이 상대에게 수락됐으면, 나도 자동으로 파티 라이딩으로 전환한다.
        const newlyAccepted = (outgoing || []).find((m) =>
          m.status === 'accepted' && m.partyId != null && !handledAcceptedIdsRef.current.has(m.id));
        if (newlyAccepted) {
          handledAcceptedIdsRef.current.add(newlyAccepted.id);
          if (soloConfigRef.current) {
            const freshParties = await getParties(user.id);
            if (!alive) return;
            setAllParties(freshParties || []);
            setSoloConfig(null);
            setOpen(false);
            setRidingId(newlyAccepted.partyId);
          }
        }
      } catch { /* 다음 폴링에서 재시도 */ }
    };
    load();
    const timer = setInterval(load, 5000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [user?.id]);

  const handleSendMatch = async (toUserId) => {
    if (matchSendingId) return;
    setMatchSendingId(toUserId);
    try {
      await sendMatchRequest(user.id, toUserId);
      setOutgoingUserIds((prev) => new Set(prev).add(toUserId));
    } catch { /* 이미 신청했거나 상대가 파티에 속해 있는 경우 — 조용히 무시 */ } finally {
      setMatchSendingId(null);
    }
  };

  const handleAcceptMatch = async (req) => {
    if (matchActingId) return;
    setMatchActingId(req.id);
    try {
      const newParty = await acceptMatch(req.id, user.id);
      setIncomingMatches((prev) => prev.filter((r) => r.id !== req.id));
      setAllParties((prev) => (prev.some((p) => p.id === newParty.id)
        ? prev.map((p) => (p.id === newParty.id ? newParty : p))
        : [newParty, ...prev]));
      // 개인 라이딩 중이었으면 곧바로 파티 라이딩으로 전환, 아니면 도크에 파티만 만들어두고 끝낸다
      if (soloConfig) {
        setSoloConfig(null);
        setOpen(false);
        setRidingId(newParty.id);
      }
    } catch { /* 이미 만료/처리된 신청 — 다음 폴링에서 목록에서 사라짐 */ } finally {
      setMatchActingId(null);
    }
  };

  const handleRejectMatch = async (req) => {
    if (matchActingId) return;
    setMatchActingId(req.id);
    try {
      await rejectMatch(req.id, user.id);
      setIncomingMatches((prev) => prev.filter((r) => r.id !== req.id));
    } catch { /* 무시 */ } finally {
      setMatchActingId(null);
    }
  };

  const inParty = !!party;
  const curTab = tab;

  // 내가 속한(호스트 or 참여 확정) 파티 전부 — 채팅방 목록으로 씀
  const myRooms = allParties.filter((p) =>
    p.status !== 'ended'
    && (p.hostId === user?.id || (p.participants || []).some((m) => m.userId === user?.id)));
  const myRoomIds = myRooms.map((r) => r.id).join(',');

  // 라이딩이 시작된 내 파티 — 있으면 FAB 이 초록으로 바뀌고, 눌렀을 때 바로 라이딩 화면을 연다
  const ridingParty = myRooms.find((r) => r.rideStartedAt && r.status !== 'ended') || null;
  const isRiding = !!ridingParty;

  // 라이딩 화면에 넘길 파티. 크루 라이딩은 "라이딩 종료"와 함께 파티가 끝나(ended) 내 방 목록에서 빠지는데,
  // 그래도 기록 팝업을 닫을 때까지는 화면을 유지하도록 마지막으로 본 파티를 기억해 둔다.
  const liveRidingRoom = ridingId != null ? myRooms.find((r) => r.id === ridingId) || null : null;
  const [ridingSnap, setRidingSnap] = useState(null);
  useEffect(() => { if (liveRidingRoom) setRidingSnap(liveRidingRoom); }, [liveRidingRoom]);
  const ridingRoomParty = liveRidingRoom || (ridingSnap?.id === ridingId ? ridingSnap : null);
  useEffect(() => { ridingIdRef.current = ridingRoomParty?.id ?? null; }, [ridingRoomParty]);

  // 라이딩 화면을 닫을 때 — 파티가 남아 있으면 그 대기방으로 돌아가고, 끝났거나 내보내졌으면 그냥 닫는다.
  // 라이딩 화면의 폴링 타이머 안에서도 불리므로 내 방 목록은 ref 로 최신 값을 읽는다.
  const myRoomsRef = useRef(myRooms);
  useEffect(() => { myRoomsRef.current = myRooms; });
  const leaveRidingRoom = (partyId, gone = false) => {
    setRidingId(null);
    setRidingSnap(null);
    if (gone || !myRoomsRef.current.some((r) => r.id === partyId)) return;
    setRoomInitialId(partyId);
    setOpen(true);
    setRoomOpen(true);
  };

  const [chatRoomId, setChatRoomId] = useState(null);

  // 채팅방이 하나뿐이면 바로 열고, 여러 개면 고른 방이 없어질 때만 목록으로 돌린다
  useEffect(() => {
    if (myRooms.length === 1) {
      setChatRoomId(myRooms[0].id);
    } else if (chatRoomId != null && !myRoomIds.split(',').includes(String(chatRoomId))) {
      setChatRoomId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoomIds]);

  const currentRoom = myRooms.find((r) => r.id === chatRoomId) || null;

  const { messages: chatMessages, connected: chatConnected, sendMessage } = useChat(chatRoomId, user);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (curTab !== 'chat') return;
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    markRead(chatRoomId, chatMessages);
  }, [chatMessages, curTab, chatRoomId]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput('');
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  // 파티 페이지 등 도크 바깥에서 "라이딩 시작"을 눌렀을 때도 같은 화면을 띄운다
  useEffect(() => {
    const onOpen = (e) => {
      const id = e.detail?.partyId;
      if (id == null) return;
      setOpen(false);
      setRoomOpen(false);
      setRidingId(id);
    };
    window.addEventListener(OPEN_RIDING_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_RIDING_EVENT, onOpen);
  }, []);

  // 내 파티 찾기
  useEffect(() => {
    if (!user?.id) { setParty(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const list = await getParties(user.id);
        if (!alive) return;
        setAllParties(list || []);
        const mine = (list || []).find((p) =>
          p.status !== 'ended'
          && (p.hostId === user.id || (p.participants || []).some((m) => m.userId === user.id)));
        setParty(mine || null);

        // 지금 화면에 떠 있는 라이딩 방 — 크루 라이딩은 끝나도(ended) 기록 팝업을 닫을 때까지 방이 남는다.
        // 그 방은 RidingRoom 이 직접 기록을 확정하므로 도크가 대신 확정하지 않게 넘긴다.
        const openRidingPartyId = ridingIdRef.current;
        reconcileRideSessions(user.id, list || [], openRidingPartyId).catch(() => {});
      } catch { /* 재시도 */ }
    };
    load();
    // 화면이 안 보일 때(다른 탭·최소화)는 건너뛴다 — 서버 요청 절약
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [user?.id, partiesReload]);

  // 위치 공유가 켜져 있는 동안은 어느 화면에 있든 내 위치를 보낸다.
  // 근처 모집 중 파티(호스트와 220m)는 서버가 판단하므로 보는 사람·호스트 둘 다 위치가 서버에 있어야 한다.
  // 도크는 로그인하면 항상 떠 있어서 여기서 맡는다. 끄면 멈추고, 서버 위치는 useLocationShare 가 지운다.
  useEffect(() => {
    if (!user?.id || !locShare || !navigator.geolocation) return undefined;
    let first = true;
    const send = () => {
      const pos = myPos.current;
      if (!pos) return;
      reportLocation({ userId: user.id, name: user.name, lat: pos.lat, lng: pos.lng })
        .then(() => {
          // 켠 직후 첫 위치가 올라가면 목록을 바로 다시 받아 근처 링크가 곧장 보이게 한다
          if (first) { first = false; setPartiesReload((n) => n + 1); }
        })
        .catch(() => {});
    };
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        myPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (first) send();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    // 가만히 있으면 위치 콜백이 안 올 수 있어 마지막 위치를 주기적으로 다시 보낸다 (서버는 15초 지나면 공유 중이 아니라고 본다)
    const timer = setInterval(send, 5000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(timer); };
  }, [user?.id, user?.name, locShare]);

  // 내 위치 추적 (패널 열림 동안)
  useEffect(() => {
    if (!open || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => { myPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [open]);

  // 주변 라이더 위치 폴링 (근처 탭 열림 동안)
  useEffect(() => {
    if (!open || curTab !== 'near' || !user?.id) return;
    let alive = true;
    const load = async () => {
      try {
        const others = await getOtherLocations(user.id);   // partyId 없이 → 전체 공유자
        if (!alive) return;
        const map = {};
        (others || []).forEach((o) => { map[o.userId] = o; });
        setLocs(map);
      } catch { /* 무시 */ }
    };
    load();
    // 화면이 안 보일 때(다른 탭·최소화)는 건너뛴다 — 서버 요청 절약
    const timer = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [open, curTab, user?.id]);

  const members = party?.participants || [];
  const memberIds = new Set(members.map((m) => m.userId));

  const browsableParties = allParties.filter((p) => p.status !== 'ended');

  const myStateOf = (p) => {
    if (p.hostId === user?.id) return 'host';
    if ((p.participants || []).some((m) => m.userId === user?.id)) return 'joined';
    if ((p.pendingRequests || []).some((m) => m.userId === user?.id)) return 'pending';
    return 'none';
  };

  const handleApply = async (partyId) => {
    setApplyingId(partyId);
    setApplyError('');
    try {
      const updated = await applyToParty(partyId, { id: user.id });
      setAllParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      // 범위 밖·위치 공유 꺼짐 같은 거부 사유를 서버가 알려준다
      setApplyError(errorMessage(e, t.applyFailed));
    } finally {
      setApplyingId(null);
    }
  };
  const distTo = (loc) => (loc && myPos.current ? distanceM(myPos.current, loc) : null);

  // 사람을 눌러 상세 프로필 — 내 파티 멤버·나는 항상, 근처 라이더는 지도와 같은 220m(NEAR_M) 안일 때만
  const openPerson = (p) => {
    if (p.userId === user?.id || memberIds.has(p.userId)) {
      setSelected({ userId: p.userId, name: p.name });
      return;
    }
    if (p.dist == null || p.dist > NEAR_M) {
      clearTimeout(nearNoticeTimer.current);
      setNearNotice(text.mapProfileTooFar(p.dist == null ? '?' : Math.round(p.dist)));
      nearNoticeTimer.current = setTimeout(() => setNearNotice(''), 4000);
      return;
    }
    setSelected({ userId: p.userId, name: p.name });
  };
  useEffect(() => () => clearTimeout(nearNoticeTimer.current), []);

  const nearby = Object.values(locs)
    .filter((o) => o.userId !== user?.id)
    .map((o) => ({ ...o, dist: distTo(o) }))
    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <div className="partyDock">
      {open && (
        <div className="partyDockPanel" role="dialog" aria-label={inParty ? party.title : t.findTitle}>
          <header className="pdHead">
            <div>
              <strong>{inParty ? party.title : t.findTitle}</strong>
              <span>{inParty ? `${members.length}${t.memberCountUnit}` : `${t.nearbyPrefix} ${nearby.length}${t.memberCountUnit}`}</span>
            </div>
            <div className="pdHeadActions">
              <button type="button" className="pdSoloBtn" onClick={() => setSoloPicker(true)} aria-label={t.soloStart} title={t.soloStart}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
                  <path d="M15 6a1 1 0 100-2 1 1 0 000 2zM12 17.5V14l-3-3 4-3 2 3h3" />
                </svg>
              </button>
              {inParty && (
                <button type="button" className="pdExpand" onClick={() => setRoomOpen(true)} aria-label="채팅방 전체보기" title="채팅방 전체보기">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 3H3v6M15 21h6v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>
              )}
              <button type="button" className="pdClose" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            </div>
          </header>

          <div className="pdTabs">
            <button type="button" className={curTab === 'party' ? 'isActive' : ''} onClick={() => setTab('party')}>{t.partyTab}</button>
            <button type="button" className={curTab === 'chat' ? 'isActive' : ''} onClick={() => setTab('chat')}>{t.chatTab}</button>
            <button type="button" className={curTab === 'near' ? 'isActive' : ''} onClick={() => setTab('near')}>{t.nearTab}</button>
          </div>

          {/* 근처 — 위치 공유 + 주변 라이더 */}
          {curTab === 'near' && (
            <div className="pdNear">
              <button
                type="button"
                className={`pdShareRow${locShare ? ' isOn' : ''}`}
                onClick={() => setLocShare(!locShare)}
                aria-pressed={locShare}
              >
                <span className="pdShareText">
                  <strong>{t.locationShare}</strong>
                  <span>{locShare ? t.locationShareOn : t.locationShareOff}</span>
                </span>
                <span className="pdSwitch" aria-hidden="true"><span className="pdSwitchKnob" /></span>
              </button>
              {nearNotice && <p className="pdNearNotice" role="status">{nearNotice}</p>}

              {/* 내 파티 멤버 — 파티 탭에 있던 '내 파티' 서브탭을 여기로 옮겼다.
                  근처 탭이 "사람" 탭이 되어 멤버와 주변 라이더를 한 화면에서 본다. */}
              {inParty && (
                <>
                  <p className="pdNearGroup">{t.myPartyGroup} · {party.title}</p>
                  <ul className="pdMembers">
                    {members.map((m) => (
                      <li key={m.userId}>
                        <button type="button" className="pdMember" onClick={() => openPerson(m)}>
                          <span className="pdAvatar" aria-hidden="true">{letterOf(m.name)}</span>
                          <span className="pdMemberInfo">
                            <span className="pdMemberName">
                              {m.name}
                              {m.userId === party.hostId && <span className="pdTag pdTagHost">{t.hostBadge}</span>}
                              {m.userId === user.id && <span className="pdTag">{t.meBadge}</span>}
                            </span>
                            <span className={`pdReadyTag${m.ready ? ' isReady' : ''}`}>
                              {m.ready ? `✓ ${t.readyDone}` : t.readyWaiting}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="pdNearGroup">{t.nearbyGroup}</p>
                </>
              )}

              {nearby.length === 0 ? (
                <p className="pdNearHint">{t.nearEmpty}</p>
              ) : (
                <ul className="pdMembers">
                  {nearby.map((o) => {
                    const near = o.dist != null && o.dist < NEAR_M;
                    const canMatch = o.dist != null && o.dist <= MATCH_M && !memberIds.has(o.userId);
                    const sent = outgoingUserIds.has(o.userId);
                    return (
                      <li key={o.userId}>
                        <button type="button" className={`pdMember${near ? ' isNear' : ''}`} onClick={() => openPerson(o)}>
                          <span className="pdAvatar" aria-hidden="true">{letterOf(o.name)}</span>
                          <span className="pdMemberInfo">
                            <span className="pdMemberName">
                              {o.name}
                              {memberIds.has(o.userId) && <span className="pdTag pdTagHost">{t.memberTag}</span>}
                              {near && <span className="pdTag pdTagNear">{t.near}</span>}
                            </span>
                            <span className={`pdMemberDist${near ? ' isNear' : ''}`}>{fmtDist(o.dist) || t.locOff}</span>
                          </span>
                        </button>
                        {canMatch && (
                          <button
                            type="button"
                            className="pdMatchBtn"
                            disabled={sent || matchSendingId === o.userId}
                            onClick={() => handleSendMatch(o.userId)}
                          >
                            {sent ? t.matchSent : t.matchRequest}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* 파티 — 둘러보고 신청하는 목록. 내 파티 멤버는 근처 탭으로 옮겼다. */}
          {curTab === 'party' && (
            <div className="pdPartyPane">
              {applyError && <p className="pdApplyError">{applyError}</p>}
              {/* 남의 모집 중 링크는 호스트와 220m 안에서만 보인다 — 왜 적게 보이는지 알려준다 */}
              {browsableParties.length > 0 && !locShare && (
                <p className="pdRangeHint">
                  {text.partyNeedShare}
                  <button type="button" onClick={() => setLocShare(true)}>{text.partyShareOnBtn}</button>
                </p>
              )}
                  {browsableParties.length === 0 ? (
                    <div className="pdPartyEmpty">
                      <span className="pdEmptyIcon" aria-hidden="true"><PeopleIcon size={28} /></span>
                      <p className="pdNearHint">{locShare ? text.partyNoNearby : text.partyNeedShare}</p>
                      {!locShare && (
                        <button type="button" className="pdApplyBtn" onClick={() => setLocShare(true)}>{text.partyShareOnBtn}</button>
                      )}
                    </div>
                  ) : (
                    <ul className="pdPartyList">
                      {browsableParties.map((p) => {
                        const state = myStateOf(p);
                        const full = p.status === 'full' && state === 'none';
                        return (
                          <li key={p.id} className="pdPartyCard">
                            <div className="pdPartyCardInfo">
                              <strong>{p.title}</strong>
                              <span>{p.fromLabel} → {p.toLabel}</span>
                              <span className="pdPartyCardMeta">
                                {p.participants.length}/{p.maxMembers}{t.memberCountUnit} · {p.hostName}
                                {state === 'none' && p.hostDistanceM != null && ` · ${text.partyHostDist(p.hostDistanceM)}`}
                              </span>
                            </div>
                            {state === 'host' || state === 'joined' ? (
                              <span className="pdPartyStateTag isJoined">✓ {text.partyJoined}</span>
                            ) : state === 'pending' ? (
                              <span className="pdPartyStateTag">{text.partyPending}</span>
                            ) : full ? (
                              <span className="pdPartyStateTag">{text.partyFull}</span>
                            ) : (
                              <button
                                type="button"
                                className="pdApplyBtn"
                                disabled={applyingId === p.id}
                                onClick={() => handleApply(p.id)}
                              >
                                {text.partyApply}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
              )}

              {/* 목록이 짧아도 아래에 붙는다 */}
              <button type="button" className="pdCreateBtn pdCreateBtnList" onClick={(e) => { setOpen(false); onMoveParty?.(e); }}>
                {t.createBtn}
              </button>
            </div>
          )}

          {/* 채팅 — 내가 속한 파티가 여러 개면 목록에서 골라 들어간다 */}
          {curTab === 'chat' && (
            myRooms.length === 0 ? (
              <p className="pdNearHint">{t.chatNeedParty}</p>
            ) : !currentRoom ? (
              <ul className="pdChatRoomList">
                {myRooms.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="pdChatRoomItem" onClick={() => setChatRoomId(r.id)}>
                      <span className="pdAvatar" aria-hidden="true">{letterOf(r.title)}</span>
                      <span className="pdMemberInfo">
                        <span className="pdMemberName">{r.title}</span>
                        <span className="pdMemberDist">{r.participants.length}{t.memberCountUnit} · {r.hostName}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pdChat">
                {myRooms.length > 1 && (
                  <button type="button" className="pdChatBack" onClick={() => setChatRoomId(null)}>
                    ← {currentRoom.title}
                  </button>
                )}
                <div className="pdChatMessages">
                  {chatMessages.length === 0 && <p className="pdNearHint">{t.chatEmpty}</p>}
                  {chatMessages.map((msg, i) => {
                    const mine = msg.senderId === user.id;
                    return (
                      <div key={msg.id ?? i} className={`pdChatBubbleRow${mine ? ' isMine' : ''}`}>
                        <div className="pdChatBubble">
                          {!mine && <div className="pdChatSender">{msg.senderName}</div>}
                          <p className="pdChatContent">{msg.content}</p>
                          <div className="pdChatTime">{displayTime(msg)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>
                <div className="pdChatInputRow">
                  <input
                    type="text"
                    className="pdChatInput"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={t.chatPlaceholder}
                  />
                  <button type="button" className="pdChatSendBtn" onClick={sendChat} disabled={!chatConnected || !chatInput.trim()}>
                    {t.chatSend}
                  </button>
                </div>
              </div>
            )
          )}

        </div>
      )}

      {kickedNotice && (
        <div className={`pdMatchBanner pdKickedBanner${incomingMatches.length > 0 ? ' isStacked' : ''}`} role="alert">
          <span className="pdKickedText">{t.kickedNotice(kickedNotice.title)}</span>
          <button type="button" className="pdMatchRejectBtn" onClick={() => setKickedNotice(null)}>{t.kickedOk}</button>
        </div>
      )}

      {incomingMatches.length > 0 && (
        <div className="pdMatchBanner" role="alert">
          <span className="pdAvatar" aria-hidden="true">{letterOf(incomingMatches[0].fromName)}</span>
          <span className="pdMemberInfo">
            <span className="pdMemberName">{incomingMatches[0].fromName}{t.matchRequestedSuffix}</span>
            {incomingMatches.length > 1 && <span className="pdMemberDist">+{incomingMatches.length - 1}{t.matchMoreSuffix}</span>}
          </span>
          <div className="pdMatchBannerActions">
            <button
              type="button"
              className="pdMatchAcceptBtn"
              disabled={matchActingId === incomingMatches[0].id}
              onClick={() => handleAcceptMatch(incomingMatches[0])}
            >
              {t.matchAccept}
            </button>
            <button
              type="button"
              className="pdMatchRejectBtn"
              disabled={matchActingId === incomingMatches[0].id}
              onClick={() => handleRejectMatch(incomingMatches[0])}
            >
              {t.matchReject}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`partyDockFab${open ? ' isOpen' : ''}${isRiding && !open ? ' isRiding' : ''}`}
        // 라이딩 중이면 도크를 여는 대신 라이딩 화면으로 바로 들어간다
        onClick={() => (isRiding ? setRidingId(ridingParty.id) : setOpen((o) => !o))}
        aria-label={isRiding ? t.ridingOpen : inParty ? party.title : t.findTitle}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : isRiding ? (
          // 라이딩 중에는 브랜드 자전거 로고를 그대로 쓴다 (색은 currentColor → 흰색)
          <BrandLogo className="partyDockLogo" />
        ) : (
          <>
            <PeopleIcon />
            {inParty && <span className="partyDockBadge">{members.length}</span>}
          </>
        )}
      </button>

      {soloPicker && (
        <div className="pdSoloBackdrop" onClick={() => setSoloPicker(false)} role="presentation">
          <div className="pdSoloModal" role="dialog" aria-label={t.soloPickerTitle} onClick={(e) => e.stopPropagation()}>
            <h3>{t.soloPickerTitle}</h3>
            <button type="button" className="pdSoloFreeBtn" onClick={() => startSolo(null)}>{t.soloFreeBtn}</button>
            <p className="pdSoloOr">{t.soloOr}</p>
            {soloRoutesLoading ? (
              <p className="pdNearHint">{t.soloLoading}</p>
            ) : soloRoutes.length === 0 ? (
              <p className="pdNearHint">{t.soloNoRoutes}</p>
            ) : (
              <ul className="pdSoloRouteList">
                {soloRoutes.map((r) => (
                  <li key={r.id}>
                    <span>{r.routeName}</span>
                    <button type="button" onClick={() => startSolo(r)}>{t.soloStartCourseBtn}</button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="pdSoloCancel" onClick={() => setSoloPicker(false)}>{t.soloCancel}</button>
          </div>
        </div>
      )}

      {selected && (
        <UserProfileModal
          userId={selected.userId}
          name={selected.name}
          isMe={selected.userId === user?.id}
          badges={inParty && selected.userId === party.hostId ? [t.hostBadge] : []}
          onClose={() => setSelected(null)}
        />
      )}

      {soloConfig && (
        <PersonalRidingRoom
          user={user}
          route={soloConfig.route}
          onClose={() => setSoloConfig(null)}
        />
      )}

      {roomOpen && myRooms.length > 0 && (
        <PartyRoom
          rooms={myRooms}
          user={user}
          initialRoomId={roomInitialId}
          onClose={() => { setRoomOpen(false); setRoomInitialId(null); }}
          onRoomsChange={(updated) => setAllParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
          onStartRide={(partyId) => {
            setRoomOpen(false);
            setOpen(false);
            setRidingId(partyId);
          }}
        />
      )}

      {ridingRoomParty && (
        <RidingRoom
          key={ridingRoomParty.id}
          party={ridingRoomParty}
          user={user}
          onPartyChange={(updated) => setAllParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
          onClose={() => leaveRidingRoom(ridingRoomParty.id)}
          onEnded={(info) => leaveRidingRoom(ridingRoomParty.id, info?.gone)}
        />
      )}
    </div>
  );
}
