import { act, fireEvent, render, screen } from '@testing-library/react';
import L from 'leaflet';
import RidingRoom from './RidingRoom';
import { rideSessionKey, __resetRideMemory } from '../utils/rideRecords';
import { text } from '../constants';

// ── Leaflet·지도 유틸 모킹 (jsdom 에는 지도 렌더링이 없다) ──
const chain = (at) => {
  const o = {};
  ['addTo', 'setView', 'setIcon', 'remove', 'panTo', 'clearLayers'].forEach((k) => { o[k] = vi.fn(() => o); });
  o.distance = vi.fn(() => 100);
  // 마커 — 지금 보이는 자리를 돌려준다
  o.setLatLng = vi.fn((ll) => { at = ll; return o; });
  o.getLatLng = () => ({ lat: at[0], lng: at[1] });
  return o;
};
vi.mock('leaflet', () => ({
  default: { map: vi.fn(() => chain()), layerGroup: vi.fn(() => chain()), marker: vi.fn((at) => chain(at)) },
}));
vi.mock('../utils/leaflet', () => ({
  makeTileLayer: () => chain(),
  makeCurrentLocationIcon: () => ({}),
  makeRiderIcon: (stopped) => ({ stopped }),
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

// ── 파티원 이탈·합류 알림 ──
// 지도 거리는 위도 차이로만 잰다 (1e-5도 = 1m). 내 위치는 위도 37.5.
const riderAt = (userId, name, m) => ({ userId, name, lat: 37.5 + m * 1e-5, lng: 127 });
const useLatDistance = () => {
  L.map.mock.results.at(-1).value.distance.mockImplementation((a, b) => Math.abs(a[0] - b[0]) * 1e5);
};
const alertText = /이탈하였습니다|합류하였습니다/;
const wait = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
// 다음 폴링(3초마다)에 받을 위치를 정해 두고 ms 만큼 흘려보낸다
const poll = async (riders, ms = 3000) => {
  api.getOtherLocations.mockResolvedValueOnce(riders);
  await wait(ms);
};

test('대열에 있던 파티원이 250m 밖으로 나가면 이탈, 다시 50m 안으로 오면 합류 알림 — 처음 보일 때는 알리지 않고, 마커가 기준 거리를 넘을 때 띄운다', async () => {
  vi.useFakeTimers();
  try {
    setShare(true);
    render(<RidingRoom party={party} user={host} onClose={vi.fn()} />);
    useLatDistance();
    act(() => watchCb({ coords: { latitude: 37.5, longitude: 127 }, timestamp: Date.now() }));

    await wait(100);
    await poll([riderAt(2, '민수', 20)]);
    expect(screen.queryByText(alertText)).toBeNull();

    await poll([riderAt(2, '민수', 300)]);   // 6초에 받음 — 마커는 아직 20m 근처
    expect(screen.queryByText(alertText)).toBeNull();
    await wait(2500);                         // 받은 지 2.6초 — 마커가 250m 를 넘었다 (2.46초에 넘음)
    expect(screen.getByText('민수가 이탈하였습니다')).toBeInTheDocument();

    // 50~250m 사이는 그대로 (알림 없음), 50m 안으로 와야 합류
    await poll([riderAt(2, '민수', 120)], 500);
    await poll([riderAt(2, '민수', 30)]);     // 12초에 받음 — 마커는 아직 120m 근처
    expect(screen.queryByText('민수가 합류하였습니다')).toBeNull();
    await poll([riderAt(2, '민수', 30)]);
    expect(screen.getByText('민수가 합류하였습니다')).toBeInTheDocument();

    await wait(4100);
    expect(screen.queryByText(alertText)).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('처음부터 멀리 있던 파티원은 50m 안으로 오면 합류 알림 — 받침 있는 이름은 "이", 동시에 오면 차례로 뜬다', async () => {
  vi.useFakeTimers();
  try {
    setShare(true);
    render(<RidingRoom party={party} user={host} onClose={vi.fn()} />);
    useLatDistance();
    act(() => watchCb({ coords: { latitude: 37.5, longitude: 127 }, timestamp: Date.now() }));

    await wait(100);
    await poll([riderAt(3, '지영', 150), riderAt(4, '현우', 400)]);
    expect(screen.queryByText(alertText)).toBeNull();

    await poll([riderAt(3, '지영', 40), riderAt(4, '현우', 20)]);
    await poll([riderAt(3, '지영', 40), riderAt(4, '현우', 20)]);
    expect(screen.getByText('지영이 합류하였습니다')).toBeInTheDocument();
    expect(screen.queryByText('현우가 합류하였습니다')).toBeNull();

    await wait(4000);
    expect(screen.getByText('현우가 합류하였습니다')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('파티원 마커는 받은 자리까지 다음 위치가 올 때쯤 닿게 미끄러진다 — 서 있다 크게 움직이면 천천히 출발하고, 1km 넘게 옮겨지면 바로 옮긴다', async () => {
  vi.useFakeTimers();
  try {
    setShare(true);
    render(<RidingRoom party={party} user={host} onClose={vi.fn()} />);
    useLatDistance();
    act(() => watchCb({ coords: { latitude: 37.5, longitude: 127 }, timestamp: Date.now() }));
    const minsu = (m) => [riderAt(2, '민수', m)];

    await wait(100);
    await poll(minsu(20));                 // 3초 — 처음 보임
    const marker = L.marker.mock.results.at(-1).value;
    const shown = () => (marker.getLatLng().lat - 37.5) * 1e5;   // 마커가 보이는 자리(내 위치에서 m)
    const near = (want) => expect(Math.abs(shown() - want)).toBeLessThan(3);

    await poll(minsu(50));                 // 6초 — 30m 앞을 받음 → 3초 동안 고르게
    near(20);
    await wait(1400);                      // 받은 지 1.5초 → 절반
    near(35);
    await poll(minsu(50), 2250);           // 9초 — 같은 자리(멈춤), 그 전에 닿아 있다
    near(50);

    await poll(minsu(350));                // 12초 — 서 있다 300m (대열로 들어옴), 받은 지 0.75초
    expect(shown()).toBeGreaterThan(50);
    expect(shown()).toBeLessThan(110);     // 고르게 가면 125m — 천천히 출발한다
    await wait(750);                       // 받은 지 1.5초 → 절반
    near(200);

    await poll(minsu(2000), 1600);         // 15초 — 1.65km 건너뜀 → 바로
    near(2000);
  } finally {
    vi.useRealTimers();
  }
});

test('파티원 마커는 달리면 흰색, 멈추면 빨간색 — 자전거로 낼 수 없는 속도(대열로 뛰어든 것)는 속도 글자에서 걸러 앞의 값을 둔다', async () => {
  vi.useFakeTimers();
  try {
    setShare(true);
    render(<RidingRoom party={party} user={host} onClose={vi.fn()} />);
    useLatDistance();
    act(() => watchCb({ coords: { latitude: 37.5, longitude: 127 }, timestamp: Date.now() }));
    const minsu = (m) => poll([riderAt(2, '민수', m)]);
    const speedOf = () => screen.getByText('민수').closest('.rrRiderRow').querySelector('.rrRiderSpeed').textContent;

    await wait(100);
    await minsu(20);   // 처음 보임 → 흰색
    const marker = L.marker.mock.results.at(-1).value;
    expect(L.marker.mock.calls.at(-1)[1].icon).toEqual({ stopped: false });
    await minsu(40);   // 20m / 3초 = 24km/h → 그대로 흰색
    expect(marker.setIcon).not.toHaveBeenCalled();
    expect(speedOf()).toBe('24.0');

    await minsu(40);   // 그 자리 → 빨간색
    expect(marker.setIcon).toHaveBeenLastCalledWith({ stopped: true });
    expect(speedOf()).toBe('0.0');

    await minsu(140);  // 3초에 100m(120km/h) → 속도 글자는 그대로, 움직였으니 흰색
    expect(marker.setIcon).toHaveBeenLastCalledWith({ stopped: false });
    expect(speedOf()).toBe('0.0');

    await minsu(160);  // 다시 24km/h — 흰색 그대로
    expect(marker.setIcon).toHaveBeenCalledTimes(2);
    expect(speedOf()).toBe('24.0');
  } finally {
    vi.useRealTimers();
  }
});

test('위치가 잠깐 안 보였다가 다시 보이면 처음 보는 것처럼 다뤄 알림을 띄우지 않는다', async () => {
  vi.useFakeTimers();
  try {
    setShare(true);
    render(<RidingRoom party={party} user={host} onClose={vi.fn()} />);
    useLatDistance();
    act(() => watchCb({ coords: { latitude: 37.5, longitude: 127 }, timestamp: Date.now() }));

    await poll([riderAt(2, '민수', 20)], 3100);
    await poll([]);
    await poll([riderAt(2, '민수', 900)]);
    expect(screen.queryByText(alertText)).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
