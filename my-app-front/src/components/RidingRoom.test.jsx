import { act, fireEvent, render, screen } from '@testing-library/react';
import RidingRoom from './RidingRoom';
import { rideSessionKey, __resetRideMemory } from '../utils/rideRecords';
import { text } from '../constants';

// ── Leaflet·지도 유틸 모킹 (jsdom 에는 지도 렌더링이 없다) ──
const chain = () => {
  const o = {};
  ['addTo', 'setView', 'setLatLng', 'setIcon', 'remove', 'panTo', 'clearLayers'].forEach((k) => { o[k] = vi.fn(() => o); });
  o.distance = vi.fn(() => 100);
  return o;
};
vi.mock('leaflet', () => ({
  default: { map: vi.fn(() => chain()), layerGroup: vi.fn(() => chain()), marker: vi.fn(() => chain()) },
}));
vi.mock('../utils/leaflet', () => ({
  makeTileLayer: () => chain(),
  makeCurrentLocationIcon: () => ({}),
  makeOtherUserIcon: () => ({}),
  makeHeadingIcon: () => ({}),
  bearingBetween: () => 0,
  drawRoutes: vi.fn(),
}));

const api = vi.hoisted(() => ({
  reportLocation: vi.fn().mockResolvedValue({}),
  getOtherLocations: vi.fn().mockResolvedValue([]),
  stopPartyRide: vi.fn(),
  getParty: vi.fn().mockResolvedValue({ id: 7, rideStartedAt: '2026-10-03T01:00:00' }),
  saveRideRecord: vi.fn().mockResolvedValue({}),
}));
vi.mock('../api/locations', () => ({ reportLocation: api.reportLocation, getOtherLocations: api.getOtherLocations }));
vi.mock('../api/routes', () => ({ getRouteById: vi.fn().mockResolvedValue({}) }));
vi.mock('../api/parties', () => ({ stopPartyRide: api.stopPartyRide, getParty: api.getParty }));
vi.mock('../api/rides', () => ({ saveRideRecord: api.saveRideRecord }));
vi.mock('../api/auth', () => ({ updateLocationSharing: vi.fn().mockResolvedValue({}) }));

const STARTED = '2026-10-03T01:00:00';
const host = { id: 1, name: '호스트' };
const party = { id: 7, hostId: 1, title: '한강 번개', rideStartedAt: STARTED, routeId: null };
const KEY = rideSessionKey(1, 7, STARTED);

let watchCb;
beforeEach(() => {
  localStorage.clear();
  __resetRideMemory();
  Object.values(api).forEach((f) => f.mockClear());
  api.stopPartyRide.mockReset();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn((cb) => { watchCb = cb; return 5; }), clearWatch: vi.fn() },
  });
});

const setShare = (on) => localStorage.setItem('locationShareEnabled', JSON.stringify(on));

test('저장된 세션 거리로 재진입하면 거리가 이어지고, ‹ 닫기(언마운트)로는 기록을 저장하지 않는다', () => {
  localStorage.setItem(KEY, JSON.stringify({ distanceM: 2500, state: 'active', updatedAt: Date.now() }));
  const { unmount } = render(<RidingRoom party={party} user={host} onClose={vi.fn()} />);
  expect(screen.getByText('2.50')).toBeInTheDocument();
  unmount();
  expect(api.saveRideRecord).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(KEY)).state).toBe('active');
});

test('위치 공유가 꺼져 있으면 내 위치를 보내지 않고 안내를 띄운다', async () => {
  vi.useFakeTimers();
  try {
    setShare(false);
    render(<RidingRoom party={{ ...party, hostId: 2 }} user={host} onClose={vi.fn()} />);
    expect(screen.getByText(text.rideLocShareOff)).toBeInTheDocument();
    act(() => watchCb({ coords: { latitude: 37.5, longitude: 127 }, timestamp: Date.now() }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(api.reportLocation).not.toHaveBeenCalled();
    expect(api.getOtherLocations).toHaveBeenCalled();

    // [켜기] 이후 다음 폴링부터 전송
    fireEvent.click(screen.getByRole('button', { name: text.rideLocShareTurnOn }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(api.reportLocation).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test('방장 종료가 실패하면 기록을 저장하지 않고 오류를 보여주며, 다시 누르면 한 번 저장한다', async () => {
  setShare(true);
  localStorage.setItem(KEY, JSON.stringify({ distanceM: 3000, state: 'active', updatedAt: Date.now() }));
  api.stopPartyRide
    .mockRejectedValueOnce(Object.assign(new Error('x'), { status: 500 }))
    .mockResolvedValueOnce({ ...party, rideStartedAt: null });
  render(<RidingRoom party={party} user={host} onClose={vi.fn()} onPartyChange={vi.fn()} />);

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '라이딩 종료' })); });
  expect(await screen.findByText(text.rideEndFailed)).toBeInTheDocument();
  expect(api.saveRideRecord).not.toHaveBeenCalled();

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '라이딩 종료' })); });
  expect(await screen.findByText('라이딩 기록')).toBeInTheDocument();
  expect(api.saveRideRecord).toHaveBeenCalledTimes(1);
  expect(api.saveRideRecord.mock.calls[0][0]).toMatchObject({ userId: 1, partyId: 7, distance: 3 });
  expect(JSON.parse(localStorage.getItem(KEY)).state).toBe('done');
});

test('종료 요청 중에는 ‹ 닫기 버튼이 비활성화된다', async () => {
  let resolveStop;
  api.stopPartyRide.mockImplementationOnce(() => new Promise((r) => { resolveStop = r; }));
  render(<RidingRoom party={party} user={host} onClose={vi.fn()} onPartyChange={vi.fn()} />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '라이딩 종료' })); });
  expect(screen.getByRole('button', { name: '파티창으로' })).toBeDisabled();
  await act(async () => { resolveStop({ ...party, rideStartedAt: null }); });
});
