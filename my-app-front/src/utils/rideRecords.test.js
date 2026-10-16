import {
  submitRideRecord, flushPendingRides, readPendingRides,
  rideSessionKey, beginRideSession, storeRideDistance, claimRideSession, settleRideSession,
  loadRideSession, finalizePartySession, endRideAsHost, findEndedSessions, PAGE_LOAD_ID,
  __resetRideMemory, retryPendingSessionWrites,
} from './rideRecords';

const record = { userId: 1, distance: 1.2, duration: 5, partyId: null, routeId: null, routeName: null };
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  __resetRideMemory();
});

describe('submitRideRecord', () => {
  test('성공하면 saved, 큐에 남지 않는다', async () => {
    const save = vi.fn().mockResolvedValue({});
    expect(await submitRideRecord(record, { save })).toEqual({ ok: true, kind: 'saved' });
    expect(readPendingRides()).toHaveLength(0);
  });

  test('5xx·네트워크 오류는 큐에 보존한다', async () => {
    expect((await submitRideRecord(record, { save: vi.fn().mockRejectedValue(httpError(503)) })).kind).toBe('queued');
    expect((await submitRideRecord(record, { save: vi.fn().mockRejectedValue(new TypeError('fetch failed')) })).kind).toBe('queued');
    expect(readPendingRides()).toHaveLength(2);
  });

  test('4xx는 큐에 넣지 않는다', async () => {
    const r = await submitRideRecord(record, { save: vi.fn().mockRejectedValue(httpError(400)) });
    expect(r).toMatchObject({ ok: false, kind: 'rejected', status: 400 });
    expect(readPendingRides()).toHaveLength(0);
  });

  test('저장소 쓰기가 실패하면 lost', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const r = await submitRideRecord(record, { save: vi.fn().mockRejectedValue(httpError(500)) });
    expect(r.kind).toBe('lost');
  });
});

describe('flushPendingRides', () => {
  test('성공·4xx 항목은 지우고, 보내는 중 새로 들어온 항목은 보존한다', async () => {
    await submitRideRecord({ ...record, distance: 1 }, { save: vi.fn().mockRejectedValue(httpError(500)) });
    await submitRideRecord({ ...record, distance: 2 }, { save: vi.fn().mockRejectedValue(httpError(500)) });
    await submitRideRecord({ ...record, distance: 3 }, { save: vi.fn().mockRejectedValue(httpError(500)) });

    const save = vi.fn()
      .mockImplementationOnce(async () => {
        // 첫 항목을 보내는 동안 새 실패 기록이 큐에 추가된다
        await submitRideRecord({ ...record, distance: 9 }, { save: vi.fn().mockRejectedValue(httpError(500)) });
      })
      .mockRejectedValueOnce(httpError(400))   // 2 → 4xx, 제거
      .mockRejectedValueOnce(httpError(502));  // 3 → 재시도 대상, 유지

    await flushPendingRides({ save });
    expect(readPendingRides().map((q) => q.record.distance)).toEqual([3, 9]);
  });
});

describe('flushPendingRides 저장소 실패', () => {
  test('전송 성공 후 큐 정리 쓰기가 실패해도 같은 페이지에서는 다시 보내지 않는다', async () => {
    await submitRideRecord(record, { save: vi.fn().mockRejectedValue(httpError(500)) });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const save = vi.fn().mockResolvedValue({});
    await flushPendingRides({ save });
    await flushPendingRides({ save });
    expect(save).toHaveBeenCalledTimes(1);
    setSpy.mockRestore();
    await flushPendingRides({ save }); // 저장소가 돌아오면 정리만 한다
    expect(save).toHaveBeenCalledTimes(1);
    expect(readPendingRides()).toHaveLength(0);
  });
});

