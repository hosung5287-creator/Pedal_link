// 파티(번개모임) 관련 백엔드 호출 — 지금은 mock, 나중에 실제 백엔드로 스왑.
//
// 파티 = 저장된 경로 + 번개 정보(모임시간/호스트/참여자).
// 아래 mock 이 그대로 백엔드에 요청할 "API 계약(JSON 모양)"이 된다.
// 백엔드가 준비되면 각 함수 안의 return mock... 을 api.get/post(...) 한 줄로 교체.
// (스왑 시 아래 주석처럼 `import { api } from './client';` 를 추가)
import { getRoutes } from './routes';

// ── 파티 데이터 모양 (백엔드 PartyResponse 와 1:1로 맞출 것) ──
// {
//   id, title,
//   routeId, routeName, fromLabel, toLabel, distanceKm,
//   startAt,          // ISO 문자열, 모임 시간
//   maxMembers, joinedMembers,
//   hostName,
//   status,           // 'open' | 'full'
// }

let nextId = 100;

// 세션 동안 유지되는 인메모리 파티 목록 (mock)
let partyStore = [
  {
    id: 1,
    title: '한강 노을 라이딩 같이 타요',
    routeId: 11, routeName: '한강 노을 순환 코스',
    fromLabel: '반포한강공원', toLabel: '잠실한강공원', distanceKm: 28.4,
    startAt: '2026-07-11T20:00:00',
    maxMembers: 6, joinedMembers: 3,
    hostName: '라이더A', status: 'open',
  },
  {
    id: 2,
    title: '주말 남산 업힐 도전 링크',
    routeId: 12, routeName: '남산 업힐 반복 코스',
    fromLabel: '숭례문', toLabel: 'N서울타워', distanceKm: 22.1,
    startAt: '2026-07-12T07:00:00',
    maxMembers: 4, joinedMembers: 4,
    hostName: '클라이머B', status: 'full',
  },
];

// 저장된 경로가 없을 때 파티 개설을 시연하기 위한 mock 저장 경로
const mockSavedRoutes = [
  { id: 11, routeName: '한강 노을 순환 코스', fromLabel: '반포한강공원', toLabel: '잠실한강공원', distanceKm: 28.4 },
  { id: 12, routeName: '남산 업힐 반복 코스', fromLabel: '숭례문', toLabel: 'N서울타워', distanceKm: 22.1 },
  { id: 13, routeName: '양재천 회복 라이딩', fromLabel: '양재시민의숲', toLabel: '대치동', distanceKm: 16.9 },
];

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// 모집 중인 파티 목록
export async function getParties() {
  await delay();
  return [...partyStore];
  // 백엔드 준비 후: return api.get('/api/parties');
}

// 파티 개설에 쓸 "내 저장 경로" 목록.
// 실제 백엔드 경로가 있으면 그걸 쓰고, 비었거나 실패하면 mock 으로 대체.
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

// 저장된 경로로 번개 파티 개설
export async function createParty({ route, title, startAt, maxMembers, hostName = '나' }) {
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
    joinedMembers: 1, // 개설자는 자동 참여
    hostName,
    status: 'open',
  };
  partyStore = [party, ...partyStore];
  return party;
  // 백엔드 준비 후: return api.post('/api/parties', { routeId: route.id, title, startAt, maxMembers });
}

// 파티 참여
export async function joinParty(id) {
  await delay();
  partyStore = partyStore.map((p) => {
    if (p.id !== id) return p;
    if (p.joinedMembers >= p.maxMembers) return p;
    const joined = p.joinedMembers + 1;
    return { ...p, joinedMembers: joined, status: joined >= p.maxMembers ? 'full' : 'open' };
  });
  return partyStore.find((p) => p.id === id);
  // 백엔드 준비 후: return api.post(`/api/parties/${id}/join`);
}
