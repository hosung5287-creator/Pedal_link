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
