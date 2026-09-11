import '../styles/party.css';

import BrandLogo from '../components/BrandLogo';
import { PartyRoomPanel } from '../components/PartyRoom';
import CreatePartyModal from '../components/CreatePartyModal';
import RouteMapThumbnail from '../components/RouteMapThumbnail';

import { useEffect, useState } from 'react';
import { text } from '../constants';
import {
  getParties, createParty,
  applyToParty, approveRequest, rejectRequest, deleteParty, startPartyRide,
} from '../api/parties';
import { getRouteById } from '../api/routes';
import { getChatHistory } from '../api/chat';
import { openRidingRoom } from '../utils/riding';
import { countUnread, UNREAD_EVENT } from '../utils/chatUnread';

// 모임 시간 표시용 포맷
function formatStartAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// 신청자 측 액션 버튼 (상태에 따라 다르게)
function ApplyAction({ myState, full, isLoggedIn, onApply, onLoginNeeded }) {
  if (!isLoggedIn) {
    return <button type="button" className="partyPrimaryBtn partyJoinBtn" onClick={onLoginNeeded}>{text.partyLoginNeeded}</button>;
  }
  if (myState === 'joined') {
    return <button type="button" className="partyPrimaryBtn partyJoinBtn" disabled>✓ {text.partyJoined}</button>;
  }
  if (myState === 'pending') {
    return <button type="button" className="partyPrimaryBtn partyJoinBtn" disabled>{text.partyPending}</button>;
  }
  if (full) {
    return <button type="button" className="partyPrimaryBtn partyJoinBtn" disabled>{text.partyFull}</button>;
  }
  return <button type="button" className="partyPrimaryBtn partyJoinBtn" onClick={onApply}>{text.partyApply}</button>;
}

// 파티 카드 상단 미디어 — 올린 사진이 있으면 사진, 없으면 경로 지도.
// 파티 응답(PartyResponse)에는 좌표가 없어서 경로를 한 번 더 불러온다.
function PartyCardMedia({ party }) {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!party.routeId) { setRoute(null); return undefined; }
    getRouteById(party.routeId)
      .then((r) => { if (alive) setRoute(r); })
      .catch(() => { if (alive) setRoute(null); });
    return () => { alive = false; };
  }, [party.routeId]);

  const path = route?.bikeRoute?.length ? route.bikeRoute : null;

  return (
    <div className="partyCardMedia">
      {route?.photo
        ? <img className="partyCardPhoto" src={route.photo} alt="" loading="lazy" />
        : path
          ? <RouteMapThumbnail path={path} />
          : <div className="partyCardMediaEmpty" aria-hidden="true" />}
      <span className="partyCardMediaTag">{party.routeName}</span>
    </div>
  );
}

// 내 파티 목록 카드 — 크루 카드(.crewCard)와 같은 구성.
// 누르면 그 파티의 대기방(3단)으로 들어간다.
function MyPartyCard({ party, onOpen }) {
  const riding = !!party.rideStartedAt;

  return (
    <article className="partyCard">
      <PartyCardMedia party={party} />

      <div className="partyCardHead">
        <h3>{party.title}</h3>
        {riding && <span className="partyRidingTag">{text.partyRidingNow}</span>}
      </div>
      <p className="partyCardRoute">
        {party.fromLabel} → {party.toLabel}
        {party.distanceKm != null && <span> · {party.distanceKm} km</span>}
      </p>
      <dl className="partyCardMeta">
        <div><dt>일정</dt><dd>{formatStartAt(party.startAt)}</dd></div>
        <div><dt>인원</dt><dd>{party.participants.length}/{party.maxMembers}{text.partyMembers}</dd></div>
        <div><dt>{text.partyHost}</dt><dd>{party.hostName}</dd></div>
      </dl>

      <button type="button" className="partyPrimaryBtn" onClick={() => onOpen(party.id)}>
        {text.partyOpenRoom}
      </button>
    </article>
  );
}

