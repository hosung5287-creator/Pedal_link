import { homeFeedSamples, text } from '../../constants';

// 홈 "둘러보기" 섹션의 미리보기 — 실제 피드 탭과 같은 모양의 게시물이
// 아래에서 위로 끊김 없이 흐른다.
//
// 데이터는 constants.js 의 homeFeedSamples (mock). 실제 피드를 부르지 않는다.
// 지도도 Leaflet 대신 SVG 로 그린다 — 카드가 두 벌(무한 루프용) 깔리는데
// 타일을 그만큼 받으면 홈 첫 로딩이 무거워진다.

// 경로 미리보기 — mock 좌표를 그대로 그린 선 + 시작(초록)/끝(빨강) 점
function MockRoute({ line, tone, start, end }) {
  return (
    <svg className="fmMap" viewBox="0 0 320 240" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="240" fill={tone} />
      {/* 도로 느낌의 옅은 격자 */}
      <g stroke="#ffffff" strokeWidth="10" opacity="0.55">
        <path d="M-10 70 H330 M-10 168 H330 M78 -10 V250 M232 -10 V250" />
      </g>
      {/* 경로 — 지도 탭과 같은 흰 테두리 + 민트 선 */}
      <path d={line} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d={line} fill="none" stroke="var(--mint)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={start[0]} cy={start[1]} r="7" fill="var(--good)" stroke="#ffffff" strokeWidth="3" />
      <circle cx={end[0]} cy={end[1]} r="7" fill="var(--crit)" stroke="#ffffff" strokeWidth="3" />
    </svg>
  );
}

// 피드 탭의 게시물(.feedPost)과 같은 구성 — 아바타 / 메타 / 본문 / 미디어 / 액션
function MarqueePost({ item }) {
  return (
    <article className="fmPost">
      <span className="fmAvatar" aria-hidden="true">{item.author.charAt(0)}</span>

      <div className="fmBody">
        <p className="fmMeta">
          <strong>{item.author}</strong>
          <span>· {item.place}</span>
          <span>· {item.time}</span>
        </p>

        <p className="fmText">{item.body}</p>

        <div className="fmMedia">
          {/* 사진이 있으면 사진, 없으면 경로 그림 (둘 다 홈 소개용 mock) */}
          {item.photo
            ? <img className="fmPhoto" src={item.photo} alt="" loading="lazy" />
            : <MockRoute line={item.line} tone={item.tone} start={item.start} end={item.end} />}
          <div className="fmMediaBar">
            <span className="fmMediaInfo">
              <strong>{item.routeName}</strong>
              <span>{item.distance} · ↑{item.ascend} · {item.duration}</span>
            </span>
            <span className="fmMediaBtn">{text.browseOpenMap}</span>
          </div>
        </div>

        <p className="fmActions">
          <span className="fmLike">♥ {item.likes}</span>
          <span>💬 {item.comments}</span>
          <span>↗ {item.shares}</span>
        </p>
      </div>
    </article>
  );
}

export default function FeedMarquee() {
  // 같은 목록을 두 번 깔고 -50% 까지 밀면 이음매 없이 반복된다
  const loop = [...homeFeedSamples, ...homeFeedSamples];

  return (
    <div className="feedMarquee" aria-hidden="true">
      <div className="fmViewport">
        <div className="fmTrack">
          {loop.map((item, i) => <MarqueePost key={`${item.routeName}-${i}`} item={item} />)}
        </div>
      </div>
    </div>
  );
}
