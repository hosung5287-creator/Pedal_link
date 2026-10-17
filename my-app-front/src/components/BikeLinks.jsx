import '../styles/bikelinks.css';

import { bikeLinks as t } from '../constants';
import { splitBikes, bikeSearchQuery, bikeSearchUrl } from '../utils/bike';

// 보유 자전거 이름을 구글 검색 링크로 보여준다 — 쉼표로 적은 여러 대는 대마다 따로 링크.
// 내 프로필(ProfilePage)과 다른 라이더 프로필 창(UserProfileModal)이 같이 쓴다.
export default function BikeLinks({ info }) {
  const bikes = splitBikes(info);
  if (bikes.length === 0) return <span>-</span>;

  return (
    <span className="bikeLinks">
      {bikes.map((name) => {
        const query = bikeSearchQuery(name);
        return (
          <a
            key={name}
            className="bikeLink"
            href={bikeSearchUrl(name)}
            target="_blank"
            rel="noopener noreferrer"
            title={t.title(query)}
            aria-label={t.label(query)}
          >
            {name}<span className="bikeLinkIcon" aria-hidden="true">↗</span>
          </a>
        );
      })}
    </span>
  );
}
