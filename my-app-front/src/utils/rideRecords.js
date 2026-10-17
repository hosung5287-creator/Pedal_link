// 라이딩 기록을 잃어버리지 않게 하는 저장 도우미.
//
// 1) 보류 큐 — 기록 저장이 네트워크 오류·5xx 로 실패하면 localStorage 에 넣어두고
//    다음 접속(PartyDock 마운트·폴링) 때 다시 보낸다.
//    ※ 백엔드에 멱등키가 없어서, 서버가 저장한 뒤 응답만 유실된 경우 재전송이
//      같은 기록을 한 번 더 만들 수 있다(백엔드 보고 사항).
// 2) 파티 라이딩 세션 — 라이딩 방을 닫았다 열어도 누적 거리가 이어지고,
//    방이 닫힌 사이 방장이 종료해도 PartyDock 이 대신 기록을 확정할 수 있게
//    거리와 확정 상태(active → finalizing → done)를 localStorage 에 둔다.
import { saveRideRecord } from '../api/rides';

const QUEUE_KEY = 'pl:pendingRides';
const SESSION_PREFIX = 'pl:ride:';
const STALE_FINALIZING_MS = 2 * 60 * 1000;
const DONE_TTL_MS = 24 * 60 * 60 * 1000;

// 이 페이지 로드를 구분하는 id — 새로고침으로 중단된 "확정 중" 세션을 알아보는 데 쓴다
export const PAGE_LOAD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const newQid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// 재시도할 가치가 있는 실패인지 — 네트워크 오류(status 없음)·5xx 만 다시 보낸다.
// 4xx 는 다시 보내도 같은 결과라 큐에 넣지 않는다.
const isRetryable = (err) => err?.status === undefined || err.status >= 500;

// ── 보류 큐 ─────────────────────────────────────────

export const readPendingRides = () => readJson(QUEUE_KEY, []);

function enqueue(record) {
  const queue = readPendingRides();
  return writeJson(QUEUE_KEY, [...queue, { qid: newQid(), record, queuedAt: Date.now() }]);
}

// 결과 kind: saved(저장됨) / queued(실패, 큐 보존 → 자동 재시도)
//           rejected(4xx, 재시도 무의미) / lost(실패 + 큐 보존도 실패)
export async function submitRideRecord(record, { save = saveRideRecord } = {}) {
  try {
    await save(record);
    return { ok: true, kind: 'saved' };
  } catch (err) {
    const status = err?.status;
    if (!isRetryable(err)) return { ok: false, kind: 'rejected', status };
    return enqueue(record)
      ? { ok: false, kind: 'queued', status }
      : { ok: false, kind: 'lost', status };
  }
}

let flushing = false;
// 이 페이지에서 이미 서버 저장에 성공한 큐 항목 — 큐에서 지우는 쓰기가 실패해도 다시 보내지 않는다
const sentQids = new Set();

// 큐를 앞에서부터 다시 보낸다. 보내는 동안 새로 추가된 항목이 지워지지 않도록
// 매번 최신 큐를 다시 읽어 해당 qid 만 제거한다.
export async function flushPendingRides({ save = saveRideRecord } = {}) {
  if (flushing) return;
  flushing = true;
  try {
    for (const item of readPendingRides()) {
      if (sentQids.has(item.qid)) {
        // 전송은 끝났는데 큐 정리만 실패했던 항목 — 정리만 다시 시도
        writeJson(QUEUE_KEY, readPendingRides().filter((q) => q.qid !== item.qid));
        continue;
      }
      let remove = false;
      try {
        await save(item.record);
        sentQids.add(item.qid);
        remove = true;
      } catch (err) {
        remove = !isRetryable(err);
      }
      if (remove) writeJson(QUEUE_KEY, readPendingRides().filter((q) => q.qid !== item.qid));
    }
  } finally {
    flushing = false;
  }
}

// ── 파티 라이딩 세션 ─────────────────────────────────

export const rideSessionKey = (userId, partyId, rideStartedAt) =>
  `${SESSION_PREFIX}${userId}:${partyId}:${rideStartedAt}`;

