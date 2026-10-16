import { render, screen } from '@testing-library/react';
import HomeDraftPage from './HomeDraftPage';
import { homeDraft as d, homeCourse, homeMatch, homeTogether, homeBrowse } from '../constants';

test('새 홈이 구간 제목·자리표시와 이전 홈의 코스·매칭·파티·피드 섹션을 그린다', () => {
  render(<HomeDraftPage />);
  expect(screen.getByRole('heading', { level: 1, name: d.hero.title })).toBeInTheDocument();
  [homeCourse.title, homeMatch.title, homeTogether.title, homeBrowse.title, d.dock.title]
    .forEach((title) => expect(screen.getByRole('heading', { name: title })).toBeInTheDocument());
  expect(document.querySelector('.hdCard')).toBeNull(); // 신뢰 카드 제거
  // '달리는 하루' 섹션은 뺐다
  expect(screen.queryByRole('heading', { name: d.action.title })).not.toBeInTheDocument();
  // 질문(FAQ)·더 둘러보기·라이더 이야기 자리는 뺐다 — 대신 이전 홈의 흐르는 피드
  expect(document.querySelector('details')).toBeNull();
  expect(screen.queryByRole('heading', { name: '더 둘러보기' })).not.toBeInTheDocument();
  expect(document.querySelector('.feedMarquee .fmTrack')).toBeInTheDocument();
  // 크루 자리는 플로팅 버튼 시연 영상
  expect(screen.getByLabelText(d.dock.video.copy.aria)).toHaveAttribute('src', d.dock.video.src);
});
