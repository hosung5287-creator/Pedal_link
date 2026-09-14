import { api } from './client';

export const sendMatchRequest = (fromUserId, toUserId) =>
  api.post('/api/matches', { fromUserId, toUserId });

// 내가 받은 대기중 신청 (수락/거절 대상)
export const getIncomingMatches = (userId) => api.get(`/api/matches/incoming?userId=${userId}`);

// 내가 보낸 대기중 신청 ("신청 중…" 표시용)
export const getOutgoingMatches = (userId) => api.get(`/api/matches/outgoing?userId=${userId}`);

// 수락하면 자동 생성된 2인 파티(PartyResponse)를 돌려준다
export const acceptMatch = (id, userId) => api.post(`/api/matches/${id}/accept`, { userId });

export const rejectMatch = (id, userId) => api.post(`/api/matches/${id}/reject`, { userId });
