import { fireEvent, render, screen } from '@testing-library/react';
import { homeCourse } from '../../constants';

const motionState = vi.hoisted(() => ({ reduced: false }));
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useInView: () => true,
    useReducedMotion: () => motionState.reduced,
  };
});

const { default: ShowcaseSection } = await import('./ShowcaseSection');
const copy = homeCourse.video.copy;

let playSpy;
let pauseSpy;
beforeEach(() => {
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { motionState.reduced = false; vi.restoreAllMocks(); });

test('코스 섹션은 아코디언 없이 음소거 시연 영상만 보여 준다', () => {
  render(<ShowcaseSection {...homeCourse} />);
  expect(screen.getByLabelText(copy.aria).muted).toBe(true);
  expect(screen.queryByRole('group', { name: homeCourse.accordionLabel })).not.toBeInTheDocument();
});

test('화면에 보이면 자동 재생되고, 버튼으로 멈췄다 다시 재생한다', () => {
  render(<ShowcaseSection {...homeCourse} />);
  expect(playSpy).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: copy.pause }));
  expect(pauseSpy).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: copy.play }));
  expect(playSpy).toHaveBeenCalledTimes(2);
});

test('움직임 줄이기 설정이면 자동 재생하지 않는다', () => {
  motionState.reduced = true;
  render(<ShowcaseSection {...homeCourse} />);
  expect(playSpy).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: copy.play })).toBeInTheDocument();
});

test('단계 표시: 지금 단계를 표시하고, 누르면 영상이 그 단계로 이동한다', () => {
  render(<ShowcaseSection {...homeCourse} />);
  const steps = homeCourse.video.steps;
  expect(screen.getByRole('button', { name: new RegExp(steps[0].title) })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('button', { name: new RegExp(steps[2].title) }));
  expect(screen.getByLabelText(copy.aria).currentTime).toBeCloseTo(steps[2].at);
  expect(screen.getByRole('button', { name: new RegExp(steps[2].title) })).toHaveAttribute('aria-current', 'step');
});
