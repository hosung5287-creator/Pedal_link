import '../styles/browse.css';

import BrandLogo from '../components/BrandLogo';

import { useEffect, useRef, useState } from 'react';
import { text, GU_LIST, userProfile } from '../constants';
import { feedPhotoSrc, getFeedPage, getFeedSummary, toggleBookmark, toggleLike } from '../api/feed';
import RouteMapThumbnail from '../components/RouteMapThumbnail';
import ComposePostModal from '../components/ComposePostModal';
import FeedSidebar from '../components/FeedSidebar';
import UserProfileModal from '../components/UserProfileModal';

const FEED_PAGE_SIZE = 20; // [더 보기] 한 번에 불러오는 게시물 수

// 분 → "1시간 20분" / "45분"
function formatDuration(min) {
  if (min == null) return '-';
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// "마포구,강동구" -> ["마포구", "강동구"] (게시물 올릴 때 여러 지역을 콤마로 이어 붙여 저장한다)
function splitRegions(region) {
  return (region || '').split(',').map((r) => r.trim()).filter(Boolean);
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
function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4.5L6 21z" />
    </svg>
  );
}

// 사진이 있는 게시물 — 사진 → 코스 지도를 옆으로 넘겨 본다 (폰은 손가락, PC 는 트랙패드나 화살표 버튼).
// 지도는 처음 넘길 때 그린다 — 사진 카드마다 지도 타일을 미리 받지 않게.
function FeedSlides({ photo, path }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [mapShown, setMapShown] = useState(false);

  // 지금 몇 번째 장인지는 스크롤 위치로 정한다 — 손가락으로 넘겨도, 버튼으로 넘겨도 같다
  const onScroll = () => {
    const el = trackRef.current;
    if (!el?.clientWidth) return;
    if (el.scrollLeft > 0) setMapShown(true);
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => {
    const el = trackRef.current;
    if (i > 0) setMapShown(true);
    setIndex(i);
    el?.scrollTo?.({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="feedSlides" role="group" aria-label={text.browseSlides}>
      <div className="feedSlidesTrack" ref={trackRef} onScroll={onScroll}>
        <div className="feedSlide"><img className="feedPhoto" src={photo} alt="" loading="lazy" /></div>
        <div className="feedSlide">
          {mapShown ? <RouteMapThumbnail path={path} /> : <div className="feedSlideWait" />}
        </div>
      </div>
      {index > 0 && (
        <button type="button" className="feedSlideNav isPrev" onClick={() => go(0)} aria-label={text.browseSlidePhoto}>‹</button>
      )}
      {index < 1 && (
        <button type="button" className="feedSlideNav isNext" onClick={() => go(1)} aria-label={text.browseSlideMap}>›</button>
      )}
      <span className="feedSlideDots" aria-hidden="true">
        <i className={index === 0 ? 'isOn' : ''} />
        <i className={index === 1 ? 'isOn' : ''} />
      </span>
    </div>
  );
}

// isMine: 내가 올린 게시물이면 저장 버튼을 숨긴다(내 코스는 이미 저장된 경로 목록에 있다)
function FeedCard({ item, isLoggedIn, isMine, onLike, onBookmark, onLoginNeeded, onOpenRoute, onOpenAuthor }) {
  // 작성 모달로 쓴 태그가 있으면 그걸 쓰고, 없으면 데이터에서 유도한다
  const tags = item.tags?.length ? item.tags : buildTags(item);
  const avatarLetter = (item.authorName || '?').trim().charAt(0);

  const body = item.description
    || (item.fromLabel && item.toLabel
      ? `${item.fromLabel}에서 ${item.toLabel}까지 이어지는 코스입니다.`
      : '');

  return (
    <article className="feedPost">
      {/* 아바타는 마우스로 누르기 편하게 같이 열어 준다 — 키보드·스크린리더는 아래 이름 버튼을 쓴다 */}
      <span className="feedAvatar isClickable" aria-hidden="true" onClick={onOpenAuthor}>{avatarLetter}</span>

      <div className="feedBody">
        {/* 이름 · 위치 · 시간을 한 줄로 (레퍼런스의 "Gustave Flowbert in Marketplace · 42m") */}
        <p className="feedMeta">
          <button type="button" className="feedAuthorBtn" onClick={onOpenAuthor} aria-label={userProfile.open(item.authorName)}>
            <strong>{item.authorName}</strong>
          </button>
          {splitRegions(item.region).length > 0 && (
            <span className="feedMetaRegion">{splitRegions(item.region).join(', ')}</span>
          )}
          {item.fromLabel && <span className="feedMetaPlace">{item.fromLabel}</span>}
          {timeAgo(item.createdAt) && <span className="feedMetaTime">{timeAgo(item.createdAt)}</span>}
        </p>

        {body && <p className="feedText">{body}</p>}
        {tags.length > 0 && <p className="feedTags">{tags.map(t => `#${t}`).join(' ')}</p>}

        <div className="feedMedia">
          {item.photoUrl
            ? <FeedSlides photo={feedPhotoSrc(item.photoUrl)} path={item.path} />
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
            {/* 코스 만들기 화면에 이 코스를 바로 연다 */}
            <button type="button" className="feedMediaBtn" onClick={() => onOpenRoute(item.id)}>
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
            onClick={(e) => (isLoggedIn ? onLike(item.id) : onLoginNeeded(e))}
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

          {!isMine && (
            <button
              type="button"
              className={`feedAction feedBookmark${item.bookmarked ? ' isSaved' : ''}`}
              aria-pressed={!!item.bookmarked}
              aria-label={item.bookmarked ? text.browseUnsave : text.browseSave}
              title={item.bookmarked ? text.browseUnsave : text.browseSave}
              onClick={(e) => (isLoggedIn ? onBookmark(item.id) : onLoginNeeded(e))}
            >
              <BookmarkIcon filled={item.bookmarked} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function BrowsePage({ user, onMoveHome, onMoveLogin, onOpenMap, onOpenRoute, onMoveParty, onMoveBrowse , onMoveCrew}) {
  const isLoggedIn = !!user;
  const [toast, setToast] = useState(''); // 저장·저장 취소 안내 (잠깐 떴다 사라진다)
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [regionFilter, setRegionFilter] = useState('전체');
  const [profileTarget, setProfileTarget] = useState(null); // { id, name } — 프로필 창을 띄운 작성자
  const [page, setPage] = useState(0);            // 마지막으로 불러온 페이지
  const [hasNext, setHasNext] = useState(false);  // [더 보기] 를 보여줄지
  const [loadingMore, setLoadingMore] = useState(false);
  const [summary, setSummary] = useState(null);   // 사이드바 순위 (전체 게시물 기준)

  // 첫 페이지 — 로그인 사용자나 지역 필터가 바뀌면 처음부터 다시 받는다 (지역은 서버가 거른다)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getFeedPage(user?.id, { page: 0, size: FEED_PAGE_SIZE, region: regionFilter })
      .then((data) => {
        if (!alive) return;
        setItems(data?.items || []);
        setPage(0);
        setHasNext(!!data?.hasNext);
        setLoading(false);
      })
      .catch(() => { if (alive) { setError(text.browseLoadFailed); setLoading(false); } });
    return () => { alive = false; };
  }, [user?.id, regionFilter]);

  useEffect(() => {
    let alive = true;
    getFeedSummary(user?.id)
      .then((data) => { if (alive) setSummary(data); })
      .catch(() => { /* 사이드바는 없어도 피드는 보인다 */ });
    return () => { alive = false; };
  }, [user?.id]);

  // [더 보기] — 다음 페이지를 이어 붙인다. 그 사이 새 글이 올라와 밀린 카드는 id 로 걸러 중복을 막는다.
  const loadMore = async () => {
    if (loadingMore || !hasNext) return;
    setLoadingMore(true);
    try {
      const data = await getFeedPage(user?.id, { page: page + 1, size: FEED_PAGE_SIZE, region: regionFilter });
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        return [...prev, ...(data?.items || []).filter((it) => !seen.has(it.id))];
      });
      setPage(page + 1);
      setHasNext(!!data?.hasNext);
    } catch {
      setError(text.browseLoadFailed);
    } finally {
      setLoadingMore(false);
    }
  };

  // onMoveLogin 은 App 의 moveLogin — e.preventDefault() 를 쓰므로 이벤트를 그대로 넘겨야 한다
  const openCompose = (e) => (isLoggedIn ? setComposeOpen(true) : onMoveLogin(e));

  const shownItems = items;

  // 작성자 프로필 창 — 로그인한 사람만 볼 수 있다(비로그인이면 로그인 화면으로)
  const openAuthor = (e, item) => {
    if (!isLoggedIn) return onMoveLogin(e);
    if (item.authorId == null) return;
    setProfileTarget({ id: item.authorId, name: item.authorName });
  };

  // 올린 게시물을 목록 맨 앞으로 (이미 있던 카드면 교체)
  const handlePublished = (card) => {
    setItems(prev => [card, ...prev.filter(it => it.id !== card.id)]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 북마크(저장) — 다른 사람의 코스를 코스 만들기의 "저장된 경로" 목록에 담는다. 먼저 표시를 바꾸고 서버 값으로 맞춘다.
  const handleBookmark = async (routeId) => {
    const before = items;
    setItems((prev) => prev.map((it) => (it.id === routeId ? { ...it, bookmarked: !it.bookmarked } : it)));
    try {
      const res = await toggleBookmark(routeId, user.id);
      setItems((prev) => prev.map((it) => (it.id === routeId ? { ...it, bookmarked: res.bookmarked } : it)));
      showToast(res.bookmarked ? text.browseSavedToast : text.browseUnsavedToast);
    } catch {
      setItems(before);
      showToast(text.browseSaveFailed);
    }
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
        <div className="browseHeroActions">
          <label className="browseRegionFilter">
            <span>{text.regionLabel}</span>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="전체">{text.regionAll}</option>
              {GU_LIST.map((gu) => <option key={gu} value={gu}>{gu}</option>)}
            </select>
          </label>
          <button type="button" className="composeBtn" onClick={openCompose}>{text.browseCompose}</button>
        </div>
      </header>

      {/* 피드(왼쪽) + 랭킹 사이드바(오른쪽) 2단 */}
      <div className="feedLayout">
        <main className="feedList">
          {loading && <p className="browseEmpty">{text.browseLoading}</p>}
          {error && <p className="browseEmpty">{error}</p>}
          {!loading && !error && shownItems.length === 0 && (
            <p className="browseEmpty">{text.browseNoFeed}</p>
          )}
          {shownItems.map(item => (
            <FeedCard
              key={item.id}
              item={item}
              isLoggedIn={isLoggedIn}
              isMine={isLoggedIn && item.authorId === user.id}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onLoginNeeded={onMoveLogin}
              onOpenRoute={onOpenRoute}
              onOpenAuthor={(e) => openAuthor(e, item)}
            />
          ))}
          {!loading && hasNext && (
            <button type="button" className="feedMoreBtn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? text.browseLoading : text.browseMore}
            </button>
          )}
        </main>

        <FeedSidebar summary={summary} onOpenMap={onOpenMap} />
      </div>

      {profileTarget && (
        <UserProfileModal
          userId={profileTarget.id}
          name={profileTarget.name}
          isMe={profileTarget.id === user?.id}
          onClose={() => setProfileTarget(null)}
        />
      )}

      <div className={`feedToast${toast ? ' isShown' : ''}`} role="status" aria-live="polite">{toast}</div>

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
