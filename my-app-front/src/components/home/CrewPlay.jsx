import { useEffect, useState } from 'react';
import BrandLogo from '../BrandLogo';
import { crew as c, homeDraft, text } from '../../constants';
import { useFrameZoom } from '../../hooks/useFrameZoom';
import '../../styles/crew.css';
import './party-play.css';

const t = homeDraft.crewPlay;
const APPROVE_MS = 1400; // 가입 신청이 수락되기까지
const letterOf = (name) => name.charAt(0);

function Meta({ crew, count }) {
  return (
    <dl className="crewCardMeta">
      <div><dt>{c.regionLabel}</dt><dd>{crew.region}</dd></div>
      <div><dt>{c.scheduleLabel}</dt><dd>{crew.schedule}</dd></div>
      <div><dt>{c.memberLabel}</dt><dd>{count}{text.partyMembers}</dd></div>
    </dl>
  );
}

// 크루 탭 화면 체험 — 실제 탭의 마크업·스타일에 예시 데이터를 넣었다. API 를 부르지 않는다.
export default function CrewPlay({ onOpenCrew }) {
  const frame = useFrameZoom();
  const [view, setView] = useState('find'); // 'find' = 크루 찾기, 'mine' = 내 크루
  const [states, setStates] = useState({}); // 크루 id → pending | joined
  const [openId, setOpenId] = useState(null);

  const hasPending = Object.values(states).includes('pending');
  useEffect(() => {
    if (!hasPending) return undefined;
    const id = setTimeout(() => {
      setStates((s) => Object.fromEntries(Object.entries(s).map(([k]) => [k, 'joined'])));
    }, APPROVE_MS);
    return () => clearTimeout(id);
  }, [hasPending]);

  const isJoined = (crew) => states[crew.id] === 'joined';
  const countOf = (crew) => crew.memberCount + (isJoined(crew) ? 1 : 0);
  const mine = t.crews.filter(isJoined);
  const find = t.crews.filter((crew) => !isJoined(crew));
  const shown = view === 'mine' ? mine : find;
  const open = t.crews.find((crew) => crew.id === openId);

  if (open) {
    const members = open.members.map((name, i) => ({ name, leader: i === 0 }));
    return (
      <div className="cpl" ref={frame.ref} style={frame.style}>
        <section className="crewDetail">
          <button type="button" className="crewBack" onClick={() => setOpenId(null)}>← {c.backToList}</button>
          <h3 className="crewCardName">{open.name}</h3>
          <Meta crew={open} count={countOf(open)} />
          <div className="cplCols">
            <section className="crewCol">
              <h4 className="crewColTitle">{c.memberListTitle}</h4>
              <ul className="crewMembers">
                {members.map((m) => (
                  <li key={m.name} className="crewMember">
                    <span className="crewAvatar" aria-hidden="true">{letterOf(m.name)}</span>
                    <span className="crewMemberInfo">
                      <span className="crewMemberName">{m.name}{m.leader && <span className="crewTag isLeader">{c.leader}</span>}</span>
                    </span>
                  </li>
                ))}
                {isJoined(open) && (
                  <li className="crewMember isMe">
                    <span className="crewAvatar" aria-hidden="true">{letterOf(t.me)}</span>
                    <span className="crewMemberInfo">
                      <span className="crewMemberName">{t.me}</span>
                    </span>
                  </li>
                )}
              </ul>
            </section>
            <section className="crewCol">
              <h4 className="crewColTitle">{c.upcomingTitle}</h4>
              <ul className="crewUpcoming">
                {open.upcoming.map((u) => (
                  <li key={u.title}>
                    <span className="crewUpcomingInfo"><strong>{u.title}</strong><span>{u.when}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cpl" ref={frame.ref} style={frame.style}>
      <nav className="crewTabs" role="tablist" aria-label={c.tabsLabel}>
        <button type="button" role="tab" aria-selected={view === 'find'} className={view === 'find' ? 'isActive' : ''} onClick={() => setView('find')}>
          <span className="crewTabLabel"><strong>{c.findTab}</strong><span>{c.findTabHint}</span></span>
        </button>
        <button type="button" role="tab" aria-selected={view === 'mine'} className={view === 'mine' ? 'isActive' : ''} onClick={() => setView('mine')}>
          <span className="crewTabLabel"><strong>{c.mineTab}</strong><span>{mine.length > 0 ? `${mine.length}${c.crewUnit}` : c.noMyCrew}</span></span>
        </button>
        <button type="button" className="composeBtn crewCreateBtn" onClick={onOpenCrew}>{c.createCrew}</button>
      </nav>

      {shown.length === 0 ? (
        <p className="crewEmpty">{view === 'mine' ? c.noMyCrewLong : c.noCrewToFind}</p>
      ) : (
        <div className="crewGrid">
          {shown.map((crew, i) => (
            <article key={crew.id} className="crewCard">
              <button type="button" className="crewCardCover" onClick={() => setOpenId(crew.id)}>
                <span className="crewCoverEmpty" aria-hidden="true"><BrandLogo className="crewCoverLogo" /></span>
                <span className="crewCardTag">{crew.tag}</span>
              </button>
              <div className="crewCardBody">
                <button type="button" className="crewCardName" onClick={() => setOpenId(crew.id)}>{crew.name}</button>
                <Meta crew={crew} count={countOf(crew)} />
                {isJoined(crew) ? (
                  <button type="button" className="crewJoinBtn isJoined" onClick={() => setOpenId(crew.id)}>✓ {c.joined}</button>
                ) : states[crew.id] === 'pending' ? (
                  <button type="button" className="crewJoinBtn isPending" disabled>{c.pending}</button>
                ) : (
                  <button
                    type="button"
                    className={`crewJoinBtn${i === 0 && !hasPending ? ' pplNudge' : ''}`}
                    onClick={() => setStates((s) => ({ ...s, [crew.id]: 'pending' }))}
                  >
                    {c.join}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
