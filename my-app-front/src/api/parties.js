import { api } from './client';
import { getRoutes } from './routes';

// userId(보는 사람) 기준 — 내 파티 + 호스트와 220m 안에 있는 모집 중 파티만 온다.
// 남의 파티는 나와 호스트가 둘 다 위치 공유 중일 때만 보인다. 각 파티에 hostDistanceM(m)이 붙는다.
export async function getParties(userId) {
    return api.get(userId ? `/api/parties?userId=${userId}` : '/api/parties');
}

// 파티 1건 — 지도에서 코스와 멤버를 읽을 때 쓴다
export async function getParty(id) {
    return api.get(`/api/parties/${id}`);
}

export async function getMyRoutesForParty(userId) {
    // 비로그인이면 호출하지 않는다. userId 없이 부르면 백엔드가 400 을 준다.
    if (!userId) return [];

    try {
        const routes = await getRoutes(userId);
        if (Array.isArray(routes) && routes.length > 0) {
            return routes.map((r) => ({
                id: r.id,
                routeName: r.routeName || `${r.fromLabel} → ${r.toLabel}`,
                fromLabel: r.fromLabel,
                toLabel: r.toLabel,
                distanceKm: r.distanceKm ?? null,
            }));
        }
    } catch (e) {
        console.error(e);
    }
    return [];
}

export async function createParty({ route, title, startAt, maxMembers, host }) {
    return api.post('/api/parties', {
        hostId: host.id,
        routeId: route.id,
        title: title?.trim() || `${route.routeName} 링크`,
        startAt,
        maxMembers: Number(maxMembers),
    });
}

export async function applyToParty(id, applicant) {
    return api.post(`/api/parties/${id}/apply`, { userId: applicant.id });
}

// 참가 요청 수락·거절 — hostId(처리하는 사람)가 방장인지 서버가 확인한다
export async function approveRequest(partyId, userId, hostId) {
    return api.post(`/api/parties/${partyId}/requests/${userId}/approve`, { userId: hostId });
}

// 팀원 내보내기(강퇴, 방장만) — 내보내진 사람은 같은 파티에 다시 신청할 수 없다
export async function kickMember(partyId, memberId, hostId) {
    return api.post(`/api/parties/${partyId}/members/${memberId}/kick`, { userId: hostId });
}

// 파티 코스 바꾸기 (방장만, 방장이 만든 코스 중에서, 라이딩 시작 전에만)
export async function changePartyRoute(partyId, routeId, hostId) {
    return api.put(`/api/parties/${partyId}/route`, { userId: hostId, routeId });
}

// 파티 삭제 (호스트만)
export async function deleteParty(partyId, userId) {
    return api.del(`/api/parties/${partyId}?userId=${userId}`);
}

// 라이딩 시작 알림 (호스트만) — 참가자가 이 시각을 보고 자동 출발한다
export async function startPartyRide(partyId, userId) {
    return api.post(`/api/parties/${partyId}/start-ride`, { userId });
}

// 라이딩만 종료 (파티는 유지, 호스트만)
export async function stopPartyRide(partyId, userId) {
    return api.post(`/api/parties/${partyId}/stop-ride`, { userId });
}

// 라이딩 종료 → 파티 종료 (호스트만)
export async function endParty(partyId, userId) {
    return api.post(`/api/parties/${partyId}/end`, { userId });
}

export async function rejectRequest(partyId, userId, hostId) {
    return api.post(`/api/parties/${partyId}/requests/${userId}/reject`, { userId: hostId });
}

// 참가자 스스로 파티 나가기 (호스트는 불가 — 파티 삭제를 써야 함)
export async function leaveParty(partyId, userId) {
    return api.post(`/api/parties/${partyId}/leave`, { userId });
}

// 대기방에서 내 준비 상태 표시 (준비 완료 / 준비 중)
export async function setPartyReady(partyId, userId, ready) {
    return api.post(`/api/parties/${partyId}/ready`, { userId, ready });
}
