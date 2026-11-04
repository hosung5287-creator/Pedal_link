import '../styles/home.css';
import '../styles/home-draft.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { text, homeDraft as d, homeFooter, homeCourse } from '../constants';
import BrandLogo from '../components/BrandLogo';
import UserMenu from '../components/UserMenu';
import MatchLiveDemo from '../components/home/MatchLiveDemo';
import FeedMarquee from '../components/home/FeedMarquee';
import SectionVideo from '../components/home/SectionVideo';
import RideReportDemo from '../components/home/RideReportDemo';
import PartyPlay from '../components/home/PartyPlay';
import CrewPlay from '../components/home/CrewPlay';
import SiteFooter from '../components/home/SiteFooter';
import HeroVideo from '../components/home/HeroVideo';
import StartCards from '../components/home/StartCards';
import FeatureSplit from '../components/home/FeatureSplit';
import SectionMenu from '../components/home/SectionMenu';
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import '../styles/home-ltx.css';

// 메인 홈 (/) — 히어로 아래 모든 섹션이 같은 틀(FeatureSplit). 틀·연출은 LTX 모델 페이지를 참고했고, 색은 PedalLink 그대로다.
// 스타일은 home-ltx.css. 이전 홈은 /home-old 에서 볼 수 있다.

export default function HomeDraftPage({
  user, onMoveHome, onMoveParty, onOpenMap, onMoveBrowse, onMoveCrew,
  onMoveLogin, onMoveSignup, onMoveProfile, onMoveSettings, onLogout,
}) {
  const hero = useRef(null);
  const feedMark = useRef(null);
  const courseMark = useRef(null);
  const partyMark = useRef(null);
  const crewMark = useRef(null);
  const matchMark = useRef(null);
  const reportMark = useRef(null);
  const marks = useMemo(() => ({ feed: feedMark, course: courseMark, party: partyMark, crew: crewMark, match: matchMark, report: reportMark }), []);
  const [solid, setSolid] = useState(false);
  const s = d.sections;
  const go = { map: onOpenMap, party: onMoveParty, crew: onMoveCrew, browse: onMoveBrowse, profile: user ? onMoveProfile : onMoveLogin };
  const onAction = (to) => go[to];
  useSmoothScroll();

  // 히어로를 지나면 네비를 밝은 반투명 판으로 (영상 위에선 투명·흰 글씨)
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > (hero.current?.offsetHeight ?? 0) - 90);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="app homePage homeDraft">
      {/* 스크롤해도 따라오는 네비 — 위치는 이전 홈과 같다 */}
      <header className={`hdTopbar${solid ? ' isSolid' : ''}`}>
        {/* 이전 홈과 같은 네비 — 링크는 화면 정중앙, 오른쪽에 로그인·지도 버튼 (전 탭 네비 위치 통일) */}
        <nav className="navbar" aria-label={text.nav}>
          <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
          <div className="navLinks">
            <a href="/browse" onClick={onMoveBrowse}>{text.feed}</a>
            <a href="/party" onClick={onMoveParty}>{text.party}</a>
            <a href="/crew" onClick={onMoveCrew}>{text.crew}</a>
            <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
          </div>
          <div className="navActions">
            {user ? (
              <UserMenu user={user} onLogout={onLogout} onProfile={onMoveProfile} onSettings={onMoveSettings} />
            ) : (
              <>
                <a className="signupLink" href="/login" onClick={onMoveLogin}>{text.login}</a>
                <a className="signupLink" href="/signup" onClick={onMoveSignup}>{text.signup}</a>
              </>
            )}
            <button className="appButton" type="button" onClick={onOpenMap}>{text.mapButton}</button>
          </div>
        </nav>
      </header>

      {/* 1. 히어로 — 풀스크린 영상 + 짧은 제목 + 버튼 2개 */}
      <section className="hdHero" ref={hero}>
        <HeroVideo {...d.hero.video} />
        <div className="hdHeroText">
          <span className="hdEyebrow">{d.hero.eyebrow}</span>
          <h1>{d.hero.title}</h1>
          <div className="hdHeroBtns">
            <button type="button" className="hdCta" onClick={onMoveParty}>{d.hero.primary}</button>
            <button type="button" className="hdCta isGhost" onClick={onOpenMap}>{d.hero.secondary}</button>
          </div>
        </div>
      </section>

      <MotionConfig reducedMotion="user">
        <main>
          <div className="lxContent">
            {/* 2. 소개 — PedalLink + 섹션 메뉴. 메뉴는 아래 네 섹션을 따라온다 */}
            <section className="lxIntro" aria-label={d.intro.title}>
              <h2>{d.intro.title}</h2>
              <p>{d.intro.sub}</p>
            </section>

            <div className="lxGroup">
              <SectionMenu label={d.intro.menuLabel} items={d.intro.menu} marks={marks} />

              <span ref={feedMark} className="lxMark" aria-hidden="true" />
              <FeatureSplit {...s.feed} onAction={onAction} coverRef={partyMark} media={<div className="fsFrame isTall"><FeedMarquee /></div>} />

              <span ref={partyMark} className="lxMark" aria-hidden="true" />
              <FeatureSplit {...s.party} tone="wash" onAction={onAction} coverRef={crewMark} media={<div className="fsFrame isPlay"><PartyPlay onOpenParty={onMoveParty} /></div>} />

              <span ref={crewMark} className="lxMark" aria-hidden="true" />
              <FeatureSplit {...s.crew} onAction={onAction} coverRef={courseMark} media={<div className="fsFrame isPlay"><CrewPlay onOpenCrew={onMoveCrew} /></div>} />

              <span ref={courseMark} className="lxMark" aria-hidden="true" />
              <FeatureSplit {...s.course} id="instant" tone="wash" onAction={onAction} coverRef={matchMark} media={<SectionVideo {...homeCourse.video} />} />

              <span ref={matchMark} className="lxMark" aria-hidden="true" />
              <FeatureSplit {...s.match} onAction={onAction} coverRef={reportMark} media={<div className="fsFrame isTall"><MatchLiveDemo /></div>} />

              <span ref={reportMark} className="lxMark" aria-hidden="true" />
              <FeatureSplit {...s.report} tone="wash" onAction={onAction} media={<div className="fsFrame isReport isPlay"><RideReportDemo /></div>} />
            </div>

            <FeatureSplit {...s.start} onAction={onAction} media={<div className="fsFrame isCards"><StartCards {...d.start} onCourse={onOpenMap} onParty={onMoveParty} onFeed={onMoveBrowse} /></div>} />
          </div>

          {/* 본문이 위로 올라가면서 뒤에 깔린 푸터가 드러난다 */}
          <SiteFooter {...homeFooter} />
        </main>
      </MotionConfig>
    </div>
  );
}
