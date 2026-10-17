// 둘러보기 피드 관련 백엔드 호출.
// 백엔드 컨트롤러: FeedController (/api/feed, /api/routes/{id}/like)
import { api } from './client';

// 피드 목록. userId 를 주면 "내가 좋아요한 것"이 liked=true 로 표시된다.
export const getFeed = (userId) =>
  api.get(userId ? `/api/feed?userId=${userId}` : '/api/feed');

// 피드 한 페이지 → { items, page, size, hasNext }. region 은 구 이름("마포구"), '전체'·빈 값이면 전체.
export const getFeedPage = (userId, { page = 0, size = 20, region } = {}) => {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (userId) q.set('userId', String(userId));
  if (region && region !== '전체') q.set('region', region);
  return api.get(`/api/feed/page?${q}`);
};

// 피드 사이드바 순위 → { topRoutes: [카드], topRegions: [{ name, posts, riders }] } (전체 게시물 기준)
export const getFeedSummary = (userId) =>
  api.get(userId ? `/api/feed/summary?userId=${userId}` : '/api/feed/summary');

// 북마크(저장) 토글 — 다른 사람의 코스를 코스 만들기의 "저장된 경로" 목록에 담거나 뺀다 → { bookmarked }
export const toggleBookmark = (routeId, userId) =>
  api.post(`/api/routes/${routeId}/bookmark`, { userId });

// 좋아요 토글 → { liked, likeCount }
export const toggleLike = (routeId, userId) =>
  api.post(`/api/routes/${routeId}/like`, { userId });

// 게시물 올리기 — 저장된 내 경로에 문구·해시태그·사진을 붙인다. 갱신된 카드 1장을 돌려준다.
// photo 는 브라우저에서 줄인 JPEG data URL (utils/image.js). 없으면 null.
// region 은 보내지 않으면 코스에 저장된 지역(고른 구 또는 출발점 기준)을 그대로 쓴다 — 글쓰기 화면은 보내지 않는다.
export const publishPost = (routeId, { userId, description, tags, photo, region }) =>
  api.post(`/api/routes/${routeId}/post`, {
    userId: String(userId), description, tags, photo, region,
  });
