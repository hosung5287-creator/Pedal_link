import { api } from './client';

// { rideCount, totalDistanceKm, totalDurationMin, totalAscendM, mountainRideCount, mountainThresholdM, ascendPerKm }
// 상승고도는 탄 거리 비율만큼만 인정된 값, ascendPerKm 은 코스 라이딩 기록이 없으면 null
export const getRideStats = (userId) => api.get(`/api/ride-records/stats?userId=${userId}`);

// 라이딩 기록 목록 (최신순) — 각 항목에 routeName/ascendM(코스 탄 경우, 탄 거리 비율만큼 인정된 값) 포함
export const getRideHistory = (userId) => api.get(`/api/ride-records?userId=${userId}`);
