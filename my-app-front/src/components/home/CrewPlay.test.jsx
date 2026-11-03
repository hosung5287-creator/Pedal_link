import { act, fireEvent, render, screen } from '@testing-library/react';
import { crew as c, homeDraft } from '../../constants';
import CrewPlay from './CrewPlay';

const t = homeDraft.crewPlay;
afterEach(() => { vi.useRealTimers(); });

test('실제 크루 탭처럼 두 탭과 크루 카드가 보인다', () => {
  render(<CrewPlay />);
  expect(screen.getByRole('tab', { name: new RegExp(c.findTab) })).toHaveAttribute('aria-selected', 'true');
  t.crews.forEach((crew) => expect(screen.getByText(crew.name)).toBeInTheDocument());
  expect(document.querySelectorAll('.crewCard')).toHaveLength(4);
  expect(screen.getByText(c.noMyCrew)).toBeInTheDocument();
});

test('가입 신청은 승인 대기를 거쳐 내 크루로 옮겨 간다', () => {
  vi.useFakeTimers();
  render(<CrewPlay />);
  fireEvent.click(screen.getAllByRole('button', { name: c.join })[0]);
  expect(screen.getByRole('button', { name: c.pending })).toBeDisabled();
  act(() => { vi.advanceTimersByTime(1400); });
  expect(screen.getByText(`1${c.crewUnit}`)).toBeInTheDocument();
  expect(screen.queryByText(t.crews[0].name)).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(c.mineTab) }));
  expect(screen.getByText(t.crews[0].name)).toBeInTheDocument();
});

test('크루를 누르면 멤버와 예정된 라이딩이 보이고 목록으로 돌아온다', () => {
  render(<CrewPlay />);
  fireEvent.click(screen.getByRole('button', { name: t.crews[0].name }));
  expect(screen.getByText(c.upcomingTitle)).toBeInTheDocument();
  expect(screen.getByText(t.crews[0].members[0])).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(c.backToList) }));
  expect(screen.getByRole('tab', { name: new RegExp(c.findTab) })).toBeInTheDocument();
});
