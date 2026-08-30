import '../styles/account.css';

import BrandLogo from '../components/BrandLogo';
import { text, account } from '../constants';

// 프로필 페이지 (뼈대) — 로그인 사용자 정보 + "내 활동" 자리표시.
export default function ProfilePage({ user, onMoveHome, onMoveBrowse, onMoveParty, onOpenMap }) {
  const letter = (user?.name || '?').trim().charAt(0);

  return (
    <div className="accountPage">
      <nav className="navbar accountNav" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>{text.browse}</a>
          <a href="/party" onClick={onMoveParty}>{text.party}</a>
          <a href="/">{text.nearby}</a>
          <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
        </div>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
      </nav>

      <main className="accountMain">
        <header className="accountHead">
          <span className="accountAvatar" aria-hidden="true">{letter}</span>
          <div>
            <h1>{user?.name}님</h1>
            <p>{user?.email || account.memberFallback}</p>
          </div>
        </header>

        <section className="accountCard">
          <h2>{account.profileActivityTitle}</h2>
          <ul className="accountList">
            {account.profileActivity.map((label) => (
              <li key={label}>{label}<span className="accountSoon">{account.soon}</span></li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
