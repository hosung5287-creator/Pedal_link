import '../styles/demopanel.css';

import { useEffect, useState } from 'react';
import { getDemoStatus, setupDemo, getDemoState, sendDemoAction } from '../api/demo';
import { errorMessage } from '../api/client';
import { useLocationShare } from '../hooks/useLocationShare';
import { refreshDemoGeo } from '../utils/demoGeo';
import { demoPanel as t } from '../constants';

function phaseText(s) {
  if (!s.hasRoute) return t.needRoute;
  if (s.phase === 'idle') return t.idle(s.crewName);
  if (s.phase === 'waiting') return s.eventStatus === 'checking' ? t.checking : t.recruiting;
  if (s.phase === 'riding') return t.riding(s.progressKm.toFixed(2), s.lengthKm.toFixed(2));
  return t.done;
}

function riderText(r, phase) {
  if (phase === 'idle') return t.standby;
  if (!r.active) return t.notInRide;
  if (phase === 'waiting') return r.mode === 'late' ? t.coming : t.atStart;
  if (phase === 'done') return t.arrived;
  return t.modes[r.mode] || r.mode;
}

// 시연 모드 패널 — 발표자 화면 왼쪽 아래. 가상 라이더를 준비하고, 라이딩 중 이탈·합류·도착을 버튼으로 일으킨다.
// 서버가 이 계정을 발표자로 볼 때만 그린다 (DEMO_ENABLED=true + DEMO_PRESENTER_EMAILS). 브라우저마다 따로 켤 필요 없다.
export default function DemoPanel({ user }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, setShare] = useLocationShare(user.id);

  // 서버에 닿지 않으면(백엔드가 켜지는 중) 잠시 뒤 다시 묻는다 — 새로고침하지 않아도 뜨게
  useEffect(() => {
    let alive = true;
    let timer = null;
    const check = () => getDemoStatus(user.id)
      .then((s) => { if (alive) setEnabled(!!s?.enabled && s.role === 'presenter'); })
      .catch((e) => { if (alive && e?.status !== 404) timer = setTimeout(check, 5000); });
    check();
    return () => { alive = false; clearTimeout(timer); };
  }, [user.id]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => getDemoState(user.id).then((s) => { if (alive) setState(s); }).catch(() => {});
    load();
    const timer = setInterval(load, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled, user.id]);

  if (!enabled) return null;

  if (!open) {
    return <button type="button" className="dpPill" onClick={() => setOpen(true)}>{t.pill}</button>;
  }

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      setState(await fn());
    } catch (e) {
      setError(errorMessage(e, t.failed));
    } finally {
      setBusy(false);
    }
  };
  // 가상 위치(코스 출발점)로 바로 바꾸고, 인원 체크는 팀장 위치가 서버에 있어야 하므로 위치 공유를 켠다
  const prepare = () => run(async () => {
    const s = await setupDemo(user.id);
    refreshDemoGeo();
    setShare(true);
    return s;
  });
  const act = (action) => run(() => sendDemoAction(user.id, action));

  const ready = !!state?.ready;
  const riders = state?.riders || [];
  const minsu = riders.find((r) => r.key === 'minsu');
  const hyunwoo = riders.find((r) => r.key === 'hyunwoo');
  const jiyoung = riders.find((r) => r.key === 'jiyoung');
  const riding = state?.phase === 'riding';

  return (
    <section className="dpPanel" aria-label={t.title}>
      <header className="dpHead">
        <strong>{t.title}</strong>
        <button type="button" className="dpFold" onClick={() => setOpen(false)} aria-label={t.fold}>−</button>
      </header>

      {!ready ? (
        <>
          <p className="dpText">{t.intro}</p>
          <button type="button" className="dpMainBtn" disabled={busy} onClick={prepare}>
            {busy ? t.preparing : t.prepare}
          </button>
        </>
      ) : (
        <>
          <p className="dpText">{phaseText(state)}</p>
          <ul className="dpRiders">
            {riders.map((r) => (
              <li key={r.key} className={r.active ? '' : 'isOff'}>
                <span className="dpName">{r.name}</span>
                <span className="dpMode">
                  {riderText(r, state.phase)}
                  {r.active && r.distanceM != null && state.phase !== 'idle' && <em>{r.distanceM}m</em>}
                </span>
              </li>
            ))}
          </ul>
          <div className="dpActions">
            <button type="button" disabled={busy || !riding || !minsu?.active || minsu.mode !== 'formation'} onClick={() => act('stray')}>{t.stray}</button>
            <button type="button" disabled={busy || !riding || !['stray', 'away'].includes(minsu?.mode)} onClick={() => act('return')}>{t.back}</button>
            <button type="button" disabled={busy || !riding || !hyunwoo?.active || hyunwoo.mode !== 'late'} onClick={() => act('join')}>{t.join}</button>
            <button type="button" disabled={busy || !state.canSkip} onClick={() => act('finish')}>{t.finish}</button>
          </div>
          {jiyoung && <p className="dpLogin">{t.login(jiyoung.email, state.password)}</p>}
        </>
      )}

      {error && <p className="dpError" role="alert">{error}</p>}
    </section>
  );
}
