import { render, screen } from '@testing-library/react';
import App from './App';
import { homeDraft, text } from './constants';

afterEach(() => window.history.pushState({}, '', '/'));

test('메인 홈(/)은 개편 뼈대를 그리고, 비로그인이면 로그인·회원가입 링크가 있다', () => {
  window.history.pushState({}, '', '/');
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: homeDraft.hero.title })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: text.login }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: text.signup }).length).toBeGreaterThan(0);
});

test('이전 홈은 /home-old 에서 그대로 볼 수 있다', () => {
  window.history.pushState({}, '', '/home-old');
  render(<App />);
  expect(screen.getByText(/다음 라이딩을 계획해보세요/i)).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
  expect(screen.getByText(/지도 위에서 바로 코스를 그리세요/i)).toBeInTheDocument();
});
