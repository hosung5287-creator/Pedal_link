import { useMemo } from 'react';
import { text, routes } from '../constants';

function RecentRoutes({ routeLoop }) {
  return (
    <section className="recentRoutes" aria-labelledby="recent-title">
      <div className="sectionHeader">
        <h2 id="recent-title">{text.recentTitle}</h2>
      </div>
      <div className="routeCarousel" aria-label={text.recentAria}>
        <div className="routeTrack">
          {routeLoop.map((route, index) => (
            <article className="routeCard" key={`${route.title}-${index}`}>
              <img src={route.image} alt="" loading="lazy" decoding="async" />
              <div className="routeBody">
                <span>{route.type}</span>
                <h3>{route.title}</h3>
                <p>{route.location}</p>
                <dl>
                  <div><dt>{text.distance}</dt><dd>{route.distance}</dd></div>
                  <div><dt>{text.climb}</dt><dd>{route.climb}</dd></div>
                  <div><dt>{text.time}</dt><dd>{route.time}</dd></div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage({ user, onOpenMap, onMoveHome, onMoveSignup, onMoveLogin, onMoveParty, onLogout }) {
  const routeLoop = useMemo(() => [...routes, ...routes], []);

  return (
    <div className="app">
      <section className="hero">
        <div className="heroMotion" aria-hidden="true" />
        <div className="heroShade" aria-hidden="true" />
        <nav className="navbar" aria-label={text.nav}>
          <a className="brand" href="/" onClick={onMoveHome}>PedalLink</a>
          <div className="navLinks">
            <a href="/">{text.browse}</a>
            <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
            <a href="/">{text.nearby}</a>
            <a href="/party" onClick={onMoveParty}>{text.party}</a>
          </div>
          <div className="navActions">
            {user ? (
              <>
                <span className="signupLink">{user.name}님</span>
                <button className="signupLink" type="button" onClick={onLogout}>로그아웃</button>
              </>
            ) : (
              <>
                <a className="signupLink" href="/login" onClick={onMoveLogin}>{text.login}</a>
                <a className="signupLink" href="/signup" onClick={onMoveSignup}>{text.signup}</a>
              </>
            )}
            <button className="appButton" type="button" onClick={onOpenMap}>{text.mapButton}</button>
          </div>
        </nav>
        <div className="heroContent">
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
      </section>
      <main>
        <RecentRoutes routeLoop={routeLoop} />
      </main>
    </div>
  );
}
