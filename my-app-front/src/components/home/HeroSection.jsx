import { useState } from 'react';
import { text } from '../../constants';
import BrandLogo from '../BrandLogo';
import UserMenu from '../UserMenu';

// public/hero.mp4 에 파일을 넣으면 자동으로 적용된다.
// 파일이 없으면 onError 로 <video> 를 제거하고 기존 그라데이션(.heroMotion)이 그대로 폴백된다.
const HERO_VIDEO_SRC = '/hero.mp4';

export default function HeroSection({
  user,
  onOpenMap,
  onMoveHome,
  onMoveSignup,
  onMoveLogin,
  onMoveParty,
  onMoveBrowse,
  onMoveProfile,
  onMoveSettings,
  onLogout,
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  return (
    <section className="hero heroFull">
      <div className="heroMotion" aria-hidden="true" />
      {!videoFailed && (
        <video
          className="heroVideo"
          src={HERO_VIDEO_SRC}
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        />
      )}
      <div className="heroShade" aria-hidden="true" />

      <nav className="navbar" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>{text.browse}</a>
          <a href="/party" onClick={onMoveParty}>{text.party}</a>
          <a href="/">{text.nearby}</a>
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

      <div className="heroContent heroCenter">
        <h1>{text.headline}</h1>
        <form className="searchBar" onSubmit={e => e.preventDefault()}>
          <svg className="searchIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="route-search" name="route-search" type="search" placeholder={text.searchPlaceholder} autoComplete="off" />
          <button type="submit">{text.search}</button>
        </form>
      </div>

      <a className="heroScrollCue" href="#instant" aria-label={text.heroScrollCue}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26" aria-hidden="true">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </a>
    </section>
  );
}
