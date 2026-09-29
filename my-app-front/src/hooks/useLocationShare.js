import { useCallback, useEffect, useState } from 'react';
import { updateLocationSharing } from '../api/auth';
import { getProfile } from '../api/users';

// 위치 공유 on/off 상태를 여러 화면(지도 · 파티 도크 · 설정)이 공유하는 훅.
// 기준은 서버(users.location_share_enabled)이고, localStorage 는 첫 화면을 바로 그리기 위한 사본이다.
// 같은 브라우저에서 계정을 바꿔도 섞이지 않게 사용자별 키에 저장하고,
// 커스텀 이벤트로 컴포넌트 간 실시간 동기화한다.
const EVT = 'pedallink:locshare';
const keyOf = (userId) => `locationShareEnabled:${userId}`;
// 서버에 못 보낸 값이 남아 있다는 표시 — 온라인 복귀나 다음 접속 때 다시 보낸다
const pendingKeyOf = (userId) => `locationShareEnabled:${userId}:pending`;

// 예전(사용자 구분 없는) 키는 더 이상 쓰지 않는다 — 다른 계정 값이 섞이지 않게 지운다
try { localStorage.removeItem('locationShareEnabled'); } catch { /* 무시 */ }

function readLocal(userId) {
  if (!userId) return false;
  try {
    const v = localStorage.getItem(keyOf(userId));
    return v !== null ? JSON.parse(v) : false;
  } catch {
    return false;
  }
}

function writeLocal(userId, val) {
  try { localStorage.setItem(keyOf(userId), JSON.stringify(val)); } catch { /* 무시 */ }
}

function setPending(userId, on) {
  try {
    if (on) localStorage.setItem(pendingKeyOf(userId), '1');
    else localStorage.removeItem(pendingKeyOf(userId));
  } catch { /* 무시 */ }
}

function hasPending(userId) {
  try { return localStorage.getItem(pendingKeyOf(userId)) === '1'; } catch { return false; }
}

function broadcast(userId, val) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { userId, enabled: val } }));
}

async function pushToServer(userId, val) {
  try {
    await updateLocationSharing(userId, val);
    setPending(userId, false);
  } catch {
    setPending(userId, true);
  }
}

// 못 보낸 값을 다시 보낸다 — 훅을 쓰는 컴포넌트가 여러 개여도 한 번만 보내게 막는다
const flushing = new Set();
async function flushPending(userId) {
  if (!hasPending(userId) || flushing.has(userId)) return;
  flushing.add(userId);
  try {
    await pushToServer(userId, readLocal(userId));
  } finally {
    flushing.delete(userId);
  }
}

// 서버 값은 페이지당 한 번만 읽는다 — 지도·도크·설정이 동시에 훅을 써도 요청은 하나.
const synced = new Map();       // userId -> 진행 중/완료된 Promise
const changedAt = new Map();    // userId -> 사용자가 마지막으로 직접 바꾼 시각

function syncFromServer(userId) {
  if (synced.has(userId)) return;
  const startedAt = Date.now();
  const job = (async () => {
    // 오프라인일 때 바꾼 값이 아직 서버에 안 갔으면, 그 선택이 최신이라 서버로 올린다
    if (hasPending(userId)) {
      await flushPending(userId);
      return;
    }
    try {
      const profile = await getProfile(userId);
      // 응답을 기다리는 사이에 사용자가 직접 바꿨으면 그 값이 우선
      if ((changedAt.get(userId) || 0) > startedAt) return;
      const val = !!profile?.locationShareEnabled;
      writeLocal(userId, val);
      broadcast(userId, val);
    } catch {
      synced.delete(userId); // 실패하면 다음에 훅이 다시 붙을 때 재시도
    }
  })();
  synced.set(userId, job);
}

export function useLocationShare(userId) {
  const [enabled, setEnabled] = useState(() => readLocal(userId));

  // 로그인 계정이 정해지면(또는 바뀌면) 그 사람 값으로 맞추고 서버 값을 받아온다
  useEffect(() => {
    setEnabled(readLocal(userId));
    if (!userId) return undefined;
    syncFromServer(userId);
    const onOnline = () => flushPending(userId);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [userId]);

  // 다른 컴포넌트가 값을 바꾸면 이벤트로 받아 내 상태도 맞춘다
  useEffect(() => {
    const onChange = (e) => {
      if (e.detail.userId === userId) setEnabled(e.detail.enabled);
    };
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, [userId]);

  const setShare = useCallback((val) => {
    setEnabled(val);
    if (!userId) return;
    changedAt.set(userId, Date.now());
    writeLocal(userId, val);
    broadcast(userId, val);
    pushToServer(userId, val);
  }, [userId]);

  return [enabled, setShare];
}
