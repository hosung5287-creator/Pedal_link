import { useEffect, useState } from 'react';
import { text } from '../constants';
import heroBg from '../backglound1.png';
import {
  getParties, getMyRoutesForParty, createParty,
  applyToParty, approveRequest, rejectRequest,
} from '../api/parties';

// 모임 시간 표시용 포맷
function formatStartAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// 저장 경로 한 개 + "링크 만들기" 폼
function RouteToParty({ route, onCreate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!startAt) return;
    setSubmitting(true);
    try {
      await onCreate({ route, title, startAt, maxMembers });
      setOpen(false);
      setTitle(''); setStartAt(''); setMaxMembers(6);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="routePick">
      <div className="routePickInfo">
        <h4>{route.routeName}</h4>
        <p>
          {route.fromLabel} → {route.toLabel}
          {route.distanceKm != null && <span> · {route.distanceKm} km</span>}
        </p>
      </div>

      {open ? (
        <form className="partyForm" onSubmit={submit}>
          <label>
            <span>{text.partyFormTitle}</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={text.partyFormTitlePlaceholder} />
          </label>
          <div className="partyFormRow">
            <label>
              <span>{text.partyFormTime}</span>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </label>
            <label className="partyFormMax">
              <span>{text.partyFormMax}</span>
              <input type="number" min="2" max="30" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
            </label>
          </div>
          <div className="partyFormActions">
            <button type="button" className="partyGhostBtn" onClick={() => setOpen(false)}>{text.partyCancel}</button>
            <button type="submit" className="partyPrimaryBtn" disabled={submitting}>{text.partyCreate}</button>
          </div>
        </form>
      ) : (
        <button type="button" className="partyPrimaryBtn" onClick={() => setOpen(true)}>
          {text.partyMakeButton}
        </button>
      )}
    </li>
  );
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

// 파티 카드
function PartyCard({ party, me, isLoggedIn, onApply, onApprove, onReject, onLoginNeeded }) {
  // 'me' 는 데모 시드 파티의 호스트 표식 → 현재 로그인 유저를 호스트로 취급
  const isHost = party.hostId === me.id || party.hostId === 'me';
  const full = party.participants.length >= party.maxMembers;
  const myState = party.participants.some((m) => m.userId === me.id)
    ? 'joined'
    : party.pendingRequests.some((m) => m.userId === me.id)
      ? 'pending'
      : 'none';

  return (
    <article className={`partyCard${full ? ' isFull' : ''}`}>
      <div className="partyCardHead">
        <h3>{party.title}</h3>
        {isHost
          ? <span className="partyHostTag">{text.partyHostBadge}</span>
          : <span className="partyRouteTag">{party.routeName}</span>}
      </div>
      <p className="partyCardRoute">
        {party.fromLabel} → {party.toLabel}
        {party.distanceKm != null && <span> · {party.distanceKm} km</span>}
      </p>
      <dl className="partyCardMeta">
        <div><dt>🕒</dt><dd>{formatStartAt(party.startAt)}</dd></div>
        <div><dt>👥</dt><dd>{text.partyParticipants} {party.participants.length}/{party.maxMembers}{text.partyMembers}</dd></div>
        <div><dt>{text.partyHost}</dt><dd>{party.hostName}</dd></div>
      </dl>

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
      ) : (
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

export default function PartyPage({ user, onMoveHome, onMoveLogin }) {
  const me = { id: user?.id ?? 'me', name: user?.name ?? '나' };
  const isLoggedIn = !!user;

  const [routes, setRoutes] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([getMyRoutesForParty(), getParties()]).then(([r, p]) => {
      if (!alive) return;
      setRoutes(r);
      setParties(p);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // 목록에서 해당 파티만 교체
  const replaceParty = (updated) =>
    setParties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  const handleCreate = async ({ route, title, startAt, maxMembers }) => {
    const party = await createParty({ route, title, startAt, maxMembers, host: me });
    setParties((prev) => [party, ...prev]);
  };
  const handleApply = async (id) => replaceParty(await applyToParty(id, me));
  const handleApprove = async (partyId, userId) => replaceParty(await approveRequest(partyId, userId));
  const handleReject = async (partyId, userId) => replaceParty(await rejectRequest(partyId, userId));

  return (
    <div className="partyPage">
      <nav className="navbar" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}>PedalLink</a>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
      </nav>

      <header className="partyHero" style={{ backgroundImage: `url(${heroBg})` }}>
        <p className="eyebrow">{text.partyEyebrow}</p>
        <h1>{text.partyTitle}</h1>
        <p className="partyHeroSub">{text.partySub}</p>
      </header>

      <main className="partyLayout">
        <section className="partySection">
          <h2>{text.partyMyRoutes}</h2>
          {loading ? (
            <p className="partyEmpty">불러오는 중…</p>
          ) : routes.length === 0 ? (
            <p className="partyEmpty">{text.partyNoRoutes}</p>
          ) : (
            <ul className="routePickList">
              {routes.map((r) => (
                <RouteToParty key={r.id} route={r} onCreate={handleCreate} />
              ))}
            </ul>
          )}
        </section>

        <section className="partySection">
          <h2>{text.partyOpenList}</h2>
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
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
