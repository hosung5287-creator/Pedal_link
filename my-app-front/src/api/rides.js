import { api } from './client';

// { rideCount, totalDistanceKm, totalDurationMin, totalAscendM, mountainRideCount, mountainThresholdM }
export const getRideStats = (userId) => api.get(`/api/ride-records/stats?userId=${userId}`);

// 라이딩 기록 목록 (최신순) — 각 항목에 routeName/ascendM(코스 탄 경우) 포함
export const getRideHistory = (userId) => api.get(`/api/ride-records?userId=${userId}`);
