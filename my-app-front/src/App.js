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

  const openMap = (e) => { e.preventDefault(); window.open('/map', '_blank', 'noopener,noreferrer'); };
  const moveHome = (e) => { e.preventDefault(); moveTo('/'); };
  const moveSignup = (e) => { e.preventDefault(); moveTo('/signup'); };
  const moveParty = (e) => { e.preventDefault(); moveTo('/party'); };

  if (currentPath === '/map') return <MapPage onBackHome={moveHome} />;
  if (currentPath === '/signup') return <SignupPage onMoveHome={moveHome} />;
  if (currentPath === '/party') return <PartyPage onMoveHome={moveHome} />;
  return <HomePage onOpenMap={openMap} onMoveHome={moveHome} onMoveSignup={moveSignup} onMoveParty={moveParty} />;
}

export default App;
