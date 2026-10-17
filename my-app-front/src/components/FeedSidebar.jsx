import { feedSide as t } from '../constants';
import RouteMapThumbnail from './RouteMapThumbnail';

// 피드 오른쪽 사이드바 — 인기 코스 / 활발한 지역.
//
// 피드를 20개씩 나눠 받기 때문에 순위는 서버(GET /api/feed/summary)가 전체 게시물로 계산해 준다.
// (좋아요 수 = 인기, 출발지 앞 두 단어("서울 마포구")별 게시물 수 = 그 지역 활동량)
// summary: { topRoutes: [피드 카드], topRegions: [{ name, posts, riders }] }

export default function FeedSidebar({ summary, onOpenMap }) {
  const topRoutes = summary?.topRoutes || [];
  const topRegions = summary?.topRegions || [];
  const maxPosts = topRegions[0]?.posts || 1;

  if (topRoutes.length === 0 && topRegions.length === 0) return null;

  return (
    <aside className="feedSide" aria-label={t.aria}>
      <section className="sideCard">
        <header className="sideHead">
          <h2>{t.topRoutes}</h2>
          <button type="button" className="sideMore" onClick={onOpenMap}>{t.seeAll}</button>
        </header>

        <ul className="sideList">
          {topRoutes.map((r, i) => (
            <li key={r.id} className="sideRoute">
              <span className="sideRank" aria-hidden="true">{i + 1}</span>
              <span className="sideThumb">
                <RouteMapThumbnail path={r.path} />
              </span>
              <span className="sideRouteInfo">
                <strong>{r.routeName || `${r.fromLabel} → ${r.toLabel}`}</strong>
                <span>
                  {r.distanceKm != null ? `${r.distanceKm}km · ` : ''}
                  {t.likes} {r.likeCount || 0}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sideCard">
        <header className="sideHead">
          <h2>{t.topRegions}</h2>
        </header>

        <ul className="sideList">
          {topRegions.map((g) => (
            <li key={g.name} className="sideRegion">
              <span className="sideRegionInfo">
                <strong>{g.name}</strong>
                <span>{t.riders} {g.riders}{t.unit} · {t.courses} {g.posts}</span>
              </span>
              {/* 1위 대비 비율 막대 — 지역 간 활동량 차이를 한눈에 */}
              <span className="sideBar" aria-hidden="true">
                <span className="sideBarFill" style={{ width: `${Math.round((g.posts / maxPosts) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>

        <p className="sideNote">{t.note}</p>
      </section>
    </aside>
  );
}
