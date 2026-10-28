const api = vi.hoisted(() => ({ getDemoStatus: vi.fn(), getDemoPosition: vi.fn() }));
vi.mock('../api/demo', () => ({ getDemoStatus: api.getDemoStatus, getDemoPosition: api.getDemoPosition }));

let real;
// 설치 여부를 모듈이 기억하므로 테스트마다 새로 불러온다
async function install() {
  vi.resetModules();
  const mod = await import('./demoGeo');
  mod.installDemoGeo();
  await vi.advanceTimersByTimeAsync(0); // 역할 확인(/api/demo/status) 응답까지
  return mod;
}
const login = (user) => localStorage.setItem('user', JSON.stringify(user));
const fix = (lat, t, jumps = 0) => ({ lat, lng: 127, heading: 90, t, jumps });
const presenter = { id: 1, email: 'hosun@test.com' };
const roleIs = (role) => api.getDemoStatus.mockResolvedValue({ enabled: true, role });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  api.getDemoStatus.mockReset();
  api.getDemoPosition.mockReset();
  real = { watchPosition: vi.fn(() => 7), clearWatch: vi.fn(), getCurrentPosition: vi.fn() };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: real });
});
afterEach(() => {
  vi.useRealTimers();
});

test('시연 대상이 아닌 계정·시연 모드가 꺼진 서버는 진짜 GPS 를 그대로 쓴다', async () => {
  login({ id: 9, email: 'someone@test.com' });
  api.getDemoStatus.mockResolvedValue({ enabled: true, role: 'none' });
  await install();
  const cb = vi.fn();
  const id = navigator.geolocation.watchPosition(cb);
  expect(real.watchPosition).toHaveBeenCalledWith(cb, undefined, undefined);
  navigator.geolocation.clearWatch(id);
  expect(real.clearWatch).toHaveBeenCalledWith(7);
  expect(api.getDemoStatus).toHaveBeenCalledWith(9);
  expect(api.getDemoPosition).not.toHaveBeenCalled();

  // 배포 서버(시연 꺼짐)도 같다
  api.getDemoStatus.mockResolvedValue({ enabled: false });
  await install();
  navigator.geolocation.watchPosition(vi.fn());
  expect(real.watchPosition).toHaveBeenCalledTimes(2);
  expect(api.getDemoPosition).not.toHaveBeenCalled();
});

test('발표자 계정이면 주소에 아무것도 붙이지 않아도 가상 위치를 받고, 순간 이동은 측정 간격 1ms 로 넘긴다', async () => {
  login(presenter);
  roleIs('presenter');
  api.getDemoPosition
    .mockResolvedValueOnce(fix(37.5, 1000))
    .mockResolvedValueOnce(fix(37.5001, 2000))
    .mockResolvedValueOnce(fix(37.6, 3000, 1))
    .mockResolvedValue(fix(37.6001, 4000, 1));
  await install();

  const cb = vi.fn();
  navigator.geolocation.watchPosition(cb);
  await vi.advanceTimersByTimeAsync(10);
  expect(api.getDemoPosition).toHaveBeenCalledWith(1);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({
    coords: expect.objectContaining({ latitude: 37.5, longitude: 127, heading: 90 }), timestamp: 1000,
  }));
  await vi.advanceTimersByTimeAsync(1000);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: 2000 }));
  await vi.advanceTimersByTimeAsync(1000);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ coords: expect.objectContaining({ latitude: 37.6 }), timestamp: 2001 }));
  await vi.advanceTimersByTimeAsync(1000);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: 4000 }));
  expect(real.watchPosition).not.toHaveBeenCalled();
});

test('발표자: 가상 위치가 아직 없으면 진짜 GPS 로 갔다가, 시연 준비 직후 refreshDemoGeo 로 바로 바뀐다', async () => {
  login(presenter);
  roleIs('presenter');
  api.getDemoPosition.mockResolvedValueOnce(null).mockResolvedValue(fix(37.5, 1000));
  const mod = await install();

  const cb = vi.fn();
  const id = navigator.geolocation.watchPosition(cb);
  await vi.advanceTimersByTimeAsync(10);
  expect(real.watchPosition).toHaveBeenCalledTimes(1);

  mod.refreshDemoGeo();
  await vi.advanceTimersByTimeAsync(10);
  expect(real.clearWatch).toHaveBeenCalledWith(7);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: 1000 }));

  // 새 구독은 기다리지 않고 받은 위치를 바로 한 번 받는다
  const cb2 = vi.fn();
  navigator.geolocation.watchPosition(cb2);
  await vi.advanceTimersByTimeAsync(5);
  expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ coords: expect.objectContaining({ latitude: 37.5 }) }));
  navigator.geolocation.clearWatch(id);
});

