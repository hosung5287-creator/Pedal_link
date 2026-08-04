// 백엔드 API 호출을 한 곳으로 모으는 공통 클라이언트.
// 컴포넌트는 fetch 를 직접 부르지 말고 항상 이 client 를 통해 호출한다.
//
// base URL 은 환경변수로 관리한다. (.env.local 의 REACT_APP_API_BASE)
<<<<<<< HEAD
export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

// 서버가 에러 상태코드를 주면 이 에러로 던진다.
=======
// 로컬 개발 기본값은 Spring Boot 서버 주소.
export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

// 서버가 에러 상태코드를 주면 이 에러로 던진다.
// 컴포넌트에서 err.status 로 분기 처리할 수 있다.
>>>>>>> 3af1c9094048a33754471530997cd084719dfbd3
export class ApiError extends Error {
  constructor(status, message) {
    super(message || `요청 실패 (HTTP ${status})`);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, headers, withCredentials = false } = {}) {
  const options = { method, headers: { ...headers } };

  // 로그인 세션 쿠키를 함께 보내야 하는 요청(인증 API)에서 사용
  if (withCredentials) options.credentials = 'include';

  if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, options);

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ApiError(res.status, detail || res.statusText);
  }

  // 204 No Content 등 본문 없는 응답 처리
  if (res.status === 204) return null;
  const raw = await res.text();
  return raw ? JSON.parse(raw) : null;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
<<<<<<< HEAD

// ==========================================
// 기존 주행 기록 관련 API (단일 기록)
// ==========================================
export const rideApi = {
  // 1. 주행 기록 저장하기 (POST /api/ride-records)
  saveRecord: (rideData) =>
    api.post('/api/ride-records', rideData, { withCredentials: true }),

  // 2. 특정 유저의 주행 기록 목록 불러오기 (GET /api/ride-records/user/:userId)
  getUserRecords: (userId) =>
    api.get(`/api/ride-records/user/${userId}`, { withCredentials: true }),
};

// ==========================================
// 🚴‍♂️ 신규 라이더 실시간 위치 및 히스토리 API
// ==========================================
export const riderApi = {
  // 1. 실시간 위치 업데이트 (1인당 1행 유지 - rider_real_time_location)
  updateRealTimeLocation: (riderId, latitude, longitude) =>
    api.post('/api/rider/location', { riderId, latitude, longitude }),

  // 2. 주행 완료 및 히스토리 기록 저장 (누적 저장 - rider_activity_history)
  saveActivityHistory: (historyData) =>
    api.post('/api/rider/history', historyData),
};
=======
>>>>>>> 3af1c9094048a33754471530997cd084719dfbd3
