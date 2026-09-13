import '../styles/crew.css';

import BrandLogo from '../components/BrandLogo';

import { useEffect, useState } from 'react';
import { text, crew as t } from '../constants';
import { getCrews, getCrew, joinCrew, leaveCrew } from '../api/crews';

const letterOf = (name) => (name || '?').trim().charAt(0);

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// 크루 카드 한 장 (크루 찾기 격자)
function CrewCard({ crew, isLoggedIn, onJoin, onOpen, onLoginNeeded }) {
  const joined = crew.myState === 'joined';
  const pending = crew.myState === 'pending';

  return (
    <article className="crewCard">
      <button type="button" className="crewCardCover" onClick={() => onOpen(crew.id)}>
        {crew.coverPhoto
          ? <img src={crew.coverPhoto} alt="" loading="lazy" />
          : <span className="crewCoverEmpty" aria-hidden="true"><BrandLogo className="crewCoverLogo" /></span>}
        {crew.tag && <span className="crewCardTag">{crew.tag}</span>}
      </button>

      <div className="crewCardBody">
        <button type="button" className="crewCardName" onClick={() => onOpen(crew.id)}>{crew.name}</button>

        <dl className="crewCardMeta">
          <div><dt>{t.regionLabel}</dt><dd>{crew.region || '-'}</dd></div>
          <div><dt>{t.scheduleLabel}</dt><dd>{crew.scheduleText || t.noSchedule}</dd></div>
          <div><dt>{t.memberLabel}</dt><dd>{crew.memberCount}{text.partyMembers}</dd></div>
        </dl>

        {joined ? (
          <button type="button" className="crewJoinBtn isJoined" onClick={() => onOpen(crew.id)}>
            ✓ {t.joined}
          </button>
        ) : pending ? (
          <button type="button" className="crewJoinBtn isPending" disabled>{t.pending}</button>
        ) : (
          <button
            type="button"
            className="crewJoinBtn"
            onClick={isLoggedIn ? () => onJoin(crew.id) : onLoginNeeded}
          >
            {isLoggedIn ? t.join : text.partyLoginNeeded}
          </button>
        )}
      </div>
    </article>
  );
}

