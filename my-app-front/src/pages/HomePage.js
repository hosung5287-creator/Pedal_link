import '../styles/home.css';

import HeroSection from '../components/home/HeroSection';
import InstantLinkSection from '../components/home/InstantLinkSection';
import PlannedLinkSection from '../components/home/PlannedLinkSection';
import RecentRoutes from '../components/home/RecentRoutes';
import ClosingCta from '../components/home/ClosingCta';

export default function HomePage({ user, onOpenMap, onMoveHome, onMoveSignup, onMoveLogin, onMoveParty, onLogout }) {
  return (
    <div className="app">
      <HeroSection
        user={user}
        onOpenMap={onOpenMap}
        onMoveHome={onMoveHome}
        onMoveSignup={onMoveSignup}
        onMoveLogin={onMoveLogin}
        onMoveParty={onMoveParty}
        onLogout={onLogout}
      />
      <main className="homeMain">
        <InstantLinkSection onMoveParty={onMoveParty} />
        <PlannedLinkSection onMoveParty={onMoveParty} />
        <RecentRoutes />
        <ClosingCta onOpenMap={onOpenMap} onMoveParty={onMoveParty} />
      </main>
    </div>
  );
}
