// 카드 위 선 그림 — 코스(등고선 위 경로) · 파티(모이는 라이더) · 피드(쌓인 게시물)
const ART = {
  course: (
    <>
      <path d="M20 118c30-30 62-34 96-22s72 4 104-30" opacity="0.35" />
      <path d="M20 92c30-26 62-30 96-18s72 2 104-28" opacity="0.35" />
      <path d="M20 66c30-22 62-26 96-14s72 0 104-26" opacity="0.35" />
      <path d="M46 124C70 84 96 110 120 82s46-14 74-50" strokeWidth="2.4" />
      <circle cx="46" cy="124" r="6" />
      <circle cx="194" cy="32" r="6" />
    </>
  ),
  party: (
    <>
      <circle cx="120" cy="76" r="22" opacity="0.8" />
      <circle cx="120" cy="76" r="44" opacity="0.5" />
      <circle cx="120" cy="76" r="66" opacity="0.28" />
      <circle cx="120" cy="76" r="5" strokeWidth="2.4" />
      <circle cx="84" cy="50" r="7" />
      <circle cx="160" cy="44" r="7" />
      <circle cx="166" cy="104" r="7" />
      <circle cx="76" cy="108" r="7" />
    </>
  ),
  feed: (
    <>
      <rect x="66" y="14" width="124" height="84" rx="8" opacity="0.3" />
      <rect x="56" y="30" width="124" height="84" rx="8" opacity="0.55" />
      <rect x="46" y="46" width="124" height="92" rx="8" />
      <path d="M58 112c16-22 30-8 44-20s24-10 54-26" strokeWidth="2.4" />
      <circle cx="62" cy="62" r="5" />
    </>
  ),
};

// 시작 카드 3장 — 공통 틀의 오른쪽 화면 자리에 들어간다. 카드 전체가 버튼.
export default function StartCards({ cards, onCourse, onParty, onFeed }) {
  const actions = { course: onCourse, party: onParty, feed: onFeed };
  return (
    <div className="lxCards">
      {cards.map((c) => (
        <button key={c.id} type="button" className="lxCard" onClick={actions[c.id]}>
          <span className="lxCardTag">{c.tag}</span>
          <svg className="lxCardArt" viewBox="0 0 240 152" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ART[c.id]}
          </svg>
          <strong className="lxCardTitle">{c.title}</strong>
          <span className="lxCardText">{c.text}</span>
          <span className="lxCardCta">{c.cta}<span aria-hidden="true">→</span></span>
        </button>
      ))}
    </div>
  );
}
