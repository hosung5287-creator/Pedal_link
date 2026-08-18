import { api } from './client';
import { getRoutes } from './routes';

export async function getParties() {
    return api.get('/api/parties');
}

export async function getMyRoutesForParty(userId) {
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

export async function approveRequest(partyId, userId) {
    return api.post(`/api/parties/${partyId}/requests/${userId}/approve`, {});
}

export async function rejectRequest(partyId, userId) {
    return api.post(`/api/parties/${partyId}/requests/${userId}/reject`, {});
}
