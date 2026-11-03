import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { text } from '../constants';

const ROUTES = [
  { id: 1, routeName: '한강 야경', fromLabel: '이촌', toLabel: '반포', distanceKm: 4.2 },
  { id: 2, routeName: '남산 업힐', fromLabel: '남산', toLabel: '남산', distanceKm: 8 },
];
const PATH = [{ lat: 37.52, lng: 126.97 }, { lat: 37.51, lng: 127 }];

const api = vi.hoisted(() => ({ getMyRoutesForParty: vi.fn(), getRouteById: vi.fn() }));
vi.mock('../api/parties', () => ({ getMyRoutesForParty: api.getMyRoutesForParty }));
vi.mock('../api/routes', () => ({ getRouteById: api.getRouteById }));
// 지도(Leaflet)는 jsdom 에서 그릴 수 없으니 받은 경로 점 개수만 보여주는 가짜로
vi.mock('./RouteMapThumbnail', () => ({
  default: ({ path }) => <div data-testid="route-map">points-{path.length}</div>,
}));

const { default: CreatePartyModal } = await import('./CreatePartyModal');

beforeEach(() => {
  api.getMyRoutesForParty.mockResolvedValue(ROUTES);
  api.getRouteById.mockImplementation((id) => Promise.resolve(String(id) === '1' ? { bikeRoute: PATH } : { bikeRoute: [] }));
});
afterEach(() => vi.clearAllMocks());

const renderModal = () => render(<CreatePartyModal user={{ id: 7 }} onClose={() => {}} onCreate={() => Promise.resolve()} />);

test('첫 경로가 선택되고 그 경로 지도를 미리 보여준다', async () => {
  renderModal();
  expect(await screen.findByTestId('route-map')).toHaveTextContent('points-2');
  expect(screen.getByRole('radio', { name: /한강 야경/ })).toBeChecked();
  expect(api.getRouteById).toHaveBeenCalledWith('1');
});

test('다른 경로를 고르면 그 경로를 불러오고, 좌표가 없으면 안내 문구', async () => {
  renderModal();
  await screen.findByTestId('route-map');
  fireEvent.click(screen.getByRole('radio', { name: /남산 업힐/ }));
  expect(await screen.findByText(text.partyRouteNoMap)).toBeInTheDocument();
  expect(api.getRouteById).toHaveBeenCalledWith('2');
  // 앞의 경로로 돌아가면 다시 부르지 않고 기억해 둔 지도를 쓴다
  fireEvent.click(screen.getByRole('radio', { name: /한강 야경/ }));
  await waitFor(() => expect(screen.getByTestId('route-map')).toBeInTheDocument());
  expect(api.getRouteById).toHaveBeenCalledTimes(2);
});
