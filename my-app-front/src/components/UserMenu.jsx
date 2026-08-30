import { useEffect, useRef, useState } from 'react';
import { text } from '../constants';

// 로그인 상태 네비 우측 메뉴 — 아바타 클릭 시 프로필/설정/로그아웃 드롭다운.
// 프로필·설정 페이지는 아직 없어 "준비 중"으로 비활성 표시, 로그아웃만 동작한다.
export default function UserMenu({ user, onLogout, onProfile, onSettings }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const letter = (user.name || '?').trim().charAt(0);

  return (
    <div className="userMenu" ref={ref}>
      <button
        type="button"
        className="userMenuTrigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="userAvatar" aria-hidden="true">{letter}</span>
        <span className="userName">{user.name}님</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="userMenuDropdown" role="menu">
          <div className="userMenuHead">
            <span className="userAvatar" aria-hidden="true">{letter}</span>
            <strong>{user.name}님</strong>
          </div>
          <div className="userMenuDivider" />
          <button type="button" role="menuitem" onClick={(e) => { setOpen(false); onProfile(e); }}>
            {text.menuProfile}
          </button>
          <button type="button" role="menuitem" onClick={(e) => { setOpen(false); onSettings(e); }}>
            {text.menuSettings}
          </button>
          <div className="userMenuDivider" />
          <button type="button" role="menuitem" className="userMenuLogout" onClick={() => { setOpen(false); onLogout(); }}>
            {text.logout}
          </button>
        </div>
      )}
    </div>
  );
}
