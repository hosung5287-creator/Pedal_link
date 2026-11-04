import { act, render, screen } from '@testing-library/react';
import DemoPanel from './DemoPanel';
import { demoPanel as t } from '../constants';

const api = vi.hoisted(() => ({
  getDemoStatus: vi.fn(),
  getDemoState: vi.fn().mockResolvedValue({ ready: false }),
  setupDemo: vi.fn(),
  sendDemoAction: vi.fn(),
}));
vi.mock('../api/demo', () => api);
vi.mock('../utils/demoGeo', () => ({ refreshDemoGeo: vi.fn() }));
vi.mock('../api/auth', () => ({ updateLocationSharing: vi.fn().mockResolvedValue({}) }));
vi.mock('../api/users', () => ({ getProfile: vi.fn().mockResolvedValue({}) }));
vi.mock('../api/locations', () => ({ removeLocation: vi.fn().mockResolvedValue({}) }));

const host = { id: 166, name: '김호성', email: 'hosun@test.com' };

beforeEach(() => {
  vi.useFakeTimers();
  api.getDemoStatus.mockReset();
});
afterEach(() => vi.useRealTimers());

test('서버가 발표자로 보는 계정이면 주소와 상관없이 시연 패널을 띄운다', async () => {
  api.getDemoStatus.mockResolvedValue({ enabled: true, role: 'presenter' });
  render(<DemoPanel user={host} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(api.getDemoStatus).toHaveBeenCalledWith(166);
  expect(screen.getByRole('button', { name: t.prepare })).toBeInTheDocument();
});

test('발표자가 아니거나(가상 라이더 포함) 시연 모드가 꺼진 서버면 그리지 않는다', async () => {
  for (const s of [{ enabled: true, role: 'none' }, { enabled: true, role: 'rider' }, { enabled: false }]) {
    api.getDemoStatus.mockResolvedValue(s);
    const { container, unmount } = render(<DemoPanel user={host} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(container).toBeEmptyDOMElement();
    unmount();
  }
});

test('서버에 닿지 않으면 5초마다 다시 물어 켜지는 대로 패널을 띄운다', async () => {
  api.getDemoStatus
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValue({ enabled: true, role: 'presenter' });
  const { container } = render(<DemoPanel user={host} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(container).toBeEmptyDOMElement();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(api.getDemoStatus).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('button', { name: t.prepare })).toBeInTheDocument();
});

test('라이딩 중 [파티 추가] — 서연은 누르기 전엔 목록에 없고, 누르면 개인 라이딩 중으로 보인다', async () => {
  const rider = (key, name, extra = {}) => ({ key, name, email: `${key}@pedallink.demo`, guest: false, active: true, mode: 'formation', distanceM: 20, ...extra });
  const riding = (seoyeon, canPartyAdd) => ({
    ready: true, crewName: '한강 라이딩 크루', phase: 'riding', hasRoute: true, progressKm: 1.2, lengthKm: 39.5,
    canSkip: true, canPartyAdd, password: 'demo1234!',
    riders: [rider('minsu', '민수'), rider('jiyoung', '지영'), rider('hyunwoo', '현우', { mode: 'late' }), seoyeon],
  });
  api.getDemoStatus.mockResolvedValue({ enabled: true, role: 'presenter' });
  api.getDemoState.mockResolvedValue(riding(rider('seoyeon', '서연', { guest: true, active: false, distanceM: null }), true));
  api.sendDemoAction.mockResolvedValue(riding(rider('seoyeon', '서연', { guest: true, mode: 'meeting', match: 'none', distanceM: 250 }), false));
  render(<DemoPanel user={host} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });

  expect(screen.queryByText('서연')).toBeNull();
  const add = screen.getByRole('button', { name: t.partyAdd });
  expect(add).toBeEnabled();

  await act(async () => { add.click(); });
  expect(api.sendDemoAction).toHaveBeenCalledWith(166, 'party');
  expect(screen.getByText('서연')).toBeInTheDocument();
  expect(screen.getByText(t.guestMatch.none)).toBeInTheDocument();
  expect(screen.getByText('250m')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: t.partyAdd })).toBeDisabled();
});

test('서연의 매칭 단계 — 신청 보냄 → (수락 뒤) 합류 중, 거절하면 지나가는 중', async () => {
  const seoyeon = (extra) => ({ key: 'seoyeon', name: '서연', email: 'seoyeon@pedallink.demo', guest: true, active: true, mode: 'meeting', distanceM: 180, ...extra });
  const state = (s) => ({ ready: true, crewName: '한강 라이딩 크루', phase: 'riding', hasRoute: true, progressKm: 1, lengthKm: 39.5, canSkip: true, canPartyAdd: false, password: 'demo1234!', riders: [s] });
  api.getDemoStatus.mockResolvedValue({ enabled: true, role: 'presenter' });
  for (const [s, shown] of [
    [seoyeon({ match: 'pending' }), t.guestMatch.pending],
    [seoyeon({ match: 'accepted', mode: 'joining' }), t.modes.joining],
    [seoyeon({ match: 'rejected' }), t.guestMatch.rejected],
  ]) {
    api.getDemoState.mockResolvedValue(state(s));
    const { unmount } = render(<DemoPanel user={host} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText(shown)).toBeInTheDocument();
    unmount();
  }
});
