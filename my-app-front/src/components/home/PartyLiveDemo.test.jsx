import { act, fireEvent, render, screen } from '@testing-library/react';
import { homeParty } from '../../constants';

const motionState = vi.hoisted(() => ({ reduced: true, inViewOpts: null }));
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useInView: (_ref, opts) => { motionState.inViewOpts = opts; return true; },
    useReducedMotion: () => motionState.reduced,
  };
});

const { default: FeatureAccordion } = await import('./FeatureAccordion');
const { default: PartyLiveDemo } = await import('./PartyLiveDemo');
const t = homeParty.demoText;
const tabByIndex = (i) => screen.getByRole('button', { name: new RegExp(homeParty.features[i].title) });

const renderTabs = () => render(
  <FeatureAccordion features={homeParty.features} label={homeParty.tabsLabel} Demo={PartyLiveDemo} idPrefix="party" />,
);

afterEach(() => { motionState.reduced = true; vi.useRealTimers(); });

test('모션 줄이기: 파티 개설 장면은 파티가 열린 최종 상태(1/4)', () => {
  renderTabs();
  expect(screen.getByRole('group', { name: homeParty.tabsLabel })).toBeInTheDocument();
  expect(screen.getByText(t.opened)).toBeInTheDocument();
  expect(screen.getByText('1/4')).toBeInTheDocument();
  expect(motionState.inViewOpts).toMatchObject({ once: true });
});

test('일반 재생: 개설은 0/4 → 2.6초 뒤 1/4·"파티가 열렸어요"', () => {
  motionState.reduced = false;
  vi.useFakeTimers();
  renderTabs();
  expect(screen.getByText('0/4')).toBeInTheDocument();
  expect(screen.queryByText(t.opened)).toBeNull();
  act(() => { vi.advanceTimersByTime(2600); });
  expect(screen.getByText('1/4')).toBeInTheDocument();
  expect(screen.getByText(t.opened)).toBeInTheDocument();
});

test('일반 재생: 승인·참여는 2/4·신청 → 1.8초 뒤 3/4·합류', () => {
  motionState.reduced = false;
  vi.useFakeTimers();
  renderTabs();
  fireEvent.click(tabByIndex(1));
  expect(screen.getByText('2/4')).toBeInTheDocument();
  expect(screen.getByText(t.requestMsg)).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1800); });
  expect(screen.getByText('3/4')).toBeInTheDocument();
  expect(screen.getByText(t.approved)).toBeInTheDocument();

  // 다시 보기 → 신청 단계부터 다시
  fireEvent.click(screen.getByRole('button', { name: t.replayAria }));
  expect(screen.getByText(t.requestMsg)).toBeInTheDocument();
});

test('일반 재생: 같이 출발은 카운트다운을 띄우고, 모션 줄이기면 띄우지 않는다', () => {
  motionState.reduced = false;
  const { unmount } = renderTabs();
  fireEvent.click(tabByIndex(2));
  expect(screen.getByText(t.countdown[0])).toBeInTheDocument();
  unmount();
  motionState.reduced = true;
  renderTabs();
  fireEvent.click(tabByIndex(2));
  expect(screen.queryByText(t.countdown[0])).toBeNull();
  expect(screen.getByText(t.riding)).toBeInTheDocument();
});

test('아코디언: ↓↑·Home·End 로 항목을 바꾸고, 펼친 항목만 설명 영역이 있다', () => {
  renderTabs();
  const expanded = (i) => tabByIndex(i).getAttribute('aria-expanded');
  expect(expanded(0)).toBe('true');
  fireEvent.keyDown(tabByIndex(0), { key: 'ArrowDown' });
  expect(expanded(1)).toBe('true');
  expect(expanded(0)).toBe('false');
  fireEvent.keyDown(tabByIndex(1), { key: 'End' });
  expect(expanded(2)).toBe('true');
  fireEvent.keyDown(tabByIndex(2), { key: 'ArrowDown' }); // 끝에서 ↓ 는 처음으로 순환
  expect(expanded(0)).toBe('true');
  fireEvent.keyDown(tabByIndex(0), { key: 'ArrowUp' });   // 처음에서 ↑ 는 끝으로 순환
  expect(expanded(2)).toBe('true');
  fireEvent.keyDown(tabByIndex(2), { key: 'Home' });
  expect(expanded(0)).toBe('true');
  expect(screen.getAllByRole('region')).toHaveLength(1);
});

test('아코디언 id 는 코스와 겹치지 않게 party 접두사를 쓰고, 설명 영역과 연결된다', () => {
  renderTabs();
  const btn = tabByIndex(0);
  expect(btn).toHaveAttribute('id', 'party-acc-btn-0');
  expect(btn).toHaveAttribute('aria-controls', 'party-acc-panel-0');
  expect(screen.getByRole('region')).toHaveAttribute('aria-labelledby', 'party-acc-btn-0');
});
