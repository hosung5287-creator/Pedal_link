import { api } from './client';

// { rideCount, totalDistanceKm, totalDurationMin }
export const getRideStats = (userId) => api.get(`/api/ride-records/stats?userId=${userId}`);
