// 시연 모드 — 실제 GPS 대신 서버가 움직여 주는 가상 위치(/api/demo/position)를 쓴다.
// 자전거를 타지 않고도 지도·라이딩 화면이 실제처럼 움직이게 하려는 것이라, 시연 대상이 아니면 진짜 GPS 를 그대로 넘긴다.
//  - 누가 쓰는지는 서버가 정한다(/api/demo/status): 발표자(.env DEMO_PRESENTER_EMAILS)와 가상 라이더(@pedallink.demo).
//    서버 시연 모드가 꺼져 있으면(배포 서버) 모두 진짜 GPS.
//  - 계정은 이 탭에 로그인한 사용자 기준이다(App 이 setDemoUser 로 알려 준다) — 같은 브라우저 다른 탭의 로그인과 섞이지 않게.
//  - 발표자는 가상 위치가 아직 없으면(시연 준비 전) 진짜 GPS 를 쓰고, 가상 라이더는 진짜 GPS 로 돌아가지 않는다.
import { getDemoStatus, getDemoPosition } from '../api/demo';

const POLL_MS = 1000;
const IDLE_POLL_MS = 5000; // 가상 위치가 없을 때는 천천히 다시 물어본다
const RETRY_MS = 5000;     // 서버에 닿지 않으면(켜지는 중) 잠시 뒤 역할을 다시 묻는다
const ID_BASE = 1_000_000; // 진짜 watchPosition id 와 겹치지 않게

function storedUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

const toPosition = (fix, timestamp) => ({
  coords: {
    latitude: fix.lat,
    longitude: fix.lng,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: fix.heading,
    speed: null,
  },
  timestamp,
});

function safeCall(fn, arg) {
  try { fn?.(arg); } catch (e) { console.error(e); }
}

let installed = false;
let tabUser = null;
let onUserChange = null;
let refreshNow = null;

// 이 탭에 로그인한 사용자 — App 이 로그인·로그아웃 때마다 알려 준다
export function setDemoUser(user) {
  const before = tabUser?.id ?? null;
  tabUser = user || null;
  if ((tabUser?.id ?? null) !== before) onUserChange?.();
}

// 시연 준비 직후처럼 가상 위치가 막 생겼을 때 다음 차례를 기다리지 않고 바로 받아 온다
export function refreshDemoGeo() {
  refreshNow?.();
}

