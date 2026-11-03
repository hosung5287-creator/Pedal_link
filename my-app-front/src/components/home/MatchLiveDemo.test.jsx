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

test('라이더 칩에 마우스를 올리면 칩·핀이 함께 강조되고 핀에 이름·거리가 뜬다', () => {
  render(<MatchLiveDemo />);
  const [, soyeon] = t.riders;
  const row = screen.getByText(soyeon.name).closest('li');
  fireEvent.pointerEnter(row);
  expect(row).toHaveClass('isHover');
  expect(document.querySelector('.mldPin.isHover')).toBeInTheDocument();
  expect(screen.getByText(`${soyeon.name} · ${soyeon.far}`)).toBeInTheDocument();
  fireEvent.pointerLeave(row);
  expect(row).not.toHaveClass('isHover');
});

// jsdom 에는 PointerEvent 가 없어 좌표가 전달되도록 만들어 준다
class TestPointerEvent extends MouseEvent {
  constructor(type, init) { super(type, init); this.pointerType = init?.pointerType ?? 'mouse'; }
}

test('지도에 마우스를 올리면 민재가 커서를 따라가고, 원 안에서만 근처 알림이 뜬다', () => {
  window.PointerEvent = TestPointerEvent;
  render(<MatchLiveDemo />);
  const map = document.querySelector('.mldMap');
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });

  // 원 밖 (나는 500,190 / 반지름 190)
  fireEvent.pointerMove(map, { clientX: 950, clientY: 450 });
  expect(screen.queryByText(t.nearAlert)).toBeNull();
  expect(minjaeRow()).not.toHaveClass('isNear');
  expect(document.querySelector('.mldPin.isCursor')).toBeInTheDocument();

  // 원 안
  fireEvent.pointerMove(map, { clientX: 500, clientY: 285 });
  expect(screen.getByText(t.nearAlert)).toBeInTheDocument();
  expect(minjaeRow()).toHaveClass('isNear');
  expect(screen.getByText(`${t.riders[0].name} · 25m`)).toBeInTheDocument();

  // 벗어나면 커서 해제
  fireEvent.pointerLeave(map);
  expect(document.querySelector('.mldPin.isCursor')).toBeNull();
  delete window.PointerEvent;
});
