import { act, fireEvent, render, screen } from '@testing-library/react';
import { homeMatch } from '../../constants';

// 화면 진입은 강제하고, 모션 줄이기는 테스트마다 바꾼다. useInView 옵션도 기록한다.
const motionState = vi.hoisted(() => ({ reduced: true, inViewOpts: null }));
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useInView: (_ref, opts) => { motionState.inViewOpts = opts; return true; },
    useReducedMotion: () => motionState.reduced,
  };
});

const { default: MatchLiveDemo } = await import('./MatchLiveDemo');
const t = homeMatch.demo;
const minjaeRow = () => screen.getByText(t.riders[0].name).closest('li');

afterEach(() => { motionState.reduced = true; vi.useRealTimers(); });

test('모션 줄이기면 매칭 완료까지의 최종 장면을 바로 보여준다', () => {
  render(<MatchLiveDemo />);
  expect(screen.getByRole('img', { name: t.aria })).toBeInTheDocument();
  expect(screen.getByText(t.nearAlert)).toBeInTheDocument();
  expect(screen.getByText(t.matched)).toBeInTheDocument();
  expect(minjaeRow()).toHaveClass('isNear');
});

test('일반 재생: 민재는 3.3초 뒤에 반경 안(근처)으로 바뀐다', () => {
  motionState.reduced = false;
  vi.useFakeTimers();
  render(<MatchLiveDemo />);
  expect(minjaeRow()).not.toHaveClass('isNear');
  act(() => { vi.advanceTimersByTime(3200); });
  expect(minjaeRow()).not.toHaveClass('isNear');
  act(() => { vi.advanceTimersByTime(200); });
  expect(minjaeRow()).toHaveClass('isNear');
});

test('처음 보일 때 한 번만 재생하도록 once 옵션을 쓴다', () => {
  render(<MatchLiveDemo />);
  expect(motionState.inViewOpts).toMatchObject({ once: true });
});

test('다시 보기를 누르면 처음 상태부터 다시 재생한다', () => {
  motionState.reduced = false;
  vi.useFakeTimers();
  render(<MatchLiveDemo />);
  act(() => { vi.advanceTimersByTime(4000); });
  expect(minjaeRow()).toHaveClass('isNear');
  fireEvent.click(screen.getByRole('button', { name: t.replayAria }));
  expect(minjaeRow()).not.toHaveClass('isNear');
});

test('다시 보기 버튼과 출처 링크는 그림(role=img) 밖에 있다', () => {
  render(<MatchLiveDemo />);
  const stage = screen.getByRole('img', { name: t.aria });
  expect(stage.contains(screen.getByRole('button', { name: t.replayAria }))).toBe(false);
  expect(stage.contains(screen.getByRole('link', { name: t.credit }))).toBe(false);
});
