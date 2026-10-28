import { api } from './client';

// 시연 모드 — 백엔드가 DEMO_ENABLED=true 로 켜져 있을 때만 있다 (꺼져 있으면 status 말고는 모두 404)

// { enabled, role: presenter | rider | none } — 꺼져 있으면 { enabled: false }
export function getDemoStatus(userId) {
  return api.get(`/api/demo/status?userId=${userId}`);
}

// [시연 준비] — 가상 라이더(민수·지영·현우)와 시연 크루를 만든다. 결과는 getDemoState 와 같은 모양
export function setupDemo(userId) {
  return api.post('/api/demo/setup', { userId });
}

export function getDemoState(userId) {
  return api.get(`/api/demo/state?userId=${userId}`);
}

// action: stray(민수 이탈) | return(민수 복귀) | join(현우 합류) | finish(도착 지점으로)
export function sendDemoAction(userId, action) {
  return api.post('/api/demo/action', { userId, action });
}

// GPS 대신 쓰는 가상 위치 { lat, lng, heading, t, jumps } — 아직 없으면 null(204)
export function getDemoPosition(userId) {
  return api.get(`/api/demo/position?userId=${userId}`);
}
