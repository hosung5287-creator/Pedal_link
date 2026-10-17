import { fireEvent, render, screen } from '@testing-library/react';
import { homeTogether } from '../../constants';

const { default: TogetherSection } = await import('./TogetherSection');
const tab = (label) => screen.getByRole('tab', { name: new RegExp(label) });
const [party, crew] = homeTogether.tabs;

test('처음엔 파티 탭 — 파티 화면 자리가 보인다', () => {
  render(<TogetherSection />);
  expect(tab(party.label)).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveTextContent(party.slotLabel);
});

test('크루 탭을 누르면 크루 화면 자리로 바뀐다', () => {
  render(<TogetherSection />);
  fireEvent.click(tab(crew.label));
  expect(tab(crew.label)).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'together-tab-crew');
  expect(screen.getByRole('tabpanel')).toHaveTextContent(crew.slotLabel);
});

test('←/→ 키로 탭을 옮긴다', () => {
  render(<TogetherSection />);
  fireEvent.keyDown(tab(party.label), { key: 'ArrowRight' });
  expect(tab(crew.label)).toHaveAttribute('aria-selected', 'true');
  expect(tab(crew.label)).toHaveFocus();
  fireEvent.keyDown(tab(crew.label), { key: 'ArrowRight' });
  expect(tab(party.label)).toHaveAttribute('aria-selected', 'true');
});
