import { useMemo } from 'react';
import { routes, text } from '../../constants';
import useReveal from '../../utils/useReveal';

export default function RecentRoutes() {
  // 캐러셀이 끊김 없이 이어지도록 목록을 두 번 이어붙인다
  const routeLoop = useMemo(() => [...routes, ...routes], []);
  const ref = useReveal();

  return (
    <section className="recentRoutes reveal" aria-labelledby="recent-title" ref={ref}>
      <div className="sectionHeader revealItem">
        <h2 id="recent-title">{text.recentTitle}</h2>
      </div>
      <div className="routeCarousel revealItem" style={{ '--delay': '80ms' }} aria-label={text.recentAria}>
        <div className="routeTrack">
          {routeLoop.map((route, index) => (
            <article className="routeCard" key={`${route.title}-${index}`}>
              <img src={route.image} alt="" loading="lazy" decoding="async" />
              <div className="routeBody">
                <span>{route.type}</span>
                <h3>{route.title}</h3>
                <p>{route.location}</p>
                <dl>
                  <div><dt>{text.distance}</dt><dd>{route.distance}</dd></div>
                  <div><dt>{text.climb}</dt><dd>{route.climb}</dd></div>
                  <div><dt>{text.time}</dt><dd>{route.time}</dd></div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
