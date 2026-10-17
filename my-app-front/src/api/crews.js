// 크루(정기 모임) 관련 백엔드 호출 — CrewController(/api/crews) 와 1:1.
// 실패는 그대로 던진다. 호출하는 화면(CrewPage)이 오류 문구를 보여준다.
import { api } from './client';

export const getCrews = () => api.get('/api/crews');

export const getCrew = (id) => api.get(`/api/crews/${id}`);

export const createCrew = (body) => api.post('/api/crews', body);

export const joinCrew = (id, userId) => api.post(`/api/crews/${id}/join`, { userId });

export const leaveCrew = (id, userId) => api.post(`/api/crews/${id}/leave`, { userId });

// 크루 설정 (리더만) — joinPolicy: 'approval' | 'open' | 'closed'
export const updateCrewSettings = (id, userId, { joinPolicy }) =>
  api.put(`/api/crews/${id}/settings`, { userId, joinPolicy });

// 가입 요청 수락·거절 — leaderId(처리하는 사람)가 그 크루 리더인지 서버가 확인한다
export const approveMember = (id, userId, leaderId) =>
  api.post(`/api/crews/${id}/requests/${userId}/approve`, { leaderId });

export const rejectMember = (id, userId, leaderId) =>
  api.post(`/api/crews/${id}/requests/${userId}/reject`, { leaderId });
