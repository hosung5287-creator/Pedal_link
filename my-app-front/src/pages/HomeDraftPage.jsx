import '../styles/home.css';
import '../styles/home-draft.css';

import { MotionConfig } from 'framer-motion';
import { text, homeDraft as d, homeFooter, homeCourse, homeMatch, homeBrowse } from '../constants';
import BrandLogo from '../components/BrandLogo';
import UserMenu from '../components/UserMenu';
import ShowcaseSection from '../components/home/ShowcaseSection';
import SplitSection from '../components/home/SplitSection';
import MatchLiveDemo from '../components/home/MatchLiveDemo';
import TogetherSection from '../components/home/TogetherSection';
import FeedMarquee from '../components/home/FeedMarquee';
import SectionVideo from '../components/home/SectionVideo';
import SiteFooter from '../components/home/SiteFooter';

// 메인 홈 (/) — Meta Muse 페이지의 섹션 '구조'만 참고한 뼈대.
// 문구·영상·이미지는 전부 자리표시(.hdSlot)라 나중에 교체한다. 이전 홈은 /home-old 에서 볼 수 있다.

// 영상·이미지가 들어갈 자리
function Slot({ label, className = '' }) {
  return <div className={`hdSlot ${className}`} aria-hidden="true"><span>{label}</span></div>;
}

function SectionHead({ eyebrow, title, sub, cta, onCta }) {
  return (
    <div className="hdHead">
      <div>
        {eyebrow && <span className="hdEyebrow">{eyebrow}</span>}
        {title && <h2>{title}</h2>}
        {sub && <p>{sub}</p>}
      </div>
      {cta && <button type="button" className="hdCta" onClick={onCta}>{cta}</button>}
    </div>
  );
}

export default function HomeDraftPage({
  user, onMoveHome, onMoveParty, onOpenMap, onMoveBrowse, onMoveCrew,
  onMoveLogin, onMoveSignup, onMoveProfile, onMoveSettings, onLogout,
}) {
  return (
    <div className="app homePage homeDraft">
      {/* 1. 히어로 — 풀스크린 영상 + 짧은 제목 + 버튼 2개 */}
      <section className="hdHero">
        <Slot className="hdHeroMedia" label={d.hero.mediaLabel} />
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
          {/* 2. 주요 기능 — 이전 홈의 코스·매칭·파티 시연 (코드로 움직이는 화면) */}
          <ShowcaseSection {...homeCourse} onCta={onOpenMap} />
          <SplitSection {...homeMatch} media={<MatchLiveDemo />} />
          <TogetherSection />

          {/* 6. 둘러보기 — 이전 홈의 흐르는 피드 (아래에서 위로 자동으로 올라감) */}
          <SplitSection {...homeBrowse} reverse media={<FeedMarquee />} />

          {/* 7. 플로팅 버튼 — 시연 영상 */}
          <section className="hdSection">
            <div className="hdInner">
              <SectionHead eyebrow={d.dock.eyebrow} title={d.dock.title} sub={d.dock.sub} cta={d.dock.cta} onCta={onMoveParty} />
              <SectionVideo {...d.dock.video} />
            </div>
          </section>

          <SiteFooter {...homeFooter} />
        </main>
      </MotionConfig>
    </div>
  );
}
