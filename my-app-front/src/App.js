import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import './App.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import PartyPage from './pages/PartyPage';

// webpack이 Leaflet 마커 아이콘 경로를 잘못 처리하는 문제 수정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const moveTo = (path) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMap = (e) => { e.preventDefault(); moveTo('/map'); };
  const moveHome = (e) => { e.preventDefault(); moveTo('/'); };
  const moveSignup = (e) => { e.preventDefault(); moveTo('/signup'); };
  const moveLogin = (e) => { e.preventDefault(); moveTo('/login'); };
  const moveParty = (e) => { e.preventDefault(); moveTo('/party'); };

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

  if (currentPath === '/map') return <MapPage user={user} onBackHome={moveHome} />;
  if (currentPath === '/signup') return <SignupPage onMoveHome={moveHome} onMoveLogin={moveLogin} />;
  if (currentPath === '/login') return <LoginPage onMoveHome={moveHome} onMoveSignup={moveSignup} onLogin={handleLogin} />;
  if (currentPath === '/party') return <PartyPage user={user} onMoveHome={moveHome} onMoveLogin={moveLogin} />;
  return (
    <HomePage
      user={user}
      onOpenMap={openMap}
      onMoveHome={moveHome}
      onMoveSignup={moveSignup}
      onMoveLogin={moveLogin}
      onMoveParty={moveParty}
      onLogout={handleLogout}
    />
  );
}

export default App;
