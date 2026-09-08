import '../styles/mobilenav.css';

import { useEffect, useState } from 'react';
import { text } from '../constants';

// 모바일 전용 햄버거 내비게이션.
// 페이지마다 있는 .navbar 의 .navLinks 는 767px 이하에서 숨겨지는데(App.css),
// 그 자리를 대신한다. 페이지 9곳을 각각 고치는 대신 App 에서 한 번만 띄운다.
export default function MobileNav({ currentPath, user, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);

  // 메뉴가 열려 있는 동안 뒤 화면이 따라 스크롤되지 않게 막는다
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // 뒤로가기 등으로 화면이 바뀌면 열린 메뉴는 닫는다
  useEffect(() => { setOpen(false); }, [currentPath]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const items = [
    { path: '/browse', label: text.browse, icon: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' },
    { path: '/party', label: text.party, icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { path: '/map', label: text.makeCourse, icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14' },
  ];
  if (user) {
    items.push({ path: '/profile', label: text.menuProfile, icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8' });
    items.push({ path: '/settings', label: text.menuSettings, icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' });
  }

  const go = (path) => { setOpen(false); onNavigate(path); };

  return (
    <>
      <button
        type="button"
        className="mnavBtn"
        onClick={() => setOpen(true)}
        aria-label={text.nav}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <div className="mnavBackdrop" onClick={() => setOpen(false)}>
          <nav className="mnavSheet" onClick={(e) => e.stopPropagation()} aria-label={text.nav}>
            <header className="mnavHead">
              <span className="mnavTitle">{user ? user.name : 'PedalLink'}</span>
              <button type="button" className="mnavClose" onClick={() => setOpen(false)} aria-label="닫기">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <ul className="mnavList">
              <li>
                <button type="button" className={`mnavItem${currentPath === '/' ? ' isActive' : ''}`} onClick={() => go('/')}>
                  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
                  </svg>
                  {text.backHome}
                </button>
              </li>
              {items.map((it) => (
                <li key={it.path}>
                  <button
                    type="button"
                    className={`mnavItem${currentPath === it.path ? ' isActive' : ''}`}
                    onClick={() => go(it.path)}
                  >
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={it.icon} />
                    </svg>
                    {it.label}
                  </button>
                </li>
              ))}
            </ul>

            {/* 모바일에서는 네비 우측의 홈으로/유저메뉴를 숨기므로(App.css) 여기서 대신 제공한다 */}
            <div className="mnavAuth">
              {user ? (
                <button type="button" className="mnavGhost" onClick={() => { setOpen(false); onLogout?.(); }}>
                  {text.logout}
                </button>
              ) : (
                <>
                  <button type="button" className="mnavGhost" onClick={() => go('/login')}>{text.login}</button>
                  <button type="button" className="mnavSolid" onClick={() => go('/signup')}>{text.signup}</button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
