// 크루(정기 모임) 관련 백엔드 호출.
// 백엔드 컨트롤러는 아직 없다(khs 작업 예정). 그래서 호출이 실패하면
// 아래 목 데이터로 떨어져 화면이 그대로 동작한다.
// 엔드포인트가 생기면 이 파일을 고칠 필요 없이 실제 데이터로 바뀐다.
import { api } from './client';

// ── 목 데이터 (백엔드 붙으면 자동으로 안 쓰임) ───────────────
const MOCK_CREWS = [
  {
    id: 1, name: '한강 라이더스', region: '서울 · 반포', scheduleText: '매주 토 07:00',
    description: '한강을 따라 편하게 달리는 크루입니다. 초보도 환영하고, 평균 속도 22km/h 로 천천히 갑니다.',
    tag: '초보 환영', memberCount: 24, leaderId: 3, leaderName: '정우',
    myState: 'joined', joinPolicy: 'approval', coverPhoto: null,
    members: [
      { userId: 3, name: '정우', role: 'leader', attend: 'yes' },
      { userId: 4, name: '소연', role: 'member', attend: 'yes' },
      { userId: 5, name: '세훈', role: 'member', attend: 'yes' },
      { userId: 6, name: '유진', role: 'member', attend: 'no' },
      { userId: 7, name: '민재', role: 'member', attend: 'unknown' },
    ],
    upcoming: [
      { id: 101, title: '9월 13일 정기 라이딩', startAt: '2026-09-13T07:00:00', joined: 12, maxMembers: 20 },
      { id: 102, title: '야간 한강 번개', startAt: '2026-09-17T20:00:00', joined: 5, maxMembers: 8 },
    ],
    pendingRequests: [{ userId: 8, name: 'ys2' }, { userId: 2, name: 'testuser' }],
  },
  {
    id: 2, name: '새벽 클라이머', region: '서울 · 남산', scheduleText: '매주 화·목 05:30',
    description: '남산 업힐 위주로 달립니다. 중급 이상 권장.',
    tag: '중급 이상', memberCount: 12, leaderId: 4, leaderName: '소연',
    myState: 'none', joinPolicy: 'approval', coverPhoto: null,
    members: [], upcoming: [], pendingRequests: [],
  },
  {
    id: 3, name: '아라뱃길 크루', region: '경기 · 김포', scheduleText: '격주 일 08:00',
    description: '아라뱃길 왕복 60km 장거리 크루입니다.',
    tag: '장거리', memberCount: 31, leaderId: 5, leaderName: '세훈',
    myState: 'none', joinPolicy: 'open', coverPhoto: null,
    members: [], upcoming: [], pendingRequests: [],
  },
  {
    id: 4, name: '퇴근길 라이딩', region: '서울 · 여의도', scheduleText: '평일 19:30',
    description: '퇴근하고 가볍게 한 바퀴. 아무 때나 참여 가능해요.',
    tag: '초보 환영', memberCount: 46, leaderId: 6, leaderName: '유진',
    myState: 'pending', joinPolicy: 'approval', coverPhoto: null,
    members: [], upcoming: [], pendingRequests: [],
  },
];

// 목 데이터를 쓰는 동안에도 가입 상태 변경이 화면에 반영되도록 사본을 들고 있는다
let mockState = JSON.parse(JSON.stringify(MOCK_CREWS));

// 백엔드가 아직 없으면(404/네트워크 오류) 목으로 떨어진다.
// 500 같은 "있는데 고장난" 응답은 그대로 던져서 문제를 감추지 않는다.
async function withMock(call, fallback) {
  try {
    return await call();
  } catch (e) {
    if (e.status === undefined || e.status === 404) return fallback();
    throw e;
  }
}

export const getCrews = () =>
  withMock(() => api.get('/api/crews'), () => mockState);

export const getCrew = (id) =>
  withMock(() => api.get(`/api/crews/${id}`),
    () => mockState.find((c) => c.id === Number(id)) || null);

export const createCrew = (body) =>
  withMock(() => api.post('/api/crews', body), () => {
    const crew = {
      ...body,
      id: Math.max(0, ...mockState.map((c) => c.id)) + 1,
      memberCount: 1, myState: 'joined', members: [], upcoming: [], pendingRequests: [],
    };
    mockState = [crew, ...mockState];
    return crew;
  });

export const joinCrew = (id, userId) =>
  withMock(() => api.post(`/api/crews/${id}/join`, { userId }), () => {
    mockState = mockState.map((c) => (c.id === Number(id)
      ? { ...c, myState: c.joinPolicy === 'open' ? 'joined' : 'pending' }
      : c));
    return mockState.find((c) => c.id === Number(id));
  });

export const leaveCrew = (id, userId) =>
  withMock(() => api.post(`/api/crews/${id}/leave`, { userId }), () => {
    mockState = mockState.map((c) => (c.id === Number(id) ? { ...c, myState: 'none' } : c));
    return mockState.find((c) => c.id === Number(id));
  });

export const approveMember = (id, userId) =>
  withMock(() => api.post(`/api/crews/${id}/requests/${userId}/approve`), () => {
    mockState = mockState.map((c) => {
      if (c.id !== Number(id)) return c;
      const applicant = (c.pendingRequests || []).find((p) => p.userId === userId);
      return {
        ...c,
        memberCount: c.memberCount + 1,
        members: [...(c.members || []), { userId, name: applicant?.name || '멤버', role: 'member', attend: 'unknown' }],
        pendingRequests: (c.pendingRequests || []).filter((p) => p.userId !== userId),
      };
    });
    return mockState.find((c) => c.id === Number(id));
  });

export const rejectMember = (id, userId) =>
  withMock(() => api.post(`/api/crews/${id}/requests/${userId}/reject`), () => {
    mockState = mockState.map((c) => (c.id === Number(id)
      ? { ...c, pendingRequests: (c.pendingRequests || []).filter((p) => p.userId !== userId) }
      : c));
    return mockState.find((c) => c.id === Number(id));
  });
