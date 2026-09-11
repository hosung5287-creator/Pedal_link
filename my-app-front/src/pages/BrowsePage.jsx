import '../styles/browse.css';

import BrandLogo from '../components/BrandLogo';

import { useEffect, useState } from 'react';
import { text } from '../constants';
import { getFeed, toggleLike } from '../api/feed';
import RouteMapThumbnail from '../components/RouteMapThumbnail';
import ComposePostModal from '../components/ComposePostModal';
import FeedSidebar from '../components/FeedSidebar';

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
    <svg viewBox="0 0 24 24" width="18" height="18"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

// 상대 시각 — "7분" / "6시간" / "3일"
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간`;
  return `${Math.floor(hour / 24)}일`;
}

// 피드 게시물 한 개.
// 카드 박스가 아니라 구분선으로 나뉘는 타임라인 형태다 (X/Threads 계열).
// 순서: 작성자 한 줄 → 본문 → 미디어(코스 정보 바 포함) → 액션
function FeedCard({ item, isLoggedIn, onLike, onLoginNeeded, onOpenMap }) {
  // 작성 모달로 쓴 태그가 있으면 그걸 쓰고, 없으면 데이터에서 유도한다
  const tags = item.tags?.length ? item.tags : buildTags(item);
  const avatarLetter = (item.authorName || '?').trim().charAt(0);

  const body = item.description
    || (item.fromLabel && item.toLabel
      ? `${item.fromLabel}에서 ${item.toLabel}까지 이어지는 코스입니다.`
      : '');

  return (
    <article className="feedPost">
      <span className="feedAvatar" aria-hidden="true">{avatarLetter}</span>

      <div className="feedBody">
        {/* 이름 · 위치 · 시간을 한 줄로 (레퍼런스의 "Gustave Flowbert in Marketplace · 42m") */}
        <p className="feedMeta">
          <strong>{item.authorName}</strong>
          {item.fromLabel && <span className="feedMetaPlace">{item.fromLabel}</span>}
          {timeAgo(item.createdAt) && <span className="feedMetaTime">{timeAgo(item.createdAt)}</span>}
        </p>

        {body && <p className="feedText">{body}</p>}
        {tags.length > 0 && <p className="feedTags">{tags.map(t => `#${t}`).join(' ')}</p>}

        <div className="feedMedia">
          {item.photo
            ? <img className="feedPhoto" src={item.photo} alt="" loading="lazy" />
            : <RouteMapThumbnail path={item.path} />}

          {/* 미디어 하단 바 — 코스 이름·거리 + 지도로 보기 (레퍼런스의 "Billie · Template | Copy") */}
          <div className="feedMediaBar">
            <span className="feedMediaInfo">
              <strong>{item.routeName || `${item.fromLabel} → ${item.toLabel}`}</strong>
              <span>
                {item.distanceKm != null ? `${item.distanceKm}km` : '-'}
                {item.ascendM != null ? ` · ↑${item.ascendM}m` : ''}
                {item.timeMin != null ? ` · ${formatDuration(item.timeMin)}` : ''}
              </span>
            </span>
            <button type="button" className="feedMediaBtn" onClick={onOpenMap}>
              {text.browseOpenMap}
            </button>
          </div>
        </div>

        <div className="feedActions">
          <button
            type="button"
            className={`feedAction${item.liked ? ' isLiked' : ''}`}
            aria-pressed={item.liked}
            aria-label={item.liked ? text.browseUnlike : text.browseLike}
            onClick={() => (isLoggedIn ? onLike(item.id) : onLoginNeeded())}
          >
            <HeartIcon filled={item.liked} />
            {item.likeCount}
          </button>

          <button type="button" className="feedAction" disabled title={text.browsePreparing} aria-label={text.browseComment}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.6-.7L3 21l1.9-4.9A8.3 8.3 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
            </svg>
            0
          </button>

          <button type="button" className="feedAction" disabled title={text.browsePreparing} aria-label={text.browseShare}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="m8.6 10.6 6.8-4M8.6 13.4l6.8 4" />
            </svg>
            0
          </button>

          <button type="button" className="feedAction feedBookmark" disabled title={text.browsePreparing} aria-label={text.browseSave}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M6 3h12v18l-6-4.5L6 21z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BrowsePage({ user, onMoveHome, onMoveLogin, onOpenMap, onMoveParty, onMoveBrowse , onMoveCrew}) {
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
        <a className="brand" href="/" onClick={onMoveHome}><BrandLogo className="brandLogo" />PedalLink</a>
        <div className="navLinks">
          <a href="/browse" onClick={onMoveBrowse}>{text.feed}</a>
          <a href="/party" onClick={onMoveParty}>{text.party}</a>
          <a href="/crew" onClick={onMoveCrew}>{text.crew}</a>
          <a href="/map" onClick={onOpenMap}>{text.makeCourse}</a>
        </div>
        <a className="signupBackLink" href="/" onClick={onMoveHome}>{text.partyBackHome}</a>
      </nav>

      <header className="browseHero">
        <div className="browseHeroText">
          <p className="eyebrow">{text.browseEyebrow}</p>
          <h1>{text.feedTitle}</h1>
        </div>
        <button type="button" className="composeBtn" onClick={openCompose}>{text.browseCompose}</button>
      </header>

      {/* 피드(왼쪽) + 랭킹 사이드바(오른쪽) 2단 */}
      <div className="feedLayout">
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
              onOpenMap={onOpenMap}
            />
          ))}
        </main>

        <FeedSidebar items={items} onOpenMap={onOpenMap} />
      </div>

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