describe('파티 라이딩 세션', () => {
  const key = rideSessionKey(1, 7, '2026-10-03T01:00:00');

  test('재진입하면 저장된 거리로 이어진다', () => {
    beginRideSession(key);
    storeRideDistance(key, 1500);
    expect(beginRideSession(key).distanceM).toBe(1500);
  });

  test('claim 은 한 번만 성공한다', () => {
    beginRideSession(key);
    expect(claimRideSession(key)).toBe('claimed');
    expect(claimRideSession(key)).toBe('busy');
  });

  test('저장소에 세션이 없거나 쓰기가 실패해도 메모리 가드로 차지해서 서버 저장은 시도한다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const k = rideSessionKey(1, 8, 'z');
    beginRideSession(k); // 쓰기 실패 — 저장소에는 없음
    const submit = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
    const r = await finalizePartySession({ key: k, buildRecord: () => record, submit });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(r.kind).toBe('saved');
    // 같은 페이지에서는 다시 확정하지 않는다
    const again = await finalizePartySession({ key: k, buildRecord: () => record, submit });
    expect(again.kind).toBe('busy');
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test('보존 실패(lost)면 active 로 돌아가 다시 잡히고, 저장되면 done 이후 claim 불가', () => {
    beginRideSession(key);
    claimRideSession(key);
    settleRideSession(key, { kind: 'lost' });
    expect(loadRideSession(key).state).toBe('active');
    expect(claimRideSession(key)).toBe('claimed');
    settleRideSession(key, { kind: 'saved' });
    expect(loadRideSession(key).state).toBe('done');
    expect(claimRideSession(key)).toBe('busy');
  });

  test('다른 페이지 로드에서 남은 finalizing 이나 2분 넘은 finalizing 은 다시 잡을 수 있다', () => {
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({ distanceM: 10, state: 'finalizing', owner: 'old-page', finalizingAt: now }));
    expect(claimRideSession(key, now)).toBe('claimed');

    __resetRideMemory(); // 새로고침 직후처럼 메모리 가드가 비어 있는 상태
    localStorage.setItem(key, JSON.stringify({ distanceM: 10, state: 'finalizing', owner: PAGE_LOAD_ID, finalizingAt: now }));
    expect(claimRideSession(key, now + 1000)).toBe('busy');
    expect(claimRideSession(key, now + 3 * 60 * 1000)).toBe('claimed');
  });

  test('done 쓰기가 실패하면 저장소 복구 후 다시 써서, 새로고침해도 다시 저장하지 않는다', () => {
    beginRideSession(key);
    expect(claimRideSession(key)).toBe('claimed');
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    settleRideSession(key, { kind: 'saved' });
    expect(loadRideSession(key).state).toBe('finalizing'); // 아직 저장소엔 못 씀
    setSpy.mockRestore();
    retryPendingSessionWrites(); // 다음 폴링
    expect(loadRideSession(key).state).toBe('done');
    __resetRideMemory(); // 새로고침
    expect(claimRideSession(key, Date.now() + 10 * 60 * 1000)).toBe('busy');
  });

  test('같은 페이지에서 2분 넘게 멈춘 확정은 메모리 가드도 만료되어 다시 잡을 수 있다', () => {
    const now = Date.now();
    beginRideSession(key);
    expect(claimRideSession(key, now)).toBe('claimed');
    expect(claimRideSession(key, now + 1000)).toBe('busy');
    expect(claimRideSession(key, now + 3 * 60 * 1000)).toBe('claimed');
  });

  test('A 지연 → 2분 뒤 B 성공 → A 가 늦게 lost 로 끝나도 완료가 되돌려지지 않고 추가 전송이 없다', async () => {
    const t0 = Date.now();
    beginRideSession(key);
    storeRideDistance(key, 1000);
    let failA;
    const submitA = vi.fn(() => new Promise((resolve) => { failA = () => resolve({ ok: false, kind: 'lost' }); }));
    const pA = finalizePartySession({ key, buildRecord: () => record, submit: submitA, now: t0 });

    const submitB = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
    const rB = await finalizePartySession({ key, buildRecord: () => record, submit: submitB, now: t0 + 3 * 60 * 1000 });
    expect(rB.kind).toBe('saved');
    expect(loadRideSession(key).state).toBe('done');

    failA();
    await pA;
    expect(loadRideSession(key).state).toBe('done');
    const submitC = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
    const rC = await finalizePartySession({ key, buildRecord: () => record, submit: submitC, now: t0 + 10 * 60 * 1000 });
    expect(rC.kind).toBe('busy');
    expect(submitC).not.toHaveBeenCalled();
  });

  test('finalizePartySession 은 방·도크가 동시에 불러도 한 번만 저장한다', async () => {
    beginRideSession(key);
    storeRideDistance(key, 2000);
    const submit = vi.fn().mockResolvedValue({ ok: true, kind: 'saved' });
    const build = (s) => ({ ...record, distance: s.distanceM / 1000 });
    const [a, b] = await Promise.all([
      finalizePartySession({ key, buildRecord: build, submit }),
      finalizePartySession({ key, buildRecord: build, submit }),
    ]);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0].distance).toBe(2);
    expect([a.kind, b.kind].sort()).toEqual(['busy', 'saved']);
  });
});

describe('endRideAsHost', () => {
  test('파티 종료가 실패하면 기록을 확정하지 않고, 재시도에 성공하면 한 번 확정한다', async () => {
    const finalize = vi.fn().mockResolvedValue({ kind: 'saved' });
    const stopRide = vi.fn().mockRejectedValueOnce(httpError(500)).mockResolvedValueOnce({ id: 7 });
    await expect(endRideAsHost({ stopRide, finalize })).rejects.toThrow();
    expect(finalize).toHaveBeenCalledTimes(0);
    await endRideAsHost({ stopRide, finalize });
    expect(finalize).toHaveBeenCalledTimes(1);
  });
});

describe('findEndedSessions', () => {
  const s = (partyId, rideStartedAt, state = 'active') => ({
    key: rideSessionKey(1, partyId, rideStartedAt), partyId, rideStartedAt, session: { distanceM: 100, state },
  });

  test('열린 방은 제외하고, 종료·rideStartedAt 변경·소멸 확인된 파티만 고른다', () => {
    const sessions = [
      s(1, 'a'),            // 아직 라이딩 중 → 제외
      s(2, 'b'),            // rideStartedAt 이 null 로 바뀜 → 종료
      s(3, 'c'),            // status ended → 종료
      s(4, 'd'),            // 방이 열려 있음 → 제외
      s(5, 'e'),            // 목록에 없음 + 소멸 미확인 → 보류
      s(6, 'f'),            // 목록에 없음 + 404 확인 → 종료
      s(7, 'g', 'done'),    // 이미 확정 → 제외
    ];
    const rooms = [
      { id: 1, rideStartedAt: 'a' },
      { id: 2, rideStartedAt: null },
      { id: 3, rideStartedAt: 'c', status: 'ended' },
      { id: 4, rideStartedAt: null },
      { id: 7, rideStartedAt: null },
    ];
    const ended = findEndedSessions({ userId: 1, rooms, openRidingPartyId: 4, goneIds: new Set([6]), sessions });
    expect(ended.map((e) => e.partyId)).toEqual([2, 3, 6]);
  });
});
