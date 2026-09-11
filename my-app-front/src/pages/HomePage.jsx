import '../styles/home.css';

import { MotionConfig } from 'framer-motion';
import { homeCourse, homeMatch, homeParty, homeBrowse, homeCta, homeFooter } from '../constants';
import HeroSection from '../components/home/HeroSection';
import ShowcaseSection from '../components/home/ShowcaseSection';
import SplitSection from '../components/home/SplitSection';
import ClosingCta from '../components/home/ClosingCta';
import SiteFooter from '../components/home/SiteFooter';
import FeedMarquee from '../components/home/FeedMarquee';

export default function HomePage({ user, onOpenMap, onMoveHome, onMoveSignup, onMoveLogin, onMoveParty, onMoveCrew, onMoveBrowse, onMoveProfile, onMoveSettings, onLogout }) {
  return (
    <div className="app homePage">
      <HeroSection
        user={user}
        onOpenMap={onOpenMap}
        onMoveHome={onMoveHome}
        onMoveSignup={onMoveSignup}
        onMoveLogin={onMoveLogin}
        onMoveParty={onMoveParty}
        onMoveCrew={onMoveCrew}
        onMoveBrowse={onMoveBrowse}
        onMoveProfile={onMoveProfile}
        onMoveSettings={onMoveSettings}
        onLogout={onLogout}
      />
      <MotionConfig reducedMotion="user">
        <main className="homeMain">
          <ShowcaseSection {...homeCourse} />
          <SplitSection {...homeMatch} />
          <ShowcaseSection {...homeParty} />
          <SplitSection {...homeBrowse} reverse media={<FeedMarquee />} />
          <ClosingCta {...homeCta} onOpenMap={onOpenMap} onMoveBrowse={onMoveBrowse} />
          <SiteFooter {...homeFooter} />
        </main>
      </MotionConfig>
    </div>
  );
}
