import { act, fireEvent, render, screen } from '@testing-library/react';
import { homeDraft, text } from '../../constants';

const motionState = vi.hoisted(() => ({ reduced: true }));
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, useReducedMotion: () => motionState.reduced };
});
afterEach(() => { motionState.reduced = true; vi.useRealTimers(); });

const { default: PartyPlay } = await import('./PartyPlay');
const t = homeDraft.partyPlay;
const approveBtn = () => screen.getAllByRole('button', { name: text.partyApprove })[0];
const acceptAll = () => t.hostParty.requests.forEach(() => fireEvent.click(approveBtn()));

test('실제 파티 탭처럼 두 탭과 카드, 승인 대기가 보인다', () => {
  render(<PartyPlay />);
  expect(screen.getByRole('tab', { name: new RegExp(text.partyViewList) })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText(t.hostParty.title)).toBeInTheDocument();
  expect(screen.getByText(`${text.partyPendingTitle} (${t.hostParty.requests.length})`)).toBeInTheDocument();
  expect(document.querySelectorAll('.partyCard')).toHaveLength(4);
  expect(screen.queryByRole('button', { name: text.partyStartRide })).toBeNull();
});

test('수락하면 인원이 늘고, 다 차면 라이딩 시작이 나온다. 다시 보기로 처음으로 돌아간다', () => {
  render(<PartyPlay />); // 움직임 줄이기 — 카운트다운 없이 바로 도착
  acceptAll();
  expect(screen.queryByText(new RegExp(text.partyPendingTitle))).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: text.partyStartRide }));
  expect(screen.getByText(t.arrived)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.reset) }));
  expect(screen.getByText(`${text.partyPendingTitle} (${t.hostParty.requests.length})`)).toBeInTheDocument();
});

test('거절하면 대기 목록에서 빠진다', () => {
  render(<PartyPlay />);
  fireEvent.click(screen.getAllByRole('button', { name: text.partyReject })[0]);
  expect(screen.getByText(`${text.partyPendingTitle} (${t.hostParty.requests.length - 1})`)).toBeInTheDocument();
});

test('참여 신청은 승인 대기를 거쳐 확정되고 내 파티에 들어온다', () => {
  vi.useFakeTimers();
  render(<PartyPlay />);
  fireEvent.click(screen.getAllByRole('button', { name: text.partyApply })[0]);
  expect(screen.getByRole('button', { name: text.partyPending })).toBeDisabled();
  act(() => { vi.advanceTimersByTime(1400); });
  expect(screen.getByRole('button', { name: new RegExp(text.partyJoined) })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(text.partyViewRoom) }));
  expect(screen.getByText(t.others[0].title)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: text.partyOpenRoom })).toHaveLength(2);
});

test('라이딩 시작 뒤 3·2·1 카운트다운을 거쳐 함께 도착한다', () => {
  motionState.reduced = false;
  vi.useFakeTimers();
  render(<PartyPlay />);
  acceptAll();
  fireEvent.click(screen.getByRole('button', { name: text.partyStartRide }));
  expect(screen.getByText(t.countdown[0])).toBeInTheDocument();
  expect(screen.getByText(t.ready)).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(700); });
  expect(screen.getByText(t.countdown[1])).toBeInTheDocument();
  for (let i = 0; i < 3; i += 1) act(() => { vi.advanceTimersByTime(700); }); // 칸마다 다음 타이머가 걸린다
  expect(screen.getByText(t.riding)).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(6000); });
  expect(screen.getByText(t.arrived)).toBeInTheDocument();
});