export const loadRideSession = (key) => readJson(key, null);

// 방을 열 때 호출 — 없으면 새로 만들고, 있으면(재진입) 그대로 둔다
export function beginRideSession(key) {
  const cur = loadRideSession(key);
  if (cur) return cur;
  const fresh = { distanceM: 0, state: 'active', updatedAt: Date.now() };
  writeJson(key, fresh);
  return fresh;
}

export function storeRideDistance(key, distanceM) {
  const cur = loadRideSession(key);
  if (!cur || cur.state !== 'active') return;
  writeJson(key, { ...cur, distanceM, updatedAt: Date.now() });
}

// 확정할 수 있는 상태인지 — active 이거나, 다른 페이지 로드에서 시작됐거나
// 오래된 finalizing(새로고침 등으로 중단된 확정)
function isClaimable(s, now) {
  if (!s) return false;
  if (s.state === 'active') return true;
  if (s.state === 'finalizing') {
    return s.owner !== PAGE_LOAD_ID || now - (s.finalizingAt || 0) > STALE_FINALIZING_MS;
  }
  return false;
}

// 이 페이지에서 차지했거나 확정한 세션 — localStorage 쓰기가 실패해도 중복 확정을 막는다.
// key -> { state: 'finalizing' | 'done', at, token }. finalizing 은 2분이 지나면 만료(멈춘 요청 복구).
const memClaims = new Map();
let claimSeq = 0; // claim 마다 새 번호 — 늦게 끝난 이전 요청이 최신 결과를 덮지 못하게 한다
// 확정 결과(done/active)를 저장소에 못 쓴 세션 — 다음 폴링에서 쓰기만 다시 시도한다
const pendingWrites = new Map(); // key -> 써야 할 세션 값

function memBlocks(key, now) {
  const m = memClaims.get(key);
  if (!m) return false;
  if (m.state === 'done') return true;
  return now - m.at <= STALE_FINALIZING_MS;
}

// 못 쓴 확정 결과를 다시 써 본다(성공하면 목록에서 뺀다)
export function retryPendingSessionWrites() {
  for (const [key, value] of pendingWrites) {
    if (writeJson(key, value)) pendingWrites.delete(key);
  }
}

// 한 탭 안에서는 동기 실행이라, 방과 도크 중 먼저 부른 쪽만 'claimed' 를 받는다.
// 저장소를 못 읽거나(없음) 못 써도, 메모리 가드로 차지해서 서버 저장은 계속 시도한다.
// 반환: 'claimed' | 'busy'(이미 다른 쪽이 확정 중이거나 확정됨)
export function claimRideSession(key, now = Date.now()) {
  if (memBlocks(key, now)) return 'busy';
  const cur = loadRideSession(key);
  // 내 페이지의 finalizing 이 만료돼 다시 잡는 경우도 isClaimable 이 2분 기준으로 허용한다
  if (cur && !isClaimable(cur, now)) return 'busy';
  claimSeq += 1;
  memClaims.set(key, { state: 'finalizing', at: now, token: claimSeq });
  if (cur) writeJson(key, { ...cur, state: 'finalizing', owner: PAGE_LOAD_ID, finalizingAt: now, updatedAt: now });
  return 'claimed';
}

export const currentClaimToken = (key) => memClaims.get(key)?.token;

// 저장 결과에 따라 세션을 정리한다. 보존 실패(lost)만 active 로 되돌려 다음에 다시 잡히게 한다.
// 저장소 쓰기가 실패하면 pendingWrites 에 남겨 다음 폴링에서 다시 쓴다.
// token 을 주면 그 claim 이 최신일 때만 반영하고, 이미 done 이면 어떤 결과도 되돌리지 않는다.
export function settleRideSession(key, result, now = Date.now(), token) {
  const m = memClaims.get(key);
  if (m?.state === 'done') return;                          // 완료는 되돌리지 않는다
  if (token !== undefined && m?.token !== token) return;    // 늦게 끝난 이전 요청 — 무시
  const state = result.kind === 'lost' ? 'active' : 'done';
  if (state === 'active') memClaims.delete(key);
  else memClaims.set(key, { state: 'done', at: now });
  const cur = loadRideSession(key);
  if (!cur) return;
  const next = { ...cur, state, owner: undefined, finalizingAt: undefined, updatedAt: now };
  if (writeJson(key, next)) pendingWrites.delete(key);
  else pendingWrites.set(key, next);
}

