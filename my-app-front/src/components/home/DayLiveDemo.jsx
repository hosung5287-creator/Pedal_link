import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import BrandLogo from '../BrandLogo';
import { homeDraft } from '../../constants';
import './day-live-demo.css';

const t = homeDraft.action.demo;
const STEPS = t.steps;
const letterOf = (name) => (name || '?').trim().charAt(0);

// 폰 지도 위 경로(폰 화면 기준 %) — 멤버 3명이 앞뒤로 붙어 함께 이동한다
const ROUTE = [[18, 72], [30, 62], [44, 58], [58, 48], [70, 40], [82, 30]];
const ROUTE_D = `M${ROUTE.map(([x, y]) => `${x} ${y}`).join(' L')}`;
const COUNTDOWN_MS = 1500;

// 단계 진입 후 ms 가 지나면 true (모션 줄이기면 처음부터 true)
function useAfter(ms, still) {
  const [done, setDone] = useState(still);
  useEffect(() => {
    if (still) return undefined;
    const id = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(id);
  }, [ms, still]);
  return done;
}

// 0 → target 으로 올라가는 숫자 (함께 출발 HUD)
function useCountUp(target, { start, duration, still }) {
  const [value, setValue] = useState(still ? target : 0);
  useEffect(() => {
    if (still || !start) return undefined;
    const begin = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - begin) / duration);
      setValue(target * p);
      if (p === 1) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [target, start, duration, still]);
  return value;
}

const pop = (still, delay = 0) => ({
  initial: still ? false : { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: still ? 0 : 0.4, delay: still ? 0 : delay },
});

function MapBg() {
  return <img className="dldMap" src="/images/course/map-demo.png" alt="" width="1720" height="900" />;
}

function NoticeScreen({ s, still }) {
  return (
    <div className="dldScreen dldHome">
      <div className="dldAppBar"><BrandLogo />{t.brand}</div>
      <motion.div className="dldNotice"
        initial={still ? false : { opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }}
        transition={still ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, delay: 0.4 }}>
        <span className="dldNoticeIcon" aria-hidden="true">🚲</span>
        <div><strong>{s.notice}</strong><small>{s.noticeSub}</small></div>
      </motion.div>
      <div className="dldSkeleton" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}

function PartyScreen({ s, still }) {
  const pressed = useAfter(2000, still);
  return (
    <div className="dldScreen">
      <MapBg />
      <motion.span className="dldPartyPin" style={{ left: '38%', top: '34%' }} {...pop(still, 0.2)}>2/4</motion.span>
      <motion.span className="dldPartyPin isMuted" style={{ left: '70%', top: '22%' }} {...pop(still, 0.35)}>1/3</motion.span>
      <motion.div className="dldSheet" {...pop(still, 0.6)}>
        <strong>{s.party}</strong>
        <small>{s.partyMeta}</small>
        <motion.span className={`dldBtn${pressed ? ' isPressed' : ''}`}
          animate={pressed && !still ? { scale: [1, 0.94, 1] } : undefined} transition={{ duration: 0.3 }}>
          {s.join}
        </motion.span>
      </motion.div>
    </div>
  );
}

function ApproveScreen({ s, still }) {
  const approved = useAfter(1000, still);
  const shown = approved ? s.members : s.members.slice(0, 2);
  return (
    <div className="dldScreen dldRoom">
      <div className="dldAppBar"><BrandLogo />{STEPS[1].party}</div>
      <div className="dldMembers">
        {shown.map((m) => (
          <motion.span key={m} className={`dldAvatar${m === s.members[2] ? ' isMe' : ''}`}
            initial={still ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
            {letterOf(m)}
          </motion.span>
        ))}
        <b>{approved ? s.count : '2/4'}</b>
      </div>
      {approved && <motion.p className="dldApproved" {...pop(still)}>✓ {s.approved}</motion.p>}
    </div>
  );
}

function RideScreen({ s, still }) {
  const go = useAfter(COUNTDOWN_MS, still);
  const runMs = STEPS[3].ms - COUNTDOWN_MS;
  const speed = useCountUp(24.5, { start: go, duration: runMs * 0.6, still });
  const dist = useCountUp(3.2, { start: go, duration: runMs, still });
  return (
    <div className="dldScreen">
      <MapBg />
      <svg className="dldRoute" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={ROUTE_D} />
      </svg>
      {go && [0, 1, 2].map((i) => {
        const path = ROUTE.slice(0, ROUTE.length - i);
        const end = path[path.length - 1];
        return (
          <motion.span key={i} className={`dldRider${i === 2 ? ' isMe' : ''}`}
            initial={still ? false : { left: `${path[0][0]}%`, top: `${path[0][1]}%` }}
            animate={still ? { left: `${end[0]}%`, top: `${end[1]}%` }
              : { left: path.map((p) => `${p[0]}%`), top: path.map((p) => `${p[1]}%`) }}
            transition={still ? { duration: 0 } : { duration: runMs / 1000, ease: 'linear', delay: i * 0.15 }} />
        );
      })}
      {!go && s.countdown.map((n, i) => (
        <motion.span key={n} className="dldCount" initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 1.2] }}
          transition={{ delay: i * 0.5, duration: 0.5, times: [0, 0.3, 1] }}>{n}</motion.span>
      ))}
      <div className="dldHud">
        <div><strong>{speed.toFixed(1)}</strong><small>{s.speedUnit}</small></div>
        <div><strong>{dist.toFixed(1)}</strong><small>{s.distUnit}</small></div>
      </div>
    </div>
  );
}

