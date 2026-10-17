import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PersonalRidingRoom from './PersonalRidingRoom';
import { __resetRideMemory } from '../utils/rideRecords';
import { text } from '../constants';

const chain = () => {
  const o = {};
  ['addTo', 'setView', 'setLatLng', 'setIcon', 'remove', 'panTo', 'clearLayers', 'bindTooltip', 'on', 'openTooltip', 'setTooltipContent']
    .forEach((k) => { o[k] = vi.fn(() => o); });
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
  saveRideRecord: vi.fn().mockResolvedValue({}),
}));
vi.mock('../api/locations', () => ({ reportLocation: api.reportLocation, getOtherLocations: api.getOtherLocations }));
vi.mock('../api/routes', () => ({ getRouteById: vi.fn().mockResolvedValue({}) }));
vi.mock('../api/matches', () => ({ sendMatchRequest: vi.fn(), getOutgoingMatches: vi.fn().mockResolvedValue([]) }));
vi.mock('../api/users', () => ({ getProfile: vi.fn().mockResolvedValue({}) }));
vi.mock('../api/rides', () => ({ saveRideRecord: api.saveRideRecord }));
vi.mock('../api/auth', () => ({ updateLocationSharing: vi.fn().mockResolvedValue({}) }));

let watchCb;
const user = { id: 1, name: '나' };
const move = (lat, t) => act(() => watchCb({ coords: { latitude: lat, longitude: 127, heading: null }, timestamp: t }));

beforeEach(() => {
  localStorage.clear();
  __resetRideMemory();
  Object.values(api).forEach((f) => f.mockClear());
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn((cb) => { watchCb = cb; return 9; }), clearWatch: vi.fn() },
  });
});

test('StrictMode 에서도 종료 버튼을 누르면 기록을 한 번 저장한다', async () => {
  render(<StrictMode><PersonalRidingRoom user={user} route={null} onClose={vi.fn()} /></StrictMode>);
  move(37.5, 1000);
  move(37.501, 3000); // 목 지도 distance 가 100m 를 돌려준다
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '라이딩 종료' })); });
  expect(await screen.findByText('라이딩 기록')).toBeInTheDocument();
  expect(api.saveRideRecord).toHaveBeenCalledTimes(1);
  expect(api.saveRideRecord.mock.calls[0][0]).toMatchObject({ userId: 1, partyId: null, distance: 0.1 });
});

test('StrictMode 에서 종료 없이 닫으면(언마운트) 쌓인 기록을 한 번 저장한다', () => {
  const { unmount } = render(<StrictMode><PersonalRidingRoom user={user} route={null} onClose={vi.fn()} /></StrictMode>);
  move(37.5, 1000);
  move(37.501, 3000);
  unmount();
  expect(api.saveRideRecord).toHaveBeenCalledTimes(1);
});

test('위치 공유가 꺼져 있으면 안내를 띄운다', () => {
  localStorage.setItem('locationShareEnabled', 'false');
  render(<PersonalRidingRoom user={user} route={null} onClose={vi.fn()} />);
  expect(screen.getByText(text.rideLocShareOff)).toBeInTheDocument();
});