test('가상 라이더 계정은 가상 위치가 없어도 진짜 GPS 로 돌아가지 않는다', async () => {
  login({ id: 5, email: 'jiyoung@pedallink.demo' });
  roleIs('rider');
  api.getDemoPosition.mockResolvedValue(null);
  await install();
  navigator.geolocation.watchPosition(vi.fn());
  await vi.advanceTimersByTimeAsync(6000);
  expect(api.getDemoPosition).toHaveBeenCalledWith(5);
  expect(real.watchPosition).not.toHaveBeenCalled();
});

test('같은 브라우저 다른 탭에서 지영으로 로그인해도, 이 탭은 이 탭 계정(발표자)의 가상 위치를 계속 받는다', async () => {
  login(presenter);
  roleIs('presenter');
  api.getDemoPosition.mockResolvedValue(fix(37.5, 1000));
  const mod = await install();
  mod.setDemoUser(presenter);
  navigator.geolocation.watchPosition(vi.fn());
  await vi.advanceTimersByTimeAsync(10);

  login({ id: 5, email: 'jiyoung@pedallink.demo' }); // 다른 탭이 저장소의 로그인 정보를 바꿨다
  api.getDemoPosition.mockClear();
  await vi.advanceTimersByTimeAsync(3000);
  expect(api.getDemoPosition).toHaveBeenCalled();
  expect(api.getDemoPosition.mock.calls.every(([uid]) => uid === 1)).toBe(true);
});

test('이 탭에서 계정이 바뀌면 역할을 다시 묻는다 — 로그인 전 진짜 GPS 였던 구독도 발표자 로그인 뒤 가상 위치로', async () => {
  api.getDemoStatus.mockResolvedValue({ enabled: true, role: 'none' });
  const mod = await install(); // 로그인 전
  const cb = vi.fn();
  navigator.geolocation.watchPosition(cb);
  expect(real.watchPosition).toHaveBeenCalledTimes(1);

  roleIs('presenter');
  api.getDemoPosition.mockResolvedValue(fix(37.5, 1000));
  mod.setDemoUser(presenter);
  await vi.advanceTimersByTimeAsync(10);
  expect(api.getDemoStatus).toHaveBeenLastCalledWith(1);
  expect(real.clearWatch).toHaveBeenCalledWith(7);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: 1000 }));
});

test('서버에 닿지 않으면(켜지는 중) 진짜 GPS 로 두고 5초 뒤 다시 물어 발표자면 가상 위치로 바꾼다', async () => {
  login(presenter);
  api.getDemoStatus.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ enabled: true, role: 'presenter' });
  api.getDemoPosition.mockResolvedValue(fix(37.5, 1000));
  await install();
  const cb = vi.fn();
  navigator.geolocation.watchPosition(cb);
  expect(real.watchPosition).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(5010);
  expect(api.getDemoStatus).toHaveBeenCalledTimes(2);
  expect(real.clearWatch).toHaveBeenCalledWith(7);
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: 1000 }));
});

test('라이딩 중 위치 요청이 네트워크 오류로 실패하면 판단을 미룬다 — 진짜 GPS 로 튀지 않는다', async () => {
  login(presenter);
  roleIs('presenter');
  api.getDemoPosition.mockResolvedValueOnce(fix(37.5, 1000)).mockRejectedValue(new TypeError('Failed to fetch'));
  await install();
  const cb = vi.fn();
  navigator.geolocation.watchPosition(cb);
  await vi.advanceTimersByTimeAsync(10);
  await vi.advanceTimersByTimeAsync(12000);
  expect(cb).toHaveBeenCalledTimes(1);
  expect(real.watchPosition).not.toHaveBeenCalled();
});
