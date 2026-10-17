import { api } from './client';

export function reportLocation({ userId, name, lat, lng }) {
  return api.post('/api/locations', { userId, name, lat, lng });
}

// 위치 공유를 껐을 때 서버에 남은 내 마지막 위치를 바로 지운다 (안 지우면 최대 15초 더 보인다)
export function removeLocation(userId) {
  return api.del(`/api/locations?userId=${userId}`);
}

// partyId 를 주면 그 파티의 참여 확정 멤버 위치만 돌아온다.
export function getOtherLocations(userId, partyId) {
  const q = partyId ? `?userId=${userId}&partyId=${partyId}` : `?userId=${userId}`;
  return api.get(`/api/locations${q}`);
}
