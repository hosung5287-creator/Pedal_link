import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import BrandLogo from '../BrandLogo';
import { homeDraft, text } from '../../constants';
import { useFrameZoom } from '../../hooks/useFrameZoom';
import '../../styles/party.css';
import './party-play.css';

const t = homeDraft.partyPlay;
const STEP_MS = 700; // 카운트다운 한 칸
const RIDE_S = 5; // 라이딩 시간(초)
const APPROVE_MS = 1400; // 내 신청이 수락되기까지

// 지도(map-party.jpg, 1720×900) 위 경로 — 이촌한강공원 한강북자전거길
const ROUTE = [[150, 485], [330, 595], [500, 665], [720, 740], [860, 765], [1000, 775], [1160, 775], [1350, 740], [1500, 680], [1600, 620]];
const toD = (points) => `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`;
const pct = ([x, y]) => ({ left: `${(x / 1720) * 100}%`, top: `${(y / 900) * 100}%` });
const STOPS = [9, 8, 7]; // 라이더마다 멈추는 지점 — 앞사람부터
const waitAt = (i) => [ROUTE[0][0] + i * 70 - 20, ROUTE[0][1] + 70]; // 출발 전 모여 있는 자리

const SEGMENTS = { host: ROUTE, other: ROUTE.slice(2, 7), west: ROUTE.slice(0, 4), east: ROUTE.slice(6) };
const VIEWS = { host: '60 380 1600 500', other: '440 560 800 330', west: '60 420 720 400', east: '1080 520 600 330' };

function CardMedia({ party }) {
  const points = SEGMENTS[party.id];
  return (
    <div className="partyCardMedia">
      <svg className="pplThumb" viewBox={VIEWS[party.id]} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <image href="/images/home/map-party.jpg" width="1720" height="900" />
        <path className="pplRouteCase" d={toD(points)} />
        <path className="pplRouteLine" d={toD(points)} />
      </svg>
      <span className="partyCardMediaTag">{party.routeName}</span>
      <a className="pplCredit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t.creditShort}</a>
    </div>
  );
}

function CardInfo({ party, members, hostSuffix }) {
  return (
    <>
      <p className="partyCardRoute">{party.from} → {party.to}<span> · {party.km} km</span></p>
      <dl className="partyCardMeta">
        <div><dt>{t.scheduleLabel}</dt><dd>{party.when}</dd></div>
        <div><dt>{t.membersLabel}</dt><dd>{text.partyParticipants} {members}/{party.max}{text.partyMembers}</dd></div>
        <div><dt>{text.partyHost}</dt><dd>{party.hostName}{hostSuffix}</dd></div>
      </dl>
    </>
  );
}

