import { useEffect, useState } from 'react';
import { text } from '../constants';
import heroBg from '../backglound1.png';
import { getParties, getMyRoutesForParty, createParty, joinParty } from '../api/parties';

// 모임 시간 표시용 포맷
function formatStartAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// 저장 경로 한 개 + "번개 만들기" 폼
function RouteToParty({ route, onCreated }) {
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
      const party = await createParty({ route, title, startAt, maxMembers });
      onCreated(party);
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
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={text.partyFormTitlePlaceholder}
            />
          </label>
          <div className="partyFormRow">
            <label>
              <span>{text.partyFormTime}</span>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </label>
            <label className="partyFormMax">
              <span>{text.partyFormMax}</span>
              <input
                type="number" min="2" max="30"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
              />
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

// 모집 중인 번개 카드
function PartyCard({ party, onJoin }) {
  const full = party.status === 'full' || party.joinedMembers >= party.maxMembers;
  return (
    <article className={`partyCard${full ? ' isFull' : ''}`}>
      <div className="partyCardHead">
        <h3>{party.title}</h3>
        <span className="partyRouteTag">{party.routeName}</span>
      </div>
      <p className="partyCardRoute">
        {party.fromLabel} → {party.toLabel}
        {party.distanceKm != null && <span> · {party.distanceKm} km</span>}
      </p>
      <dl className="partyCardMeta">
        <div><dt>🕒</dt><dd>{formatStartAt(party.startAt)}</dd></div>
        <div><dt>👥</dt><dd>{party.joinedMembers}/{party.maxMembers}{text.partyMembers}</dd></div>
        <div><dt>{text.partyHost}</dt><dd>{party.hostName}</dd></div>
      </dl>
      <button
        type="button"
        className="partyPrimaryBtn partyJoinBtn"
        disabled={full}
        onClick={() => onJoin(party.id)}
      >
        {full ? text.partyFull : text.partyJoin}
      </button>
    </article>
  );
}

export default function PartyPage({ onMoveHome }) {
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

  const handleCreated = (party) => setParties((prev) => [party, ...prev]);

  const handleJoin = async (id) => {
    const updated = await joinParty(id);
    setParties((prev) => prev.map((p) => (p.id === id ? updated : p)));
  };

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
                <RouteToParty key={r.id} route={r} onCreated={handleCreated} />
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
                <PartyCard key={p.id} party={p} onJoin={handleJoin} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