// 화면이 위치를 읽기 전에(index.jsx) 한 번 설치한다
export function installDemoGeo() {
  if (installed || typeof navigator === 'undefined' || !navigator.geolocation) return;
  installed = true;
  tabUser = storedUser();

  const real = navigator.geolocation;
  const watchers = new Map(); // id -> { success, error, options, realId } — 진짜 GPS 를 쓸 때도 여기서 관리한다
  let nextId = ID_BASE;
  let role = 'unknown';       // 'unknown'(묻는 중) | 'presenter' | 'rider' | 'none'(진짜 GPS)
  let roleSeq = 0;
  let roleTimer = null;
  let timer = null;
  let inFlight = false;
  let again = false;          // 물어보는 중에 "바로 다시" 요청이 왔다
  let lastFix = null;         // 마지막으로 받은 가상 위치
  let lastTs = 0;             // 마지막으로 화면에 넘긴 측정 시각

  const usesDemo = () => role === 'presenter' || role === 'rider';
  const toReal = (w) => { if (w.realId == null) w.realId = real.watchPosition(w.success, w.error, w.options); };
  const stopReal = (w) => { if (w.realId != null) { real.clearWatch(w.realId); w.realId = null; } };

  // 가상 위치를 받았다 — 진짜 GPS 구독은 끄고, 새 위치면 모두에게 알린다
  const useDemo = (fix) => {
    watchers.forEach(stopReal);
    if (lastFix && fix.t === lastFix.t && fix.jumps === lastFix.jumps) return;
    // 순간 이동(도착 지점으로 등)은 측정 간격을 1ms 로 넘겨 라이딩 화면이 거리·속도로 세지 않게 한다
    const jumped = lastFix && fix.jumps !== lastFix.jumps;
    lastTs = jumped ? lastTs + 1 : fix.t;
    lastFix = fix;
    const pos = toPosition(fix, lastTs);
    for (const w of [...watchers.values()]) safeCall(w.success, pos);
  };

  // 가상 위치가 아직 없다 — 발표자는 진짜 GPS 로, 가상 라이더는 그대로 기다린다 (그 기기의 실제 위치가 섞이지 않게)
  const noDemoYet = () => {
    lastFix = null;
    if (role === 'presenter') watchers.forEach(toReal);
  };

  const poll = async () => {
    clearTimeout(timer);
    timer = null;
    if (!watchers.size || !usesDemo()) return;
    const userId = tabUser?.id;
    inFlight = true;
    let fix = null;
    let failed = null;
    try {
      fix = await getDemoPosition(userId);
    } catch (e) {
      failed = e;
    }
    inFlight = false;
    if (!watchers.size || !usesDemo() || tabUser?.id !== userId) return;
    if (failed?.status === 404) { setRole('none'); return; } // 서버 시연 모드가 꺼졌다
    if (fix) useDemo(fix);
    else if (!failed) noDemoYet(); // 네트워크 오류는 판단을 미룬다 — 가상 위치를 쓰던 중이면 그대로
    timer = setTimeout(poll, again ? 0 : fix ? POLL_MS : IDLE_POLL_MS);
    again = false;
  };

  // 기다리지 않고 바로 다시 물어본다 — 새 구독이 생겼거나 시연을 막 준비했을 때
  const pollNow = () => {
    if (inFlight) { again = true; return; }
    poll();
  };
  refreshNow = pollNow;

  function setRole(next) {
    role = next;
    if (usesDemo()) { pollNow(); return; }
    clearTimeout(timer);
    timer = null;
    lastFix = null;
    watchers.forEach(toReal);
  }

  // 이 탭 계정의 시연 역할을 서버에 묻는다
  const checkRole = async () => {
    clearTimeout(roleTimer);
    const seq = ++roleSeq;
    const user = tabUser;
    if (!user?.id) { setRole('none'); return; }
    try {
      const s = await getDemoStatus(user.id);
      if (seq !== roleSeq) return;
      setRole(s?.enabled && (s.role === 'presenter' || s.role === 'rider') ? s.role : 'none');
    } catch (e) {
      if (seq !== roleSeq) return;
      // 서버에 닿지 않으면 진짜 GPS 로 두고 잠시 뒤 다시 묻는다 (404 는 시연 기능이 없는 예전 서버)
      setRole('none');
      if (e?.status !== 404) roleTimer = setTimeout(checkRole, RETRY_MS);
    }
  };

  onUserChange = () => {
    role = 'unknown';
    clearTimeout(timer);
    timer = null;
    lastFix = null;
    checkRole();
  };

  const demoGeolocation = {
    watchPosition(success, error, options) {
      const id = nextId++;
      const w = { success, error, options, realId: null };
      watchers.set(id, w);
      if (role === 'none') {
        toReal(w);
      } else if (usesDemo()) {
        if (lastFix) {
          // 이미 받은 위치가 있으면 바로 한 번 — 진짜 GPS 도 구독하자마자 현재 위치를 준다
          const pos = toPosition(lastFix, lastTs);
          setTimeout(() => { if (watchers.has(id)) safeCall(success, pos); }, 0);
        }
        pollNow();
      }
      // 'unknown' 이면 역할을 확인하는 대로 정해진다
      return id;
    },
    clearWatch(id) {
      const w = watchers.get(id);
      if (!w) { real.clearWatch(id); return; }
      stopReal(w);
      watchers.delete(id);
      if (!watchers.size) {
        clearTimeout(timer);
        timer = null;
        lastFix = null; // 다시 구독할 때 오래된 위치에서 시작하지 않게
      }
    },
    getCurrentPosition(success, error, options) {
      const userId = tabUser?.id;
      if (!usesDemo() || !userId) { real.getCurrentPosition(success, error, options); return; }
      const fallback = () => {
        if (role === 'rider') safeCall(error, { code: 2, message: '시연 위치를 아직 받지 못했어요.' });
        else real.getCurrentPosition(success, error, options);
      };
      getDemoPosition(userId)
        .then((fix) => (fix ? safeCall(success, toPosition(fix, fix.t)) : fallback()))
        .catch(fallback);
    },
  };

  // 바꿔 끼우지 못하는 브라우저면 시연 모드만 안 될 뿐 앱은 평소대로 돈다
  try {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: demoGeolocation });
  } catch (e) {
    console.warn('시연 모드 가상 위치를 쓸 수 없어요:', e);
    return;
  }
  checkRole();
}
