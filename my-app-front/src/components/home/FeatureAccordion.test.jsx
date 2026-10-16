import { fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ reduced: true }));
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, useReducedMotion: () => state.reduced };
});
afterEach(() => { state.reduced = true; });

const { default: FeatureAccordion } = await import('./FeatureAccordion');

const features = [
  { title: '하나', desc: '첫 설명' },
  { title: '둘', desc: '둘째 설명' },
  { title: '셋', desc: '셋째 설명' },
];
// 시연 대신 stage 만 보여주는 가짜 컴포넌트
const FakeDemo = ({ stage }) => <div data-testid="demo">stage-{stage}</div>;

test('펼친 항목의 stage 를 오른쪽 시연에 넘기고, 클릭하면 바뀐다', () => {
  render(<FeatureAccordion features={features} label="기능" Demo={FakeDemo} idPrefix="t" />);
  expect(screen.getByTestId('demo')).toHaveTextContent('stage-0');
  expect(screen.getByText('첫 설명')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /둘/ }));
  expect(screen.getByTestId('demo')).toHaveTextContent('stage-1');
  expect(screen.getByText('둘째 설명')).toBeInTheDocument();
  expect(screen.queryByText('첫 설명')).toBeNull(); // 접힌 설명은 렌더하지 않음
});

test('펼친 항목을 다시 눌러도 닫히지 않는다(항상 하나는 열림)', () => {
  render(<FeatureAccordion features={features} label="기능" Demo={FakeDemo} idPrefix="t" />);
  fireEvent.click(screen.getByRole('button', { name: /하나/ }));
  expect(screen.getByRole('button', { name: /하나/ })).toHaveAttribute('aria-expanded', 'true');
});

test('↓ 키는 다음 항목으로 포커스를 옮긴다', () => {
  render(<FeatureAccordion features={features} label="기능" Demo={FakeDemo} idPrefix="t" />);
  const first = screen.getByRole('button', { name: /하나/ });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  expect(screen.getByRole('button', { name: /둘/ })).toHaveFocus();
});

test('일반 모션: 닫히는 중인 설명은 바로 화면낭독기에서 숨긴다', () => {
  state.reduced = false;
  render(<FeatureAccordion features={features} label="기능" Demo={FakeDemo} idPrefix="t" />);
  fireEvent.click(screen.getByRole('button', { name: /둘/ }));
  // 퇴장 애니메이션으로 DOM 에 남아 있어도 접근 가능한 region 은 펼친 항목 하나뿐
  const regions = screen.getAllByRole('region');
  expect(regions).toHaveLength(1);
  expect(regions[0]).toHaveAttribute('id', 't-acc-panel-1');
  const leaving = document.getElementById('t-acc-panel-0');
  if (leaving) expect(leaving).toHaveAttribute('aria-hidden', 'true');
});
