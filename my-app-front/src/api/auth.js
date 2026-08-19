// 인증(로그인) 관련 백엔드 호출.
//
// 소셜 로그인은 "백엔드 주도 리다이렉트" 방식(Spring Security OAuth2)을 쓴다.
// 프론트는 백엔드 인가 URL로 브라우저를 이동시키기만 하고,
// 구글/네이버 인증 → 콜백 → 토큰 교환 → 세션 발급은 전부 백엔드가 처리한다.
// 따라서 프론트에 구글/네이버 SDK나 client-secret 이 들어갈 일이 없다.
import { api, API_BASE } from './client';

// ── 소셜 로그인 ──────────────────────────────────
// Spring Security OAuth2 의 기본 인가 URL 규격: /oauth2/authorization/{registrationId}
export const socialLoginUrl = (provider) => `${API_BASE}/oauth2/authorization/${provider}`;

// 브라우저를 백엔드 인가 URL로 이동시켜 소셜 로그인 시작
export function startSocialLogin(provider) {
  window.location.href = socialLoginUrl(provider);
}

// ── 이메일/비밀번호 회원가입 ──
export async function signup({ name, email, password }) {
  return api.post('/api/auth/signup', { name, email, password });
}

// ── 이메일/비밀번호 로그인 ──
export async function login({ email, password }) {
  return api.post('/api/auth/login', { email, password });
}

// ── 위치 공유 설정 업데이트 ──
export async function updateLocationSharing(userId, enabled) {
  return api.put(`/api/auth/users/${userId}/location-sharing`, { enabled });
}
