import { act, fireEvent, render, screen } from '@testing-library/react';
import { homeDraft } from '../../constants';

const state = vi.hoisted(() => ({ inView: true, reduced: false }));
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  // jsdom 에서는 퇴장 애니메이션이 끝나지 않으므로, 화면 교체는 즉시 일어나게 한다(로직만 검증)
  return {
    ...mod,
    AnimatePresence: ({ children }) => children,
    useInView: () => state.inView,
    useReducedMotion: () => state.reduced,
  };
});

const { default: DayLiveDemo } = await import('./DayLiveDemo');
const t = homeDraft.action.demo;
const steps = t.steps;
const current = () => screen.getByRole('button', { current: 'step' });
const phone = () => screen.getByRole('img', { name: new RegExp(t.aria) });
// 화면 전환(퇴장 → 등장) 애니메이션이 끝나도록 시간을 흘린다
const settle = () => act(() => { vi.advanceTimersByTime(600); });

beforeEach(() => { state.inView = true; state.reduced = false; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

test('단계마다 정해진 시간 뒤 다음 단계로, 마지막 다음은 처음으로', () => {
  render(<DayLiveDemo />);
  expect(current()).toHaveTextContent(steps[0].title);
  steps.forEach((s, i) => {
    act(() => { vi.advanceTimersByTime(s.ms); });
    expect(current()).toHaveTextContent(steps[(i + 1) % steps.length].title);
  });
});

test('폰 화면 라벨은 현재 단계를 설명한다', () => {
  render(<DayLiveDemo />);
  expect(phone()).toHaveAccessibleName(`${t.aria}: ${steps[0].title} — ${steps[0].desc}`);
});

test('단계 자막을 누르면 그 단계로 이동한다', () => {
  render(<DayLiveDemo />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(steps[4].title) }));
  expect(current()).toHaveTextContent(steps[4].title);
  settle();
  expect(screen.getByText(steps[4].saved)).toBeInTheDocument();
});

test('일시정지하면 멈추고, 재생하면 이어간다', () => {
  render(<DayLiveDemo />);
  fireEvent.click(screen.getByRole('button', { name: t.pause }));
  expect(screen.getByRole('button', { name: t.play })).toHaveAttribute('aria-pressed', 'true');
  act(() => { vi.advanceTimersByTime(20000); });
  expect(current()).toHaveTextContent(steps[0].title);
  fireEvent.click(screen.getByRole('button', { name: t.play }));
  act(() => { vi.advanceTimersByTime(steps[0].ms); });
  expect(current()).toHaveTextContent(steps[1].title);
});

test('화면 밖이면 자동 진행을 멈춘다', () => {
  state.inView = false;
  render(<DayLiveDemo />);
  act(() => { vi.advanceTimersByTime(20000); });
  expect(current()).toHaveTextContent(steps[0].title);
});

test('함께 출발 단계: 카운트다운 뒤 속도·거리 숫자가 올라간다', () => {
  render(<DayLiveDemo />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(steps[3].title) }));
  fireEvent.click(screen.getByRole('button', { name: t.pause })); // 단계 고정
  settle();
  expect(screen.getByText(steps[3].countdown[0])).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1500); });
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByText('3.2')).toBeInTheDocument();
});

test('모션 줄이기면 마지막 단계 정지 화면, 자동 진행 없음, 재생 버튼 비활성', () => {
  state.reduced = true;
  render(<DayLiveDemo />);
  expect(current()).toHaveTextContent(steps[4].title);
  act(() => { vi.advanceTimersByTime(20000); });
  expect(current()).toHaveTextContent(steps[4].title);
  expect(screen.getByRole('button', { name: t.playDisabled })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(steps[3].title) }));
  expect(screen.getByText('24.5')).toBeInTheDocument(); // 정지 화면은 최종 숫자
});