function SavedScreen({ s, still }) {
  return (
    <div className="dldScreen dldHome">
      <div className="dldAppBar"><BrandLogo />{t.brand}</div>
      <motion.div className="dldSaved"
        initial={still ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={still ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 18, delay: 0.2 }}>
        <span className="dldCheck" aria-hidden="true">✓</span>
        <strong>{s.saved}</strong>
        <div className="dldStats">
          {s.stats.map((x, i) => (
            <motion.div key={x.u} {...pop(still, 0.5 + i * 0.15)}><b>{x.v}</b><small>{x.u}</small></motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const SCREENS = [NoticeScreen, PartyScreen, ApproveScreen, RideScreen, SavedScreen];

// 앱 하루 사용 흐름 시연 — 왼쪽 단계 자막, 오른쪽 폰 화면. 고정 예시라 API 를 부르지 않는다.
export default function DayLiveDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(() => (reduced ? STEPS.length - 1 : 0));
  const [paused, setPaused] = useState(false);
  const auto = inView && !paused && !reduced;

  // 단계마다 정해진 시간이 지나면 다음 단계, 마지막 다음은 처음으로
  useEffect(() => {
    if (!auto) return undefined;
    const id = setTimeout(() => setStep((i) => (i + 1) % STEPS.length), STEPS[step].ms);
    return () => clearTimeout(id);
  }, [auto, step]);

  const s = STEPS[step];
  const Screen = SCREENS[step];

  return (
    <div className="dld" ref={ref}>
      <ol className="dldSteps" aria-label={t.stepsLabel}>
        {STEPS.map((x, i) => (
          <li key={x.title}>
            <button type="button" className={`dldStep${i === step ? ' isActive' : ''}`}
              aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
              <span className="dldTime">{x.time}</span>
              <strong>{x.title}</strong>
              <small>{x.desc}</small>
              {i === step && auto && (
                <motion.i key={`bar-${step}`} className="dldBar" initial={{ width: 0 }} animate={{ width: '100%' }}
                  transition={{ duration: x.ms / 1000, ease: 'linear' }} />
              )}
            </button>
          </li>
        ))}
      </ol>

      <div className="dldStage">
        <div className="dldPhone" role="img" aria-label={`${t.aria}: ${s.title} — ${s.desc}`}>
          <span className="dldNotch" aria-hidden="true" />
          {/* 이전·다음 화면을 겹쳐서 바꾼다(크로스페이드) — 전환 중 빈 화면이 생기지 않게 */}
          <AnimatePresence initial={false}>
            <motion.div key={step} className="dldScreenWrap"
              initial={reduced ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -24 }} transition={{ duration: reduced ? 0 : 0.3 }}>
              <Screen s={s} still={reduced} />
            </motion.div>
          </AnimatePresence>
        </div>
        <button type="button" className="dldPause" onClick={() => setPaused((p) => !p)}
          disabled={reduced} aria-pressed={paused || reduced}
          aria-label={reduced ? t.playDisabled : paused ? t.play : t.pause}>
          <span aria-hidden="true">{paused || reduced ? '▶' : 'Ⅱ'}</span>
        </button>
      </div>
    </div>
  );
}