// 파티 카드
function PartyCard({ party, me, isLoggedIn, onApply, onApprove, onReject, onLoginNeeded, onStartRide, onDelete }) {
  // 삭제는 되돌릴 수 없으므로 한 번 더 확인받는다.
  // 이 앱은 OS 기본 confirm 을 쓰지 않기로 했으므로 카드 안에서 처리한다.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 'me' 는 데모 시드 파티의 호스트 표식 → 현재 로그인 유저를 호스트로 취급
  const isHost = party.hostId === me.id || party.hostId === 'me';
  const full = party.participants.length >= party.maxMembers;
  const myState = party.participants.some((m) => m.userId === me.id)
    ? 'joined'
    : party.pendingRequests.some((m) => m.userId === me.id)
      ? 'pending'
      : 'none';

  // 모집이 끝났고 내가 참여 확정된 사람이면 라이딩에 들어갈 수 있다.
  // 호스트도 개설 시 participants 에 joined 로 들어가므로 같은 조건으로 묶인다.
  const ended = party.status === 'ended';
  const canRide = !ended && full && (isHost || myState === 'joined');

  return (
    <article className={`partyCard${full ? ' isFull' : ''}${ended ? ' isEnded' : ''}`}>
      <PartyCardMedia party={party} />

      <div className="partyCardHead">
        <h3>{party.title}</h3>
        {isHost ? (
          <span className="partyHeadRight">
            <span className="partyHostTag">{text.partyHostBadge}</span>
            <button
              type="button"
              className="partyDeleteBtn"
              onClick={() => setConfirmingDelete(true)}
              aria-label={text.partyDelete}
              title={text.partyDelete}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </span>
        ) : (
          <span className="partyRouteTag">{party.routeName}</span>
        )}
      </div>
      <p className="partyCardRoute">
        {party.fromLabel} → {party.toLabel}
        {party.distanceKm != null && <span> · {party.distanceKm} km</span>}
      </p>
      <dl className="partyCardMeta">
        <div><dt>일정</dt><dd>{formatStartAt(party.startAt)}</dd></div>
        <div><dt>인원</dt><dd>{text.partyParticipants} {party.participants.length}/{party.maxMembers}{text.partyMembers}</dd></div>
        <div><dt>{text.partyHost}</dt><dd>{party.hostName}</dd></div>
      </dl>

      {confirmingDelete && (
        <div className="partyDeleteConfirm">
          <p>{text.partyDeleteConfirm}</p>
          <div className="partyDeleteActions">
            <button type="button" className="partyGhostBtn" onClick={() => setConfirmingDelete(false)}>
              {text.partyDeleteNo}
            </button>
            <button type="button" className="partyDeleteYesBtn" onClick={() => onDelete(party.id)}>
              {text.partyDeleteYes}
            </button>
          </div>
        </div>
      )}

      {/* 모집이 끝나면 멤버 누구나 지도를 파티 모드로 연다 (호스트·참가자 동일) */}
      {canRide && (
        <button type="button" className="partyRideBtn" onClick={() => onStartRide(party.id)}>
          {isHost ? text.partyStartRide : text.partyJoinRide}
        </button>
      )}

      {isHost ? (
        <div className="partyPending">
          <h4>{text.partyPendingTitle} ({party.pendingRequests.length})</h4>
          {party.pendingRequests.length === 0 ? (
            <p className="partyPendingEmpty">{text.partyNoPending}</p>
          ) : (
            <ul>
              {party.pendingRequests.map((req) => (
                <li key={req.userId}>
                  <span>{req.name}</span>
                  <span className="partyPendingActions">
                    <button type="button" className="partyApproveBtn" disabled={full} onClick={() => onApprove(party.id, req.userId)}>
                      {text.partyApprove}
                    </button>
                    <button type="button" className="partyRejectBtn" onClick={() => onReject(party.id, req.userId)}>
                      {text.partyReject}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : ended ? (
        <button type="button" className="partyPrimaryBtn partyJoinBtn" disabled>{text.partyEnded}</button>
      ) : canRide ? null : (
        <ApplyAction
          myState={myState}
          full={full}
          isLoggedIn={isLoggedIn}
          onApply={() => onApply(party.id)}
          onLoginNeeded={onLoginNeeded}
        />
      )}
    </article>
  );
}

export default function PartyPage({ user, onMoveHome, onMoveLogin, onStartRide, onOpenMap, onMoveBrowse, onMoveParty , onMoveCrew}) {
  const me = { id: user?.id ?? 'me', name: user?.name ?? '나' };
  const isLoggedIn = !!user;

  const [parties, setParties] = useState([]);
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState('list');   // 'list' = 모집 중인 링크, 'room' = 내 파티
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roomId, setRoomId] = useState(null);

  // 내가 호스트이거나 참여 확정된 파티 = 대기방을 열 수 있는 파티.
  // id 는 서버가 숫자로 주지만 예전 로그인 정보가 문자열로 남아 있을 수 있어 느슨하게 비교한다.
  const sameId = (a, b) => a != null && b != null && String(a) === String(b);
  const myRooms = parties.filter((p) =>
    p.status !== 'ended'
    && (sameId(p.hostId, me.id) || (p.participants || []).some((m) => sameId(m.userId, me.id))));
  // 크루와 같은 흐름: 목록에서 하나를 고르면 그때 대기방을 연다
  const room = roomId != null ? myRooms.find((r) => r.id === roomId) || null : null;

  // 내 파티 탭의 뱃지 = 내가 속한 방들의 안 읽은 채팅 수 합계
  const [unread, setUnread] = useState(0);
  const myRoomIds = myRooms.map((r) => r.id).join(',');

  useEffect(() => {
    const ids = myRoomIds ? myRoomIds.split(',').map(Number) : [];
    if (!user?.id || ids.length === 0) { setUnread(0); return undefined; }

    let alive = true;
    const load = async () => {
      try {
        const counts = await Promise.all(ids.map(async (id) =>
          countUnread(id, await getChatHistory(id), user.id)));
        if (alive) setUnread(counts.reduce((a, b) => a + b, 0));
      } catch { /* 채팅 서버가 없어도 페이지는 그대로 동작해야 한다 */ }
    };
    load();
    const timer = setInterval(load, 20000);
    // 다른 화면에서 방을 읽으면 즉시 반영
    window.addEventListener(UNREAD_EVENT, load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(UNREAD_EVENT, load);
    };
  }, [myRoomIds, user?.id]);

  useEffect(() => {
    let alive = true;
    getParties()
      .then((p) => {
        if (!alive) return;
        setParties(p);
      })
      // 서버가 죽었거나 500 을 주면 여기서 잡는다.
      // catch 가 없으면 loading 이 true 로 남아 화면이 "불러오는 중…" 에서 영영 멈춘다.
      .catch(() => {
        if (!alive) return;
        setError(text.partyLoadFailed);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
    // 마운트 시 1회만 로드 (user?.id 는 최초 렌더 값 사용 의도)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 목록에서 해당 파티만 교체
  const replaceParty = (updated) =>
    setParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  const handleCreate = async ({ route, title, startAt, maxMembers }) => {
    const party = await createParty({ route, title, startAt, maxMembers, host: me });
    setParties((prev) => [party, ...prev]);
  };
  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteParty(id, me.id);
      setParties((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      // 목록은 그대로 두고 실패만 알린다
      setError(e.status === 403 ? '호스트만 삭제할 수 있습니다.' : text.partyDeleteFailed);
    }
  };

  // 라이딩 시작 — 지도 페이지로 넘어가지 않고, 플로팅 버튼이 띄우는 것과 같은
  // 라이딩 화면(RidingRoom)을 그대로 연다.
  const handleStartRide = async (partyId) => {
    const target = parties.find((p) => p.id === partyId);
    // 호스트가 처음 시작하는 경우에만 서버에 시작을 알린다
    // (이미 시작됐거나 참가자면 바로 화면만 연다)
    if (target && !target.rideStartedAt && target.hostId === me.id) {
      try {
        replaceParty(await startPartyRide(partyId, me.id));
      } catch {
        setError(text.partyRideStartFailed);
        return;
      }
    }
    openRidingRoom(partyId);
  };

  const handleApply = async (id) => replaceParty(await applyToParty(id, me));
  const handleApprove = async (partyId, userId) => replaceParty(await approveRequest(partyId, userId));
  const handleReject = async (partyId, userId) => replaceParty(await rejectRequest(partyId, userId));

  return (
    <div className="partyPage">
      <nav className="navbar partyNav" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>{text.feed}</a>
          <a href="/party" onClick={onMoveParty}>{text.party}</a>
          <a href="/crew" onClick={onMoveCrew}>{text.crew}</a>
          <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
        </div>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
      </nav>

      {/* 왼쪽 세로 네비로 모집 목록 ↔ 내 파티 전환.
          파티가 없어도 전환은 되고, 내 파티가 비어 있으면 안내를 보여준다. */}
      <div className="partyBody">

      <div className="partyBodyMain">
      <nav className="partyViewSwitch" role="tablist" aria-label={text.partyViewSwitch}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={view === 'list' ? 'isActive' : ''}
          onClick={() => setView('list')}
          title={text.partyViewList}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
          <span className="partyViewLabel">
            <strong>{text.partyViewList}</strong>
            <span>{text.partyViewListHint}</span>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'room'}
          className={view === 'room' ? 'isActive' : ''}
          onClick={() => setView('room')}
          title={text.partyViewRoom}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
          <span className="partyViewLabel">
            {/* 대기방에 들어가 있으면 그 파티 이름, 목록이면 참여 중인 파티 수.
                (room 은 대기방을 열었을 때만 채워지므로 개수는 myRooms 로 센다) */}
            <strong>{room ? `${room.title} ${text.party}` : text.partyViewRoom}</strong>
            <span>
              {room
                ? `${room.participants.length}/${room.maxMembers}${text.partyMembers}`
                : myRooms.length > 0
                  ? `${myRooms.length}${text.partyCountUnit}`
                  : text.partyViewRoomHint}
            </span>
          </span>
          {unread > 0 && <span className="partyViewCount">{unread > 99 ? '99+' : unread}</span>}
        </button>

        {/* 둘러보기의 "게시물 올리기"와 같은 알약 버튼 — 탭 줄 오른쪽 끝 */}
        <button
          type="button"
          className="composeBtn partyViewAction"
          onClick={isLoggedIn ? () => setComposing(true) : onMoveLogin}
        >
          {isLoggedIn ? text.partyMakeButton : text.login}
        </button>
      </nav>


      {view === 'room' && (
        <section className="partyRoomSection">
          {room ? (
            <>
              <button type="button" className="partyBack" onClick={() => setRoomId(null)}>
                ← {text.partyViewRoom}
              </button>
            <PartyRoomPanel
              key={room.id}
              inline
              party={room}
              rooms={myRooms}
              user={user}
              onSelectRoom={setRoomId}
              onUpdate={replaceParty}
              onRemove={(id) => setParties((prev) => prev.filter((p) => p.id !== id))}
              onStartRide={handleStartRide}
            />
            </>
          ) : myRooms.length > 0 ? (
            <div className="partyGrid">
              {myRooms.map((p) => (
                <MyPartyCard key={p.id} party={p} onOpen={setRoomId} />
              ))}
            </div>
          ) : (
            <div className="partyRoomEmpty">
              <span className="partyRoomEmptyIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
                     strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              </span>
              <strong>{loading ? text.browseLoading : text.partyRoomEmptyTitle}</strong>
              {!loading && (
                <>
                  <p>{isLoggedIn ? text.partyRoomEmptySub : text.partyRoomEmptyLogin}</p>
                  <button
                    type="button"
                    className="partyPrimaryBtn"
                    onClick={isLoggedIn ? () => setView('list') : onMoveLogin}
                  >
                    {isLoggedIn ? text.partyViewList : text.login}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {view === 'list' && (
        <>
      <main className="partyLayout">
        <section className="partySection">
          <h2>{text.partyOpenList}</h2>
          {error && <p className="partyError">{error}</p>}
          {loading ? (
            <p className="partyEmpty">불러오는 중…</p>
          ) : parties.length === 0 ? (
            <p className="partyEmpty">{text.partyNoParties}</p>
          ) : (
            <div className="partyGrid">
              {parties.map((p) => (
                <PartyCard
                  key={p.id}
                  party={p}
                  me={me}
                  isLoggedIn={isLoggedIn}
                  onApply={handleApply}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onLoginNeeded={onMoveLogin}
                  onStartRide={handleStartRide}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>
        </>
      )}
      </div>
      </div>

      {composing && (
        <CreatePartyModal
          user={user}
          onClose={() => setComposing(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
