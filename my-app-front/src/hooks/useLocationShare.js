import { useCallback, useEffect, useState } from 'react';
import { updateLocationSharing } from '../api/auth';

// 위치 공유 on/off 상태를 여러 화면(지도 · 파티 도크)이 공유하는 훅.
// localStorage 로 값을 보존하고, 커스텀 이벤트로 컴포넌트 간 실시간 동기화하며,
// userId 가 있으면 서버에도 반영한다.
const KEY = 'locationShareEnabled';
const EVT = 'pedallink:locshare';

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v !== null ? JSON.parse(v) : false;
  } catch {
    return false;
  }
}

export function useLocationShare(userId) {
  const [enabled, setEnabled] = useState(read);

  // 다른 컴포넌트가 값을 바꾸면 이벤트로 받아 내 상태도 맞춘다
  useEffect(() => {
    const onChange = (e) => setEnabled(e.detail);
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const setShare = useCallback((val) => {
    setEnabled(val);
    try { localStorage.setItem(KEY, JSON.stringify(val)); } catch { /* 무시 */ }
    window.dispatchEvent(new CustomEvent(EVT, { detail: val }));
    if (userId) updateLocationSharing(userId, val).catch(() => {});
  }, [userId]);

  return [enabled, setShare];
}
