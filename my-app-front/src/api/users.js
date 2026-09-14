import { api } from './client';

export const getProfile = (userId) => api.get(`/api/users/${userId}`);

// 보낸 필드만 반영된다. { bio, profileImageUrl, bikeInfo, gender, age, region }
export const updateProfile = (userId, data) => api.put(`/api/users/${userId}/profile`, data);
