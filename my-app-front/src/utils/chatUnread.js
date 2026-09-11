// 채팅방별 "안 읽은 메시지 수" 계산.
//
// 서버에 읽음 상태를 저장하는 API 가 없어서, 마지막으로 본 메시지 시각을
// 브라우저(localStorage)에 남겨두고 그보다 새로운 메시지를 센다.
// 그래서 기기마다 따로 계산되고, 다른 브라우저로 옮기면 초기화된다.

const KEY = (roomId) => `pedallink:chatRead:${roomId}`;
export const UNREAD_EVENT = 'pedallink:chatunread';

// 히스토리(REST)는 createdAt, 실시간(WS)은 sentAt 으로 시각 필드가 다르다
export const msgTime = (msg) => {
  const iso = msg?.createdAt || msg?.sentAt;
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

function lastReadAt(roomId) {
  try {
    return Number(localStorage.getItem(KEY(roomId))) || 0;
  } catch {
    return 0;
  }
}

// 내가 보낸 메시지는 세지 않는다
export function countUnread(roomId, messages, myUserId) {
  const since = lastReadAt(roomId);
  return (messages || []).filter((m) => m.senderId !== myUserId && msgTime(m) > since).length;
}

// 방을 보고 있는 동안 호출 — 가장 최근 메시지 시각까지 읽은 것으로 표시한다
export function markRead(roomId, messages) {
  if (!roomId || !messages?.length) return;
  const newest = messages.reduce((max, m) => Math.max(max, msgTime(m)), 0);
  if (!newest || newest <= lastReadAt(roomId)) return;
  try {
    localStorage.setItem(KEY(roomId), String(newest));
    // 다른 화면의 뱃지도 즉시 줄어들도록 알린다
    window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: { roomId } }));
  } catch { /* 저장 불가(프라이빗 모드 등)면 뱃지만 안 줄어든다 */ }
}
