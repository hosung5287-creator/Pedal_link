import { fireEvent, render, screen, within } from '@testing-library/react';
import BrowsePage from './BrowsePage';
import { text } from '../constants';

// ── 지도·사이드바·모달은 이 테스트와 상관없어 비워 둔다 ──
vi.mock('../components/RouteMapThumbnail', () => ({ default: () => <div data-testid="routeMap" /> }));
vi.mock('../components/FeedSidebar', () => ({ default: () => null }));
vi.mock('../components/ComposePostModal', () => ({ default: () => null }));
vi.mock('../components/UserProfileModal', () => ({ default: () => null }));

const api = vi.hoisted(() => ({ getFeedPage: vi.fn() }));
vi.mock('../api/feed', () => ({
  getFeedPage: api.getFeedPage,
  getFeedSummary: vi.fn().mockResolvedValue(null),
  toggleBookmark: vi.fn(),
  toggleLike: vi.fn(),
  feedPhotoSrc: (url) => (url ? `http://api${url}` : null),
}));

const post = (id, extra = {}) => ({
  id, routeName: `코스${id}`, fromLabel: '여의도', toLabel: '잠실', authorId: 9, authorName: '민수',
  distanceKm: 12, likeCount: 0, liked: false, bookmarked: false, createdAt: null,
  path: [{ lat: 37.5, lng: 127 }, { lat: 37.51, lng: 127.01 }], ...extra,
});

const renderFeed = async (items) => {
  api.getFeedPage.mockResolvedValueOnce({ items, page: 0, size: 20, hasNext: false });
  render(<BrowsePage user={{ id: 1, name: '나' }} onMoveLogin={vi.fn()} onOpenRoute={vi.fn()} />);
  return screen.findAllByRole('article');
};

test('사진이 있는 게시물은 사진 → 코스 지도를 넘겨 보고, 지도는 넘길 때 처음 그린다', async () => {
  const [card] = await renderFeed([post(5, { photoUrl: '/api/routes/5/photo?v=1' })]);
  const slides = within(card).getByRole('group', { name: text.browseSlides });

  expect(slides.querySelector('img.feedPhoto')).toHaveAttribute('src', 'http://api/api/routes/5/photo?v=1');
  expect(within(card).queryByTestId('routeMap')).toBeNull();
  expect(within(card).queryByRole('button', { name: text.browseSlidePhoto })).toBeNull();
  expect(slides.querySelectorAll('.feedSlideDots i.isOn')).toHaveLength(1);
  expect(slides.querySelector('.feedSlideDots i:first-child')).toHaveClass('isOn');

  fireEvent.click(within(card).getByRole('button', { name: text.browseSlideMap }));
  expect(within(card).getByTestId('routeMap')).toBeInTheDocument();
  expect(within(card).queryByRole('button', { name: text.browseSlideMap })).toBeNull();
  expect(slides.querySelector('.feedSlideDots i:last-child')).toHaveClass('isOn');

  fireEvent.click(within(card).getByRole('button', { name: text.browseSlidePhoto }));
  expect(slides.querySelector('.feedSlideDots i:first-child')).toHaveClass('isOn');
  expect(within(card).getByTestId('routeMap')).toBeInTheDocument();   // 한 번 그린 지도는 그대로 둔다
});

test('손가락으로 옆으로 넘겨도(스크롤) 지도를 그리고 점이 바뀐다', async () => {
  const [card] = await renderFeed([post(5, { photoUrl: '/api/routes/5/photo?v=1' })]);
  const track = card.querySelector('.feedSlidesTrack');
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });

  track.scrollLeft = 120;   // 넘기기 시작 — 아직 사진 쪽
  fireEvent.scroll(track);
  expect(within(card).getByTestId('routeMap')).toBeInTheDocument();
  expect(card.querySelector('.feedSlideDots i:first-child')).toHaveClass('isOn');

  track.scrollLeft = 300;   // 지도에 멈춤
  fireEvent.scroll(track);
  expect(card.querySelector('.feedSlideDots i:last-child')).toHaveClass('isOn');
});

test('사진이 없는 게시물은 지금처럼 코스 지도 한 장만 보인다', async () => {
  const [card] = await renderFeed([post(6)]);
  expect(within(card).getByTestId('routeMap')).toBeInTheDocument();
  expect(within(card).queryByRole('group', { name: text.browseSlides })).toBeNull();
  expect(card.querySelector('img.feedPhoto')).toBeNull();
});
