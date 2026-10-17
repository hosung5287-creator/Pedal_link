// 크루 라이딩 ("이번주 라이딩 열기") — 백엔드 CrewRideController.
// 흐름: 열기 → 채팅 초대 카드로 참여/불참(참여 시 토큰) → 당일 인원 체크(팀장 220m + 토큰) → 라이딩 시작
import { api } from './client';

// { leaderId, title, startAt('YYYY-MM-DDTHH:mm'), routeId, memberIds }
export const openCrewRide = (crewId, body) => api.post(`/api/crews/${crewId}/rides`, body);

// 진행 중인 라이딩 (없으면 null)
export const getActiveCrewRide = (crewId, userId) =>
  api.get(`/api/crews/${crewId}/rides/active${userId ? `?userId=${userId}` : ''}`);

export const getCrewRide = (eventId, userId) =>
  api.get(`/api/crew-rides/${eventId}${userId ? `?userId=${userId}` : ''}`);

// 내가 체크되어 라이딩 중인 크루 라이딩 { eventId, partyId } (없으면 null) — 라이딩 화면 자동 이동용
export const getMyCrewRiding = (userId) => api.get(`/api/crew-rides/my-riding?userId=${userId}`);

export const respondCrewRide = (eventId, userId, accept) =>
  api.post(`/api/crew-rides/${eventId}/respond`, { userId, accept });

export const startCrewRideCheck = (eventId, userId) =>
  api.post(`/api/crew-rides/${eventId}/start-check`, { userId });

// targetUserId 가 없으면 일괄 체크 — 응답의 checkResults 에 사람별 결과·사유
export const checkCrewRide = (eventId, userId, targetUserId = null) =>
  api.post(`/api/crew-rides/${eventId}/check`, { userId, targetUserId });

export const startCrewRide = (eventId, userId) =>
  api.post(`/api/crew-rides/${eventId}/start`, { userId });

export const cancelCrewRide = (eventId, userId) =>
  api.post(`/api/crew-rides/${eventId}/cancel`, { userId });
