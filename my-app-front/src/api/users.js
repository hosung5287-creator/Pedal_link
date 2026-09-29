import { api } from './client';

export const getProfile = (userId) => api.get(`/api/users/${userId}`);

// 보낸 필드만 반영된다. { bio, profileImageUrl, bikeInfo, gender, age, region }
export const updateProfile = (userId, data) => api.put(`/api/users/${userId}/profile`, data);

// 설정 — 이메일 변경. 현재 비밀번호로 본인 확인하고, 성공하면 바뀐 프로필을 돌려준다.
export const changeEmail = (userId, { currentPassword, newEmail }) =>
  api.put(`/api/users/${userId}/email`, { currentPassword, newEmail });

// 설정 — 비밀번호 변경. 성공하면 { message } 만 돌려준다.
export const changePassword = (userId, { currentPassword, newPassword }) =>
  api.put(`/api/users/${userId}/password`, { currentPassword, newPassword });
