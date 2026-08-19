import { useEffect, useState } from 'react';
import { text } from '../constants';
import heroBg from '../backglound1.png';
import { getFeed, toggleLike } from '../api/feed';
import RouteThumbnail from '../components/RouteThumbnail';
import ComposePostModal from '../components/ComposePostModal';

// 분 → "1시간 20분" / "45분"
function formatDuration(min) {
  if (min == null) return '-';
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// 저장된 데이터에서 해시태그를 유도한다 (별도 태그 입력 기능이 아직 없으므로)
function buildTags({ distanceKm, fromLabel, toLabel }) {
  const tags = [];
  if (distanceKm != null) {
    if (distanceKm <= 10) tags.push('가벼운코스');
    else if (distanceKm <= 25) tags.push('초보코스');
    else if (distanceKm <= 50) tags.push('중급코스');
    else tags.push('장거리');
  }
  if (fromLabel) tags.push(fromLabel.replace(/\s/g, ''));
  if (toLabel && toLabel !== fromLabel) tags.push(toLabel.replace(/\s/g, ''));
  return tags;
}

function HeartIcon({ filled }) {
  return (
    // 색은 버튼의 color 를 따라간다 (App.css 의 .feedIconBtn / .isLiked)
    <svg viewBox="0 0 24 24" width="24" height="24"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function FeedCard({ item, isLoggedIn, onLike, onLoginNeeded }) {
  // 작성 모달로 쓴 태그가 있으면 그걸 쓰고, 없으면 데이터에서 유도한다
  const tags = item.tags?.length ? item.tags : buildTags(item);
  const avatarLetter = (item.authorName || '?').trim().charAt(0);

  return (
    <article className="feedCard">
      <header className="feedHead">
        <span className="feedAvatar" aria-hidden="true">{avatarLetter}</span>
        <div className="feedHeadText">
          <strong>{item.authorName}</strong>
          <p>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {item.fromLabel || '위치 정보 없음'}
          </p>
        </div>
      </header>

      <RouteThumbnail path={item.path} />

      <dl className="feedStats">
        <div>
          <dt>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </dt>
          <dd>{item.distanceKm != null ? `${item.distanceKm}km` : '-'}</dd>
        </div>
        <div>
          <dt>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M3 20 12 5l9 15z" />
            </svg>
          </dt>
          <dd>{item.ascendM != null ? `${item.ascendM}m` : '-'}</dd>
        </div>
        <div>
          <dt>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </dt>
          <dd>{formatDuration(item.timeMin)}</dd>
        </div>
      </dl>

      <div className="feedActions">
        <button
          type="button"
          className={`feedIconBtn${item.liked ? ' isLiked' : ''}`}
          aria-pressed={item.liked}
          aria-label={item.liked ? text.browseUnlike : text.browseLike}
          onClick={() => (isLoggedIn ? onLike(item.id) : onLoginNeeded())}
        >
          <HeartIcon filled={item.liked} />
        </button>

        <button type="button" className="feedIconBtn" disabled title={text.browsePreparing} aria-label={text.browseComment}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.6-.7L3 21l1.9-4.9A8.3 8.3 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
          </svg>
        </button>

        <button type="button" className="feedIconBtn" disabled title={text.browsePreparing} aria-label={text.browseShare}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="m8.6 10.6 6.8-4M8.6 13.4l6.8 4" />
          </svg>
        </button>

        <button type="button" className="feedIconBtn feedBookmark" disabled title={text.browsePreparing} aria-label={text.browseSave}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M6 3h12v18l-6-4.5L6 21z" />
          </svg>
        </button>
      </div>

      <div className="feedCaption">
        <strong className="feedLikes">{item.likeCount} likes</strong>
        <p className="feedTitle">
          <strong>{item.authorName}</strong> {item.routeName}
        </p>
        {item.description ? (
          <p className="feedDesc">{item.description}</p>
        ) : item.fromLabel && item.toLabel ? (
          <p className="feedDesc">{item.fromLabel}에서 {item.toLabel}까지 이어지는 코스입니다.</p>
        ) : null}
        {tags.length > 0 && (
          <p className="feedTags">{tags.map(t => `#${t}`).join(' ')}</p>
        )}
      </div>
    </article>
  );
}

export default function BrowsePage({ user, onMoveHome, onMoveLogin }) {
  const isLoggedIn = !!user;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getFeed(user?.id)
      .then((data) => { if (alive) { setItems(data || []); setLoading(false); } })
      .catch(() => { if (alive) { setError(text.browseLoadFailed); setLoading(false); } });
    return () => { alive = false; };
  }, [user?.id]);

  const openCompose = () => (isLoggedIn ? setComposeOpen(true) : onMoveLogin());

  // 올린 게시물을 목록 맨 앞으로 (이미 있던 카드면 교체)
  const handlePublished = (card) => {
    setItems(prev => [card, ...prev.filter(it => it.id !== card.id)]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 낙관적 업데이트 — 하트를 먼저 칠하고, 서버 응답으로 정확한 값을 맞춘다
  const handleLike = async (routeId) => {
    const before = items;
    setItems(prev => prev.map(it => it.id === routeId
      ? { ...it, liked: !it.liked, likeCount: it.likeCount + (it.liked ? -1 : 1) }
      : it));

    try {
      const res = await toggleLike(routeId, user.id);
      setItems(prev => prev.map(it => it.id === routeId
        ? { ...it, liked: res.liked, likeCount: res.likeCount }
        : it));
    } catch {
      setItems(before);   // 실패하면 되돌린다
    }
  };

  return (
    <div className="browsePage">
      <nav className="navbar browseNav" aria-label={text.nav}>
        <a className="brand" href="/" onClick={onMoveHome}>PedalLink</a>
        <div className="browseNavActions">
          <button type="button" className="composeBtn" onClick={openCompose}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {text.browseCompose}
          </button>
          <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
        </div>
      </nav>

      <header className="browseHero" style={{ backgroundImage: `url(${heroBg})` }}>
        <p className="eyebrow">{text.browseEyebrow}</p>
        <h1>{text.browse}</h1>
        <p className="browseHeroSub">{text.browseSub}</p>
      </header>

      <main className="feedList">
        {loading && <p className="browseEmpty">{text.browseLoading}</p>}
        {error && <p className="browseEmpty">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="browseEmpty">{text.browseNoFeed}</p>
        )}
        {items.map(item => (
          <FeedCard
            key={item.id}
            item={item}
            isLoggedIn={isLoggedIn}
            onLike={handleLike}
            onLoginNeeded={onMoveLogin}
          />
        ))}
      </main>

      {composeOpen && (
        <ComposePostModal
          user={user}
          onClose={() => setComposeOpen(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
