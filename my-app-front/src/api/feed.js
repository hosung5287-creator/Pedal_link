// 둘러보기 피드 관련 백엔드 호출.
// 백엔드 컨트롤러: FeedController (/api/feed, /api/routes/{id}/like)
import { api } from './client';

// 피드 목록. userId 를 주면 "내가 좋아요한 것"이 liked=true 로 표시된다.
export const getFeed = (userId) =>
  api.get(userId ? `/api/feed?userId=${userId}` : '/api/feed');

// 좋아요 토글 → { liked, likeCount }
export const toggleLike = (routeId, userId) =>
  api.post(`/api/routes/${routeId}/like`, { userId });

// 게시물 올리기 — 저장된 내 경로에 문구·해시태그를 붙인다. 갱신된 카드 1장을 돌려준다.
export const publishPost = (routeId, { userId, description, tags }) =>
  api.post(`/api/routes/${routeId}/post`, { userId: String(userId), description, tags });
