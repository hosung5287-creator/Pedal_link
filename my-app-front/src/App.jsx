import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import './App.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import PartyDock from './components/PartyDock';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import PartyPage from './pages/PartyPage';
import BrowsePage from './pages/BrowsePage';

// webpack이 Leaflet 마커 아이콘 경로를 잘못 처리하는 문제 수정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  // 쿼리스트링(?partyId=3)도 따로 들고 있어야 한다.
  // currentPath 에 붙여버리면 아래 경로 비교(=== '/map')가 전부 어긋난다.
  const [search, setSearch] = useState(window.location.search);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const moveTo = (path) => {
    window.history.pushState(null, '', path);
    const [onlyPath, query] = path.split('?');
    setCurrentPath(onlyPath);
    setSearch(query ? `?${query}` : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMap = (e) => { e.preventDefault(); moveTo('/map'); };
  const moveHome = (e) => { e.preventDefault(); moveTo('/'); };
  const moveSignup = (e) => { e.preventDefault(); moveTo('/signup'); };
  const moveLogin = (e) => { e.preventDefault(); moveTo('/login'); };
  const moveParty = (e) => { e.preventDefault(); moveTo('/party'); };
  const moveBrowse = (e) => { e.preventDefault(); moveTo('/browse'); };
  const moveProfile = (e) => { e.preventDefault(); moveTo('/profile'); };
  const moveSettings = (e) => { e.preventDefault(); moveTo('/settings'); };
  // 파티에서 "라이딩 시작" → 지도를 파티 모드로 연다
  const movePartyRide = (partyId) => moveTo(`/map?partyId=${partyId}`);

  const handleLogin = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    moveTo('/');
  };
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    moveTo('/');
  };

  // 로그인 상태에서 로그인/회원가입 페이지 접근 시 홈으로
  if (user && (currentPath === '/login' || currentPath === '/signup')) moveTo('/');
  // 비로그인 상태에서 계정 페이지 접근 시 홈으로
  if (!user && (currentPath === '/profile' || currentPath === '/settings')) moveTo('/');

  let page;
  if (currentPath === '/map') {
    const partyId = new URLSearchParams(search).get('partyId');
    page = <MapPage user={user} partyId={partyId} onBackHome={moveHome} onMoveParty={moveParty} onMoveBrowse={moveBrowse} />;
  } else if (currentPath === '/signup') {
    page = <SignupPage onMoveHome={moveHome} onMoveLogin={moveLogin} />;
  } else if (currentPath === '/login') {
    page = <LoginPage onMoveHome={moveHome} onMoveSignup={moveSignup} onLogin={handleLogin} />;
  } else if (currentPath === '/party') {
    page = <PartyPage user={user} onMoveHome={moveHome} onMoveLogin={moveLogin} onStartRide={movePartyRide} onOpenMap={openMap} onMoveBrowse={moveBrowse} onMoveParty={moveParty} />;
  } else if (currentPath === '/browse') {
    page = <BrowsePage user={user} onMoveHome={moveHome} onMoveLogin={moveLogin} onOpenMap={openMap} onMoveParty={moveParty} onMoveBrowse={moveBrowse} />;
  } else if (currentPath === '/profile') {
    page = <ProfilePage user={user} onMoveHome={moveHome} onMoveBrowse={moveBrowse} onMoveParty={moveParty} onOpenMap={openMap} />;
  } else if (currentPath === '/settings') {
    page = <SettingsPage user={user} onMoveHome={moveHome} onMoveBrowse={moveBrowse} onMoveParty={moveParty} onOpenMap={openMap} onLogout={handleLogout} />;
  } else {
    page = (
      <HomePage
        user={user}
        onOpenMap={openMap}
        onMoveHome={moveHome}
        onMoveSignup={moveSignup}
        onMoveLogin={moveLogin}
        onMoveParty={moveParty}
        onMoveBrowse={moveBrowse}
        onMoveProfile={moveProfile}
        onMoveSettings={moveSettings}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <>
      {page}
      {/* 파티 소속/모집중일 때 뜨는 플로팅 도크 (지도 포함 전 화면 우측 하단) */}
      {user && <PartyDock user={user} onMoveParty={moveParty} />}
    </>
  );
}

export default App;