// 내 파티 카드에서 라이딩 시작을 누르면 보이는 화면 — 카운트다운 뒤 함께 달린다
function RideStage({ riders, onReset }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(reduced ? 'done' : 'count'); // count → ride → done
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (phase === 'count') {
      if (count >= t.countdown.length) { setPhase('ride'); return undefined; }
      const id = setTimeout(() => setCount((c) => c + 1), STEP_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'ride') {
      const id = setTimeout(() => setPhase('done'), (RIDE_S + (riders.length - 1) * 0.25) * 1000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase, count, riders.length]);

  // 라이더별 경로 키프레임 — 구간 길이에 비례한 시간으로 일정한 속도를 낸다
  const paths = useMemo(() => riders.map((_, i) => {
    const points = [waitAt(i), ...ROUTE.slice(0, STOPS[i] + 1)];
    const lengths = points.slice(1).map((p, k) => Math.hypot(p[0] - points[k][0], p[1] - points[k][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    let sum = 0;
    return {
      start: pct(points[0]),
      left: points.map((p) => pct(p).left),
      top: points.map((p) => pct(p).top),
      times: [0, ...lengths.map((l) => { sum += l; return sum / total; })],
      end: pct(points[points.length - 1]),
    };
  }), [riders]);

  const status = phase === 'count' ? t.ready : phase === 'ride' ? t.riding : t.arrived;

  return (
    <div className="pplStage">
      <div className="pplMap">
        <img src="/images/home/map-party.jpg" alt="" width="1720" height="900" />
        <svg className="pplRoute" viewBox="0 0 1720 900" preserveAspectRatio="none" aria-hidden="true">
          <path className="pplRouteCase" d={toD(ROUTE)} />
          <path className="pplRouteLine" d={toD(ROUTE)} />
        </svg>
        <div className="pplStart" style={pct(ROUTE[0])} aria-hidden="true"><BrandLogo /><span>{t.start}</span></div>

        {riders.map((name, i) => {
          const path = paths[i];
          return (
            <motion.div
              key={name}
              className="pplRider"
              aria-hidden="true"
              style={phase === 'count' ? path.start : undefined}
              initial={false}
              animate={phase === 'ride' ? { left: path.left, top: path.top } : phase === 'done' ? path.end : {}}
              transition={{
                left: { duration: reduced ? 0 : RIDE_S, delay: i * 0.25, ease: 'linear', times: path.times },
                top: { duration: reduced ? 0 : RIDE_S, delay: i * 0.25, ease: 'linear', times: path.times },
              }}
            >
              {name.charAt(0)}
            </motion.div>
          );
        })}

        {phase === 'count' && count < t.countdown.length && (
          <div className="pplCountDim">
            <motion.span
              key={count}
              className={`pplCount${count === t.countdown.length - 1 ? ' isGo' : ''}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            >
              {t.countdown[count]}
            </motion.span>
          </div>
        )}
        <a className="pplCredit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t.credit}</a>
      </div>

      <div className="pplStageFoot" role="status">
        <p>{status}</p>
        {phase === 'done' && <button type="button" className="pplReset" onClick={onReset}>↻ {t.reset}</button>}
      </div>
    </div>
  );
}

// 파티 탭 화면 체험 — 실제 탭의 마크업·스타일에 예시 데이터를 넣었다. API 를 부르지 않는다.
export default function PartyPlay({ onOpenParty }) {
  const frame = useFrameZoom();
  const [view, setView] = useState('list'); // 'list' = 모집 중인 링크, 'room' = 내 파티
  const [approved, setApproved] = useState([]); // 내가 수락한 신청자
  const [rejected, setRejected] = useState([]);
  const [applied, setApplied] = useState({}); // 남의 파티에 낸 내 신청: id → pending | joined
  const [riding, setRiding] = useState(false);

  const host = t.hostParty;
  const stateOf = (p) => applied[p.id] || 'none';
  const joinedOthers = t.others.filter((p) => stateOf(p) === 'joined');
  const waiting = host.requests.filter((n) => !approved.includes(n) && !rejected.includes(n));
  const hostMembers = 1 + approved.length;
  const full = hostMembers >= host.max;
  const roomCount = 1 + joinedOthers.length;
  const hasPending = Object.values(applied).includes('pending');
  const touched = approved.length > 0 || rejected.length > 0 || Object.keys(applied).length > 0;

  useEffect(() => {
    if (!hasPending) return undefined;
    const id = setTimeout(() => {
      setApplied((a) => Object.fromEntries(Object.keys(a).map((k) => [k, 'joined'])));
    }, APPROVE_MS);
    return () => clearTimeout(id);
  }, [hasPending]);

  const reset = () => {
    setView('list');
    setApproved([]);
    setRejected([]);
    setApplied({});
    setRiding(false);
  };

  if (riding) {
    return <div className="ppl" ref={frame.ref} style={frame.style}><RideStage riders={[host.hostName, ...approved]} onReset={reset} /></div>;
  }

  return (
    <div className="ppl" ref={frame.ref} style={frame.style}>
      <nav className="partyViewSwitch" role="tablist" aria-label={text.partyViewSwitch}>
        <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'isActive' : ''} onClick={() => setView('list')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
          </svg>
          <span className="partyViewLabel">
            <strong>{text.partyViewList}</strong>
            <span>{text.partyViewListHint}</span>
          </span>
        </button>
        <button type="button" role="tab" aria-selected={view === 'room'} className={view === 'room' ? 'isActive' : ''} onClick={() => setView('room')}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
          <span className="partyViewLabel">
            <strong>{text.partyViewRoom}</strong>
            <span>{roomCount}{text.partyCountUnit}</span>
          </span>
        </button>
        <button type="button" className="composeBtn partyViewAction" onClick={onOpenParty}>{text.partyMakeButton}</button>
      </nav>

      {touched && <button type="button" className="pplAgain" onClick={reset}>↻ {t.again}</button>}

      {view === 'list' ? (
        <section className="partySection">
          <div className="partyGrid">
            <article className={`partyCard isMine${full ? ' isFull' : ''}`}>
              <CardMedia party={host} />
              <div className="partyCardHead">
                <h3>{host.title}</h3>
                <span className="partyHeadRight"><span className="partyHostTag">{text.partyHostBadge}</span></span>
              </div>
              <CardInfo party={host} members={hostMembers} />
              {full && <button type="button" className="partyRideBtn" onClick={() => setRiding(true)}>{text.partyStartRide}</button>}
              {!full && (
              <div className="partyPending">
                <h4>{text.partyPendingTitle} ({waiting.length})</h4>
                {waiting.length === 0 ? (
                  <p className="partyPendingEmpty">{text.partyNoPending}</p>
                ) : (
                  <ul>
                    {waiting.map((name, i) => (
                      <li key={name}>
                        <span>{name}</span>
                        <span className="partyPendingActions">
                          <button type="button" className={`partyApproveBtn${i === 0 ? ' pplNudge' : ''}`} onClick={() => setApproved((a) => [...a, name])}>{text.partyApprove}</button>
                          <button type="button" className="partyRejectBtn" onClick={() => setRejected((r) => [...r, name])}>{text.partyReject}</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              )}
            </article>

            {t.others.map((p) => (
              <article key={p.id} className="partyCard">
                <CardMedia party={p} />
                <div className="partyCardHead">
                  <h3>{p.title}</h3>
                </div>
                <CardInfo
                  party={p}
                  members={p.members + (stateOf(p) === 'joined' ? 1 : 0)}
                  hostSuffix={stateOf(p) === 'none' ? ` · ${text.partyHostDist(p.hostM)}` : ''}
                />
                {stateOf(p) === 'none' && <button type="button" className="partyPrimaryBtn partyJoinBtn" onClick={() => setApplied((a) => ({ ...a, [p.id]: 'pending' }))}>{text.partyApply}</button>}
                {stateOf(p) === 'pending' && <button type="button" className="partyPrimaryBtn partyJoinBtn" disabled>{text.partyPending}</button>}
                {stateOf(p) === 'joined' && <button type="button" className="partyPrimaryBtn partyJoinBtn" disabled>✓ {text.partyJoined}</button>}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="partyRoomSection">
          <div className="partyGrid">
            {[host, ...joinedOthers].map((p) => (
              <article key={p.id} className="partyCard">
                <CardMedia party={p} />
                <div className="partyCardHead"><h3>{p.title}</h3></div>
                <CardInfo party={p} members={p.id === 'host' ? hostMembers : p.members + 1} />
                <button type="button" className="partyPrimaryBtn" onClick={onOpenParty}>{text.partyOpenRoom}</button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
