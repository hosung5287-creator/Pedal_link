// 로그인한 화면이 몇 초마다 확인하는 "내 상태" — 백엔드 MeController.
// { incomingMatches, outgoingMatches, crewRiding: { eventId, partyId } | null }
import { api } from './client';

export const getMyStatus = (userId) => api.get(`/api/me/status?userId=${userId}`);