// 크루 상세 — 채팅 / 멤버 / 관리 3단. 파티 대기방(PartyRoomPanel)과 같은 구성.
function CrewDetail({ crew, user, onBack, onLeave }) {
  const isLeader = crew.leaderId === user?.id;
  const members = crew.members || [];
  const upcoming = crew.upcoming || [];
  const pending = crew.pendingRequests || [];

  return (
    <section className="crewDetail">
      <button type="button" className="crewBack" onClick={onBack}>← {t.backToList}</button>

      <header className="crewDetailHead">
        <span className="crewDetailAvatar" aria-hidden="true">
          {crew.coverPhoto ? <img src={crew.coverPhoto} alt="" /> : <BrandLogo className="crewCoverLogo" />}
        </span>
        <div className="crewDetailText">
          <h1>
            {crew.name}
            {isLeader && <span className="crewRoleTag">{t.leader}</span>}
          </h1>
          <dl className="crewCardMeta isRow">
            <div><dt>{t.regionLabel}</dt><dd>{crew.region || '-'}</dd></div>
            <div><dt>{t.scheduleLabel}</dt><dd>{crew.scheduleText || t.noSchedule}</dd></div>
            <div><dt>{t.memberLabel}</dt><dd>{crew.memberCount}{text.partyMembers}</dd></div>
          </dl>
          {crew.description && <p className="crewDesc">{crew.description}</p>}
        </div>
      </header>

      <div className="crewCols">
        {/* 크루 채팅 — roomType 이 없어 파티 채팅과 방 번호가 겹칠 수 있으므로 아직 연결하지 않는다 */}
        <section className="crewCol crewColChat">
          <h2 className="crewColTitle">{t.chatTitle}</h2>
          <div className="crewChatCard">
            <div className="crewSoon">
              <strong>{t.chatSoonTitle}</strong>
              <p>{t.chatSoonSub}</p>
            </div>
          </div>
        </section>

        <section className="crewCol crewColMembers">
          <h2 className="crewColTitle">{t.memberListTitle} {members.length}{text.partyMembers}</h2>
          <ul className="crewMembers">
            {members.length === 0 && <li className="crewEmptyRow">{t.noMembers}</li>}
            {members.map((m) => (
              <li key={m.userId} className={`crewMember${m.userId === user?.id ? ' isMe' : ''}`}>
                <span className="crewAvatar" aria-hidden="true">{letterOf(m.name)}</span>
                <span className="crewMemberInfo">
                  <span className="crewMemberName">
                    {m.name}
                    {m.role === 'leader' && <span className="crewTag isLeader">{t.leader}</span>}
                    {m.userId === user?.id && <span className="crewTag">{t.me}</span>}
                  </span>
                  <span className={`crewAttend is-${m.attend}`}>
                    {m.attend === 'yes' ? t.attendYes : m.attend === 'no' ? t.attendNo : t.attendUnknown}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="crewCol crewColControl">
          <h2 className="crewColTitle">{isLeader ? t.controlTitle : t.memberPanelTitle}</h2>
          <div className="crewControlCard">
            {isLeader && (
              <button type="button" className="crewPrimaryBtn" disabled title={t.soonHint}>
                + {t.openRide}
                <span className="crewSoonBadge">{t.soon}</span>
              </button>
            )}

            <h3 className="crewSubTitle">{t.upcomingTitle}</h3>
            {upcoming.length === 0 ? (
              <p className="crewEmptyRow">{t.noUpcoming}</p>
            ) : (
              <ul className="crewUpcoming">
                {upcoming.map((u) => (
                  <li key={u.id}>
                    <span className="crewUpcomingInfo">
                      <strong>{u.title}</strong>
                      <span>{formatWhen(u.startAt)} · {u.joined}/{u.maxMembers}{text.partyMembers}</span>
                    </span>
                    <button type="button" className="crewSmallBtn" disabled title={t.soonHint}>
                      {t.attend}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="crewMenu">
              {isLeader && (
                <>
                  <button type="button" className="crewMenuBtn" disabled title={t.soonHint}>
                    {t.settings}<span className="crewSoonBadge">{t.soon}</span>
                  </button>
                  <button type="button" className="crewMenuBtn" disabled title={t.soonHint}>
                    {t.manageRequests}
                    {pending.length > 0 && <span className="crewCountBadge">{pending.length}</span>}
                  </button>
                </>
              )}
              <button type="button" className="crewMenuBtn isDanger" onClick={() => onLeave(crew.id)}>
                {t.leave}
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default function CrewPage({ user, onMoveHome, onMoveLogin, onOpenMap, onMoveBrowse, onMoveParty }) {
  const isLoggedIn = !!user;

  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('find');   // 'find' = 크루 찾기, 'mine' = 내 크루
  const [openId, setOpenId] = useState(null); // 상세로 들어간 크루

  useEffect(() => {
    let alive = true;
    getCrews()
      .then((list) => { if (alive) setCrews(list || []); })
      .catch(() => { if (alive) setError(t.loadFailed); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const myCrews = crews.filter((c) => c.myState === 'joined');
  const shown = view === 'mine' ? myCrews : crews;
  const openCrew = crews.find((c) => c.id === openId) || null;

  const replace = (updated) =>
    setCrews((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

  const handleJoin = async (id) => {
    setError('');
    try {
      replace(await joinCrew(id, user.id));
    } catch {
      setError(t.joinFailed);
    }
  };

  const handleLeave = async (id) => {
    setError('');
    try {
      replace(await leaveCrew(id, user.id));
      setOpenId(null);
    } catch {
      setError(t.leaveFailed);
    }
  };

  // 목록에 상세 정보(멤버)가 없으면 한 건만 더 불러온다
  const openDetail = async (id) => {
    setOpenId(id);
    if (crews.find((c) => c.id === id)?.members?.length) return;
    try {
      const full = await getCrew(id);
      if (full) replace(full);
    } catch { /* 목록 정보만으로도 화면은 뜬다 */ }
  };

  return (
    <div className="crewPage">
      <nav className="navbar crewNav" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>{text.feed}</a>
          <a href="/party" onClick={onMoveParty}>{text.party}</a>
          <a href="/crew" onClick={(e) => e.preventDefault()}>{text.crew}</a>
          <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
        </div>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
      </nav>

      <div className="crewBody">
        {openCrew ? (
          <CrewDetail crew={openCrew} user={user} onBack={() => setOpenId(null)} onLeave={handleLeave} />
        ) : (
          <>
            <nav className="crewTabs" role="tablist" aria-label={t.tabsLabel}>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'find'}
                className={view === 'find' ? 'isActive' : ''}
                onClick={() => setView('find')}
              >
                <span className="crewTabLabel">
                  <strong>{t.findTab}</strong>
                  <span>{t.findTabHint}</span>
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'mine'}
                className={view === 'mine' ? 'isActive' : ''}
                onClick={() => setView('mine')}
              >
                <span className="crewTabLabel">
                  <strong>{t.mineTab}</strong>
                  <span>{myCrews.length > 0 ? `${myCrews.length}${t.crewUnit}` : t.noMyCrew}</span>
                </span>
              </button>

              <button type="button" className="composeBtn crewCreateBtn" disabled title={t.soonHint}>
                {t.createCrew}
              </button>
            </nav>

            {error && <p className="crewError">{error}</p>}

            {loading ? (
              <p className="crewEmpty">{text.browseLoading}</p>
            ) : shown.length === 0 ? (
              <p className="crewEmpty">{view === 'mine' ? t.noMyCrewLong : t.noCrew}</p>
            ) : (
              <div className="crewGrid">
                {shown.map((c) => (
                  <CrewCard
                    key={c.id}
                    crew={c}
                    isLoggedIn={isLoggedIn}
                    onJoin={handleJoin}
                    onOpen={openDetail}
                    onLoginNeeded={onMoveLogin}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
