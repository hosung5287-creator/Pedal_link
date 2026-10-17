import { api } from './client';

// { rideCount, totalDistanceKm, totalDurationMin, totalAscendM, mountainRideCount, mountainThresholdM, ascendPerKm }
// 상승고도는 탄 거리 비율만큼만 인정된 값, ascendPerKm 은 코스 라이딩 기록이 없으면 null
export const getRideStats = (userId) => api.get(`/api/ride-records/stats?userId=${userId}`);

// 라이딩 기록 목록 (최신순) — 각 항목에 routeName/ascendM(코스 탄 경우, 탄 거리 비율만큼 인정된 값) 포함
export const getRideHistory = (userId) => api.get(`/api/ride-records?userId=${userId}`);

// 라이딩 기록 저장 — 백엔드 RideRecordRequest 와 1:1
// distance 는 km, duration 은 분. 개인 라이딩이면 partyId 는 null.
export const saveRideRecord = ({ userId, distance, duration, partyId = null, routeId = null, routeName = null }) =>
  api.post('/api/ride-records', { userId, distance, duration, partyId, routeId, routeName });

// 프로필 AI 라이딩 리포트 → { available, rideCount, stale, insight: { level, summary, advice[], model, createdAt } | null }
// GET 은 저장된 결과만 본다(Claude 호출 없음). POST 는 기록이 바뀌었을 때만 Claude 에 새로 물어본다.
export const getRideInsight = (userId) => api.get(`/api/ride-records/insight?userId=${userId}`);
export const analyzeRides = (userId) => api.post(`/api/ride-records/insight?userId=${userId}`);

// 라이딩 통계 카드의 한마디 조언 → { available, stale, tip, createdAt }
// GET 은 저장된 조언만 본다. stale(통계가 바뀜)이면 POST 로 Claude 가 새 조언을 쓴다.
export const getRideTip = (userId) => api.get(`/api/ride-records/tip?userId=${userId}`);
export const refreshRideTip = (userId) => api.post(`/api/ride-records/tip?userId=${userId}`);
