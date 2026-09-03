// 히스토리(REST, createdAt)와 실시간 수신(WS, sentAt)이 필드명이 달라서 하나로 합쳐 표시
export function displayTime(msg) {
  const iso = msg.createdAt || msg.sentAt;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}
