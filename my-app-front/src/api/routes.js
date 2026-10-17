// 경로(Route) 관련 백엔드 호출.
// 백엔드 컨트롤러: RouteController (/api/routes), CyclewayController (/api/cycleways)
// 필드 이름은 백엔드 DTO(RouteRequest/RouteResponse)와 1:1로 맞춘다.
import { api } from './client';

// 자전거도로 GeoJSON 조회
export const getCycleways = () => api.get('/api/cycleways');

// 저장된 경로 목록 — 기본은 내 코스만.
// includeSaved: true 면 피드에서 저장(북마크)한 다른 사람의 코스도 함께 온다 (bookmarked: true, authorName 포함)
export const getRoutes = (userId, { includeSaved = false } = {}) =>
  api.get(`/api/routes?userId=${userId}${includeSaved ? '&includeSaved=true' : ''}`);

// 경로 1개 상세 (bikeRoute / shortestRoute 좌표 포함)
export const getRouteById = (id) => api.get(`/api/routes/${id}`);

// 경로 저장. route 형태는 백엔드 RouteRequest 와 동일:
// { routeName, fromLat, fromLng, fromLabel, toLat, toLng, toLabel,
//   bikeRoute: [{lat,lng}], shortestRoute: [{lat,lng}] }
export const saveRoute = (route) => api.post('/api/routes', route);

// 저장된 경로 목록에서 지우기 → { deleted, unsaved }
// 내 코스는 삭제되고, 저장한 다른 사람의 코스는 저장만 취소된다(원래 코스는 그대로).
export const deleteRoutes = (userId, ids) => api.post('/api/routes/delete', { userId, ids });
