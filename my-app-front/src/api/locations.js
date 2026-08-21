import { api } from './client';

export function reportLocation({ userId, name, lat, lng }) {
  return api.post('/api/locations', { userId, name, lat, lng });
}

// partyId 를 주면 그 파티의 참여 확정 멤버 위치만 돌아온다.
export function getOtherLocations(userId, partyId) {
  const q = partyId ? `?userId=${userId}&partyId=${partyId}` : `?userId=${userId}`;
  return api.get(`/api/locations${q}`);
}