// 테스트 전용 — 메모리 가드 초기화
export function __resetRideMemory() {
  memClaims.clear();
  sentQids.clear();
  pendingWrites.clear();
}

export function isRideSessionDone(key) {
  const s = loadRideSession(key);
  return !s || s.state === 'done';
}

export async function finalizePartySession({ key, buildRecord, submit = submitRideRecord, now = Date.now() }) {
  // 이미 다른 쪽(방·도크)이 확정했거나 확정 중 — 여기서는 저장하지 않는다
  if (claimRideSession(key, now) !== 'claimed') return { ok: true, kind: 'busy' };
  const token = currentClaimToken(key);
  const session = loadRideSession(key);
  const record = buildRecord(session);
  // 거리가 0이면 저장할 기록이 없다 — 세션만 닫는다
  if (!record) {
    settleRideSession(key, { kind: 'saved' }, now, token);
    return { ok: true, kind: 'empty' };
  }
  const result = await submit(record);
  settleRideSession(key, result, Date.now(), token);
  return result;
}

// 방장은 파티 종료가 성공한 뒤에만 기록을 확정한다
export async function endRideAsHost({ stopRide, finalize }) {
  const updated = await stopRide();
  const result = await finalize();
  return { updated, result };
}

function parseSessionKey(key, userId) {
  const prefix = `${SESSION_PREFIX}${userId}:`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const i = rest.indexOf(':');
  if (i < 0) return null;
  return { partyId: Number(rest.slice(0, i)), rideStartedAt: rest.slice(i + 1) };
}

export function listRideSessions(userId) {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      const meta = key && parseSessionKey(key, userId);
      if (meta) out.push({ key, ...meta, session: loadRideSession(key) });
    }
  } catch { /* 저장소 접근 불가 — 빈 목록 */ }
  return out;
}

// 종료됐지만 아직 확정되지 않은 세션을 찾는다.
// rooms 는 "성공한 최신 조회" 결과여야 한다. 목록에 없는 파티는 판정을 보류해
// goneIds(존재하지 않음이 확인된 파티)에 있을 때만 종료로 본다.
export function findEndedSessions({ userId, rooms, openRidingPartyId, goneIds = new Set(), sessions, now = Date.now() }) {
  const list = sessions ?? listRideSessions(userId);
  return list.filter(({ key, partyId, rideStartedAt, session }) => {
    if (memBlocks(key, now) || !isClaimable(session, now)) return false;
    if (partyId === openRidingPartyId) return false;
    const room = rooms.find((r) => r.id === partyId);
    if (!room) return goneIds.has(partyId);
    if (room.status === 'ended') return true;
    return room.rideStartedAt !== rideStartedAt;
  });
}

// 목록에 없는 파티 id — 존재 여부 확인이 필요한 후보
export function unknownSessionPartyIds({ userId, rooms, sessions, now = Date.now() }) {
  const list = sessions ?? listRideSessions(userId);
  const ids = new Set();
  for (const { key, partyId, session } of list) {
    if (!memBlocks(key, now) && isClaimable(session, now) && !rooms.some((r) => r.id === partyId)) ids.add(partyId);
  }
  return [...ids];
}

// 오래된 done 묘비 정리
export function pruneRideSessions(userId, now = Date.now()) {
  for (const { key, session } of listRideSessions(userId)) {
    if (session?.state === 'done' && now - (session.updatedAt || 0) > DONE_TTL_MS) {
      try { localStorage.removeItem(key); } catch { /* 무시 */ }
    }
  }
}
