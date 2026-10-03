import { act, renderHook } from '@testing-library/react';
import { useMapRide } from './useMapRide';

let watchCb;
const geo = {
  watchPosition: vi.fn((cb) => { watchCb = cb; return 42; }),
  clearWatch: vi.fn(),
};
const fix = (lat, lng) => ({ coords: { latitude: lat, longitude: lng } });

beforeEach(() => {
  vi.useFakeTimers();
  geo.watchPosition.mockClear();
  geo.clearWatch.mockClear();
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
});
afterEach(() => vi.useRealTimers());

test('라이딩 중 언마운트하면 GPS·타이머를 해제하고 기록을 한 번 저장한다', () => {
  const submit = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
  const clearSpy = vi.spyOn(globalThis, 'clearInterval');
  const { result, unmount } = renderHook(() => useMapRide({ userId: 1, partyId: 7 }, { submit }));

  act(() => result.current.start());
  act(() => { watchCb(fix(37.5, 127.0)); watchCb(fix(37.501, 127.0)); }); // 약 111m
  act(() => { vi.advanceTimersByTime(3000); });
  expect(result.current.rideTime).toBe(3);
  expect(result.current.rideDistance).toBeGreaterThan(100);

  unmount();
  expect(geo.clearWatch).toHaveBeenCalledWith(42);
  expect(clearSpy).toHaveBeenCalled();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][0]).toMatchObject({ userId: 1, partyId: 7 });
});

test('stop 으로 저장한 뒤 언마운트하면 다시 저장하지 않는다', async () => {
  const submit = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
  const { result, unmount } = renderHook(() => useMapRide({ userId: 1 }, { submit }));

  act(() => result.current.start());
  act(() => { watchCb(fix(37.5, 127.0)); watchCb(fix(37.501, 127.0)); });
  let stopped;
  await act(async () => { stopped = await result.current.stop(); });
  expect(stopped.result.kind).toBe('saved');
  expect(geo.clearWatch).toHaveBeenCalledWith(42);

  unmount();
  expect(submit).toHaveBeenCalledTimes(1);
});

test('다시 시작하면 이전 라이딩의 기준 좌표·거리가 남지 않는다', async () => {
  const submit = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
  const { result } = renderHook(() => useMapRide({ userId: 1 }, { submit }));

  act(() => result.current.start());
  act(() => { watchCb(fix(37.5, 127.0)); watchCb(fix(37.501, 127.0)); });
  await act(async () => { await result.current.stop(); });

  act(() => result.current.start());
  expect(result.current.rideDistance).toBe(0);
  // 새 라이딩의 첫 좌표는 기준점만 잡고 거리를 더하지 않는다 (이전 위치와 비교하지 않음)
  act(() => { watchCb(fix(37.6, 127.1)); });
  expect(result.current.rideDistance).toBe(0);
});

test('거리가 없으면 저장하지 않는다', () => {
  const submit = vi.fn();
  const { result, unmount } = renderHook(() => useMapRide({ userId: 1 }, { submit }));
  act(() => result.current.start());
  unmount();
  expect(submit).not.toHaveBeenCalled();
});
