import { useEffect, useState } from 'react';
import { crewRide as t } from '../constants';
import { errorMessage } from '../api/client';
import { getRoutes } from '../api/routes';
import {
  openCrewRide, getCrewRide, respondCrewRide, startCrewRideCheck, checkCrewRide, startCrewRide, cancelCrewRide,
} from '../api/crewRides';
import { openRidingRoom } from '../utils/riding';

// 크루 라이딩 ("이번주 라이딩 열기") 화면 조각들 — CrewPage 의 크루 상세가 쓴다.
//  - OpenRideModal: 팀장이 멤버·코스·날짜를 골라 연다
//  - CrewRidePanel: 진행 중인 라이딩 (관리 칸) — 상태·멤버·팀장 버튼
//  - RideInviteCard: 크루 채팅의 초대 카드 — 참여/불참 (2차 확인)

function fmtWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// datetime-local 기본값 — 내일 07:00
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T07:00`;
}

// ───────── 열기 ─────────
export function OpenRideModal({ crew, user, onClose, onOpened }) {
  const candidates = (crew.members || []).filter((m) => m.userId !== user.id);
  const [title, setTitle] = useState(t.titleDefault);
  const [when, setWhen] = useState(defaultWhen);
  const [picked, setPicked] = useState([]);
  const [routes, setRoutes] = useState(null);
  const [routeId, setRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getRoutes(user.id)
      .then((list) => {
        if (!alive) return;
        setRoutes(list || []);
        if (list?.length) setRouteId(String(list[0].id));
      })
      .catch(() => { if (alive) setRoutes([]); });
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allPicked = candidates.length > 0 && picked.length === candidates.length;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ride = await openCrewRide(crew.id, {
        leaderId: user.id, title, startAt: when, routeId: Number(routeId) || null, memberIds: picked,
      });
      onOpened(ride);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t.openFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="crRideBackdrop" onClick={onClose} role="presentation">
      <form className="crRideModal" role="dialog" aria-modal="true" aria-labelledby="cr-open-title"
            onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 id="cr-open-title">{t.openTitle}</h2>

        <label className="crField">
          <span>{t.titleLabel}</span>
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="crField">
          <span>{t.whenLabel}</span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </label>
        <label className="crField">
          <span>{t.routeLabel}</span>
          {routes && routes.length === 0 ? (
            <p className="crHint">{t.routeNone}</p>
          ) : (
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              {(routes || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.routeName}{r.distanceKm != null ? ` · ${r.distanceKm}km` : ''}{r.waypointCount > 0 ? ` · 경유 ${r.waypointCount}곳` : ''}
                </option>
              ))}
            </select>
          )}
        </label>

        <div className="crField">
          <span className="crFieldHead">
            {t.membersLabel} ({picked.length}/{candidates.length})
            {candidates.length > 0 && (
              <button type="button" className="crLinkBtn"
                      onClick={() => setPicked(allPicked ? [] : candidates.map((m) => m.userId))}>
                {t.selectAll}
              </button>
            )}
          </span>
          {candidates.length === 0 ? (
            <p className="crHint">{t.noMembers}</p>
          ) : (
            <ul className="crPickList">
              {candidates.map((m) => (
                <li key={m.userId}>
                  <label>
                    <input type="checkbox" checked={picked.includes(m.userId)} onChange={() => toggle(m.userId)} />
                    {m.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="crError">{error}</p>}
        <div className="crActions">
          <button type="button" className="crGhostBtn" onClick={onClose} disabled={busy}>{t.cancel}</button>
          <button type="submit" className="crPrimaryBtn" disabled={busy || picked.length === 0 || !routeId}>{t.openSubmit}</button>
        </div>
      </form>
    </div>
  );
}

// ───────── 참여/불참 (2차 확인) — 패널·채팅 카드가 같이 쓴다 ─────────
function RespondButtons({ ride, user, onChange }) {
  const [confirm, setConfirm] = useState(null); // 'join' | 'decline'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (accept) => {
    setBusy(true);
    setError('');
    try {
      onChange(await respondCrewRide(ride.eventId, user.id, accept));
      setConfirm(null);
    } catch (err) {
      setError(errorMessage(err, t.actionFailed));
    } finally {
      setBusy(false);
    }
  };

  if (confirm) {
    return (
      <div className="crConfirm">
        <p>{confirm === 'join' ? t.confirmJoin : t.confirmDecline}</p>
        <div className="crActions">
          <button type="button" className="crGhostBtn" onClick={() => setConfirm(null)} disabled={busy}>{t.no}</button>
          <button type="button" className="crPrimaryBtn" onClick={() => send(confirm === 'join')} disabled={busy}>{t.yes}</button>
        </div>
        {error && <p className="crError">{error}</p>}
      </div>
    );
  }
  return (
    <div className="crActions">
      <button type="button" className="crGhostBtn" onClick={() => setConfirm('decline')}>{t.decline}</button>
      <button type="button" className="crPrimaryBtn" onClick={() => setConfirm('join')}>{t.join}</button>
    </div>
  );
}

// 내 상태 한 줄 (팀장 제외)
function MyStatus({ ride, user, onChange }) {
  const s = ride.myStatus;
  if (s === 'invited') {
    return ride.status === 'recruiting'
      ? <RespondButtons ride={ride} user={user} onChange={onChange} />
      : <p className="crMine">{t.responseClosed}</p>;
  }
  if (s === 'accepted') return <p className="crMine isOk">{t.myAccepted(fmtWhen(ride.myTokenExpiresAt))}</p>;
  if (s === 'checked') return <p className="crMine isOk">{t.myChecked}</p>;
  if (s === 'declined') return <p className="crMine">{t.myDeclined}</p>;
  if (s === 'none') return <p className="crMine">{t.notInvited}</p>;
  return null;
}

// ───────── 채팅 초대 카드 ─────────
// active: 지금 진행 중인 라이딩(같은 이벤트면 그 값을 써서 패널과 바로 맞춘다)
export function RideInviteCard({ eventId, user, active, onChange }) {
  const [own, setOwn] = useState(null);
  const ride = active && active.eventId === Number(eventId) ? active : own;

  useEffect(() => {
    if (active && active.eventId === Number(eventId)) return undefined;
    let alive = true;
    getCrewRide(eventId, user?.id).then((r) => { if (alive) setOwn(r); }).catch(() => {});
    return () => { alive = false; };
  }, [eventId, user?.id, active]);

  if (!ride) return <div className="crInvite"><strong>{t.inviteCard}</strong></div>;
  const handle = (updated) => { setOwn(updated); onChange?.(updated); };
  return (
    <div className="crInvite">
      <span className="crInviteTag">{t.inviteCard}</span>
      <strong>{ride.title}</strong>
      <span className="crInviteMeta">{fmtWhen(ride.startAt)}{ride.routeName ? ` · ${ride.routeName}` : ''}</span>
      <span className={`crStatus is-${ride.status}`}>{t.status[ride.status] || ride.status}</span>
      {ride.myStatus !== 'leader' && <MyStatus ride={ride} user={user} onChange={handle} />}
    </div>
  );
}

// ───────── 관리 칸 패널 ─────────
export function CrewRidePanel({ ride, user, onChange }) {
  const isLeader = ride.myStatus === 'leader';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reasons, setReasons] = useState({}); // userId -> 체크 실패 사유

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      const updated = await fn();
      if (updated.checkResults) {
        // 체크된 사람은 사유를 지우고, 안 된 사람은 사유를 남긴다
        setReasons((prev) => {
          const next = { ...prev };
          updated.checkResults.forEach((c) => { next[c.userId] = c.ok ? null : c.reason; });
          return next;
        });
      }
      onChange(updated);
      return updated;
    } catch (err) {
      setError(errorMessage(err, t.actionFailed));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const checkedCount = ride.members.filter((m) => m.status === 'checked').length;
  const canRide = ride.status === 'riding' && (isLeader || ride.myStatus === 'checked');

  return (
    <div className="crPanel">
      <div className="crPanelHead">
        <strong>{ride.title}</strong>
        <span className={`crStatus is-${ride.status}`}>{t.status[ride.status] || ride.status}</span>
      </div>
      <p className="crPanelMeta">{fmtWhen(ride.startAt)}{ride.routeName ? ` · ${ride.routeName}` : ''} · {t.leaderTag} {ride.leaderName}</p>

      <ul className="crRideMembers">
        {ride.members.map((m) => (
          <li key={m.userId}>
            <span className="crMemberName">{m.name}</span>
            <span className={`crMemberStatus is-${m.status}`}>{t.memberStatus[m.status] || m.status}</span>
            {isLeader && ride.status === 'checking' && m.status === 'accepted' && (
              <button type="button" className="crSmallBtn" disabled={busy}
                      onClick={() => run(() => checkCrewRide(ride.eventId, user.id, m.userId))}>
                {t.check}
              </button>
            )}
            {reasons[m.userId] && <span className="crReason">{reasons[m.userId]}</span>}
          </li>
        ))}
      </ul>

      {!isLeader && <MyStatus ride={ride} user={user} onChange={onChange} />}

      {isLeader && ride.status === 'recruiting' && (
        <>
          <p className="crHint">{t.startCheckHint}</p>
          <div className="crActions">
            <button type="button" className="crGhostBtn" disabled={busy} onClick={() => run(() => cancelCrewRide(ride.eventId, user.id))}>{t.cancelRide}</button>
            <button type="button" className="crPrimaryBtn" disabled={busy} onClick={() => run(() => startCrewRideCheck(ride.eventId, user.id))}>{t.startCheck}</button>
          </div>
        </>
      )}

      {isLeader && ride.status === 'checking' && (
        <>
          <p className="crHint">{t.checkHint}</p>
          <button type="button" className="crGhostBtn crWide" disabled={busy}
                  onClick={() => run(() => checkCrewRide(ride.eventId, user.id))}>
            {t.checkAll}
          </button>
          <p className="crHint">{t.startHint}</p>
          <div className="crActions">
            <button type="button" className="crGhostBtn" disabled={busy} onClick={() => run(() => cancelCrewRide(ride.eventId, user.id))}>{t.cancelRide}</button>
            <button type="button" className="crPrimaryBtn" disabled={busy || checkedCount === 0}
                    onClick={async () => {
                      const r = await run(() => startCrewRide(ride.eventId, user.id));
                      if (r?.partyId) openRidingRoom(r.partyId);   // 팀장은 바로, 멤버는 파티 도크가 자동으로 연다
                    }}>
              {t.start(checkedCount)}
            </button>
          </div>
        </>
      )}

      {canRide && ride.partyId && (
        <button type="button" className="crPrimaryBtn crWide" onClick={() => openRidingRoom(ride.partyId)}>{t.openRiding}</button>
      )}

      {error && <p className="crError">{error}</p>}
    </div>
  );
}
