// 경로(Route) 관련 백엔드 호출.
// 백엔드 컨트롤러: RouteController (/api/routes), CyclewayController (/api/cycleways)
// 필드 이름은 백엔드 DTO(RouteRequest/RouteResponse)와 1:1로 맞춘다.
import { api } from './client';

// 자전거도로 GeoJSON 조회
export const getCycleways = () => api.get('/api/cycleways');

// 저장된 경로 목록 (userId 있으면 해당 유저 것만)
export const getRoutes = (userId) =>
  api.get(userId ? `/api/routes?userId=${userId}` : '/api/routes');

// 경로 1개 상세 (bikeRoute / shortestRoute 좌표 포함)
export const getRouteById = (id) => api.get(`/api/routes/${id}`);

// 경로 저장. route 형태는 백엔드 RouteRequest 와 동일:
// { routeName, fromLat, fromLng, fromLabel, toLat, toLng, toLabel,
//   bikeRoute: [{lat,lng}], shortestRoute: [{lat,lng}] }
export const saveRoute = (route) => api.post('/api/routes', route);

// 경로 삭제 (ids: number[])
export const deleteRoutes = (ids) => api.post('/api/routes/delete', ids);
