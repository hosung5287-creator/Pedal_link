import { useMemo } from 'react';
import { feedSide as t } from '../constants';
import RouteMapThumbnail from './RouteMapThumbnail';

// 피드 오른쪽 사이드바 — 인기 코스 / 활발한 지역.
//
// 별도 통계 API 가 없어서 피드 데이터에서 바로 계산한다.
// (좋아요 합계 = 인기, 출발지 등장 횟수 = 그 지역 활동량)
// 나중에 서버에 랭킹 API 가 생기면 이 계산만 교체하면 된다.

function rankRoutes(items) {
  return [...items]
    .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
    .slice(0, 5);
}

function rankRegions(items) {
  const counts = new Map();
  for (const it of items) {
    // "서울 강남구 …" 처럼 긴 주소는 앞 두 덩어리만 지역으로 본다
    const label = (it.fromLabel || '').trim();
    if (!label) continue;
    const key = label.split(/\s+/).slice(0, 2).join(' ');
    const prev = counts.get(key) || { name: key, posts: 0, riders: new Set() };
    prev.posts += 1;
    if (it.authorId != null) prev.riders.add(it.authorId);
    counts.set(key, prev);
  }
  return [...counts.values()]
    .map((r) => ({ name: r.name, posts: r.posts, riders: r.riders.size }))
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 5);
}

export default function FeedSidebar({ items, onOpenMap }) {
  const topRoutes = useMemo(() => rankRoutes(items), [items]);
  const topRegions = useMemo(() => rankRegions(items), [items]);
  const maxPosts = topRegions[0]?.posts || 1;

  if (items.length === 0) return null;

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
