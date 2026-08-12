// 파티(링크) 관련 백엔드 호출 — 지금은 mock, 나중에 실제 백엔드로 스왑.
//
// 파티 = 저장된 경로 + 모임정보(시간/호스트/참여자) + 승인제 모집.
// 참여 방식은 "승인제": 신청 → 호스트가 수락/거절 → 수락되면 참여 확정.
// 아래 mock 이 그대로 백엔드에 요청할 "API 계약(JSON 모양)"이 된다.
import { getRoutes } from './routes';

// ── 파티 데이터 모양 (백엔드 PartyResponse 와 1:1로 맞출 것) ──
// {
//   id, title,
//   routeId, routeName, fromLabel, toLabel, distanceKm,
//   startAt,                       // ISO 문자열, 모임 시간
//   maxMembers,                    // 최대 인원
//   hostId, hostName,              // 호스트(개설자)
//   status,                        // 'open'(모집중) | 'full'(정원참) | 'closed'(마감)
//   participants: [{ userId, name }],     // 승인된 참여자(호스트 포함)
//   pendingRequests: [{ userId, name }],  // 승인 대기 신청자
// }

let nextId = 100;

// 세션 동안 유지되는 인메모리 파티 목록 (mock)
// party 2 는 데모용으로 '나'(me)가 호스트 + 대기 신청자 2명 → 승인/거절 UI 시연 가능
let partyStore = [
  {
    id: 1,
    title: '한강 노을 라이딩 같이 타요',
    routeId: 11, routeName: '한강 노을 순환 코스',
    fromLabel: '반포한강공원', toLabel: '잠실한강공원', distanceKm: 28.4,
    startAt: '2026-07-11T20:00:00',
    maxMembers: 6,
    hostId: 'u_a', hostName: '라이더A',
    status: 'open',
    participants: [
      { userId: 'u_a', name: '라이더A' },
      { userId: 'u_b', name: '바이크박' },
      { userId: 'u_c', name: '한강러너' },
    ],
    pendingRequests: [],
  },
  {
    id: 2,
    title: '주말 남산 업힐 도전 링크',
    routeId: 12, routeName: '남산 업힐 반복 코스',
    fromLabel: '숭례문', toLabel: 'N서울타워', distanceKm: 22.1,
    startAt: '2026-07-12T07:00:00',
    maxMembers: 4,
    hostId: 'me', hostName: '나',
    status: 'open',
    participants: [{ userId: 'me', name: '나' }],
    pendingRequests: [
      { userId: 'u_x', name: '김라이더' },
      { userId: 'u_y', name: '박바이크' },
    ],
  },
];

// 저장된 경로가 없을 때 파티 개설을 시연하기 위한 mock 저장 경로
const mockSavedRoutes = [
  { id: 11, routeName: '한강 노을 순환 코스', fromLabel: '반포한강공원', toLabel: '잠실한강공원', distanceKm: 28.4 },
  { id: 12, routeName: '남산 업힐 반복 코스', fromLabel: '숭례문', toLabel: 'N서울타워', distanceKm: 22.1 },
  { id: 13, routeName: '양재천 회복 라이딩', fromLabel: '양재시민의숲', toLabel: '대치동', distanceKm: 16.9 },
];

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// 참여자 수에 따라 status 재계산 (closed 는 호스트가 명시적으로 마감한 상태라 유지)
function recalcStatus(party) {
  if (party.status === 'closed') return party.status;
  return party.participants.length >= party.maxMembers ? 'full' : 'open';
}

function updateParty(id, updater) {
  partyStore = partyStore.map((p) => (p.id === id ? updater({ ...p }) : p));
  return partyStore.find((p) => p.id === id);
}

// 모집 중인 파티 목록
export async function getParties() {
  await delay();
  return partyStore.map((p) => ({ ...p }));
  // 백엔드 준비 후: return api.get('/api/parties');
}

// 파티 개설에 쓸 "내 저장 경로" 목록.
export async function getMyRoutesForParty() {
  try {
    const routes = await getRoutes();
    if (Array.isArray(routes) && routes.length > 0) {
      return routes.map((r) => ({
        id: r.id,
        routeName: r.routeName,
        fromLabel: r.fromLabel,
        toLabel: r.toLabel,
        distanceKm: r.distanceKm ?? null,
      }));
    }
  } catch (e) {
    // 백엔드 미가동 등 — mock 으로 폴백
  }
  await delay();
  return [...mockSavedRoutes];
}

// 저장된 경로로 파티 개설. host = { id, name } (개설자는 자동 참여)
export async function createParty({ route, title, startAt, maxMembers, host }) {
  await delay();
  const party = {
    id: nextId++,
    title: title?.trim() || `${route.routeName} 링크`,
    routeId: route.id,
    routeName: route.routeName,
    fromLabel: route.fromLabel,
    toLabel: route.toLabel,
    distanceKm: route.distanceKm ?? null,
    startAt,
    maxMembers: Number(maxMembers),
    hostId: host.id,
    hostName: host.name,
    status: 'open',
    participants: [{ userId: host.id, name: host.name }],
    pendingRequests: [],
  };
  partyStore = [party, ...partyStore];
  return party;
  // 백엔드 준비 후: return api.post('/api/parties', { routeId, title, startAt, maxMembers });
}

// 파티 참여 신청 (승인 대기 목록에 추가). applicant = { id, name }
export async function applyToParty(id, applicant) {
  await delay();
  return updateParty(id, (p) => {
    const already =
      p.participants.some((m) => m.userId === applicant.id) ||
      p.pendingRequests.some((m) => m.userId === applicant.id);
    if (already || p.status !== 'open') return p;
    p.pendingRequests = [...p.pendingRequests, { userId: applicant.id, name: applicant.name }];
    return p;
  });
  // 백엔드 준비 후: return api.post(`/api/parties/${id}/apply`);
}

// 신청 수락 (호스트 전용) — 대기자를 참여자로 이동
export async function approveRequest(partyId, userId) {
  await delay();
  return updateParty(partyId, (p) => {
    const req = p.pendingRequests.find((m) => m.userId === userId);
    if (!req || p.participants.length >= p.maxMembers) return p;
    p.pendingRequests = p.pendingRequests.filter((m) => m.userId !== userId);
    p.participants = [...p.participants, req];
    p.status = recalcStatus(p);
    return p;
  });
  // 백엔드 준비 후: return api.post(`/api/parties/${partyId}/requests/${userId}/approve`);
}

// 신청 거절 (호스트 전용) — 대기 목록에서 제거
export async function rejectRequest(partyId, userId) {
  await delay();
  return updateParty(partyId, (p) => {
    p.pendingRequests = p.pendingRequests.filter((m) => m.userId !== userId);
    return p;
  });
  // 백엔드 준비 후: return api.post(`/api/parties/${partyId}/requests/${userId}/reject`);
}
