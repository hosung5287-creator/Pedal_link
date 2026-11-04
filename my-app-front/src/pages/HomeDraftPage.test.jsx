import { render, screen } from '@testing-library/react';
import HomeDraftPage from './HomeDraftPage';
import { homeDraft as d } from '../constants';

test('새 홈이 구간 제목·자리표시와 이전 홈의 코스·매칭·파티·피드 섹션을 그린다', () => {
  render(<HomeDraftPage />);
  expect(screen.getByRole('heading', { level: 1, name: d.hero.title })).toBeInTheDocument();
  // 푸터에도 같은 이름('파티')의 제목이 있어 섹션 제목 자리에서 찾는다
  const titles = [...document.querySelectorAll('.lxIntro h2, .fsText h2')].map((h) => h.textContent);
  expect(titles).toEqual(expect.arrayContaining([d.intro.title, ...Object.values(d.sections).map((section) => section.title)]));
  // 소개 메뉴 순서
  const nav = screen.getByRole('navigation', { name: d.intro.menuLabel });
  expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['피드', '파티', '크루', '코스 만들기', '실시간 연결', 'AI 리포트']);
  expect(document.querySelector('.hdCard')).toBeNull(); // 신뢰 카드 제거
  // '달리는 하루' 섹션은 뺐다
  expect(screen.queryByRole('heading', { name: d.action.title })).not.toBeInTheDocument();
  // 질문(FAQ)·더 둘러보기·라이더 이야기 자리는 뺐다 — 대신 이전 홈의 흐르는 피드
  expect(document.querySelector('details')).toBeNull();
  expect(screen.queryByRole('heading', { name: '더 둘러보기' })).not.toBeInTheDocument();
  expect(document.querySelector('.feedMarquee .fmTrack')).toBeInTheDocument();
  // 플로팅 버튼 자리는 라이딩 기록 · AI 리포트
  expect(document.querySelector('.rrd')).toBeInTheDocument();
});

test('히어로 배경 영상: 음소거로 깔리고 일시정지 버튼이 있다', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  render(<HomeDraftPage />);
  const video = document.querySelector('.hdHeroVideo');
  expect(video).toHaveAttribute('src', d.hero.video.src);
  expect(video.muted).toBe(true);
  expect(screen.getByRole('button', { name: d.hero.video.pause })).toBeInTheDocument();
  vi.restoreAllMocks();
});
