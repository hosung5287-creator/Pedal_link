import '../styles/account.css';

import BrandLogo from '../components/BrandLogo';
import { text, account } from '../constants';

// 설정 페이지 (뼈대) — 설정 항목 자리표시 + 로그아웃.
export default function SettingsPage({ user, onMoveHome, onMoveBrowse, onMoveParty, onOpenMap, onLogout }) {
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
          <div>
            <h1>{text.menuSettings}</h1>
            <p>{user?.name}님 계정</p>
          </div>
        </header>

        <section className="accountCard">
          <h2>{account.settingsAccountTitle}</h2>
          <ul className="accountList">
            {account.settingsRows.map((label) => (
              <li key={label}>{label}<span className="accountSoon">{account.soon}</span></li>
            ))}
          </ul>
        </section>

        <button type="button" className="accountLogout" onClick={onLogout}>{text.logout}</button>
      </main>
    </div>
  );
}
