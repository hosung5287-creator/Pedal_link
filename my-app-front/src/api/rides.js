import { api } from './client';

// { rideCount, totalDistanceKm, totalDurationMin, totalAscendM, mountainRideCount, mountainThresholdM }
export const getRideStats = (userId) => api.get(`/api/ride-records/stats?userId=${userId}`);

// 라이딩 기록 목록 (최신순) — 각 항목에 routeName/ascendM(코스 탄 경우) 포함
export const getRideHistory = (userId) => api.get(`/api/ride-records?userId=${userId}`);

// 라이딩 기록 저장 — 백엔드 RideRecordRequest 와 1:1
// distance 는 km, duration 은 분. 개인 라이딩이면 partyId 는 null.
export const saveRideRecord = ({ userId, distance, duration, partyId = null, routeId = null, routeName = null }) =>
  api.post('/api/ride-records', { userId, distance, duration, partyId, routeId, routeName });
