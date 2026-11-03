import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { homeMatch } from '../../constants';
import './match-live-demo.css';

const t = homeMatch.demo;
const letterOf = (name) => (name || '?').trim().charAt(0);

// 지도에서 '나'와 반경의 위치 — match-live-demo.css 의 .mldMe·.mldRadius 와 같은 값
const ME = { x: 0.5, y: 0.38 };
const RADIUS_OF_WIDTH = 0.19; // 원 지름 = 지도 폭의 38%
const RADIUS_M = 50;

// 커서와 '나' 사이 거리(px) → 표시할 거리(m). 원 안은 0~50m, 밖은 멀수록 크게 늘어난다
const metersOf = (distance, radius) => {
  if (distance <= radius) return Math.max(1, Math.round((distance / radius) * RADIUS_M));
  return Math.round((RADIUS_M + ((distance - radius) / radius) * 180) / 10) * 10;
};

// 라이더 핀 위치(지도 영역 기준 %) — 민재는 반경 밖에서 안으로 다가온다
const PINS = [
  { from: { left: '84%', top: '12%' }, to: { left: '61%', top: '31%' } },
  { from: { left: '16%', top: '17%' } },
  { from: { left: '13%', top: '47%' } },
];

// 강조 펄스 — 렌더마다 새 객체를 만들면 애니메이션이 다시 시작되므로 고정해 둔다
const PULSE = { scale: [1, 1, 1.06, 1] };
const PULSE_JOIN = { delay: 4.2, duration: 1, times: [0, 0.3, 0.6, 1] };

// 화면용 시연일 뿐 — 위치·매칭 API 를 부르지 않는다.
function Scene({ reduced }) {
  // at(초) 에 아래에서 살짝 올라오며 나타난다. 모션 줄이기면 처음부터 최종 상태.
  const at = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.45, delay: reduced ? 0 : delay },
  });
  const [minjae] = t.riders;
  // 라이더 핀·칩을 올리면 서로 강조
  const [hovered, setHovered] = useState(null);
  // 지도 위에 마우스를 올리면 민재가 커서가 된다 — { left, top(%), meters, inside }. 벗어나면 null
  const [tracked, setTracked] = useState(null);
  const [touched, setTouched] = useState(false); // 한 번이라도 조작했으면 자동 시연의 지연을 건너뛴다
  const onMapMove = (event) => {
    if (event.pointerType === 'touch') return;
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const radius = box.width * RADIUS_OF_WIDTH;
    const distance = Math.hypot(px - box.width * ME.x, py - box.height * ME.y);
    setTouched(true);
    setTracked({
      left: `${(px / box.width) * 100}%`,
      top: `${(py / box.height) * 100}%`,
      meters: metersOf(distance, radius),
      inside: distance <= radius,
    });
  };
  const onMapLeave = () => { setTracked(null); setHovered(null); };
  // 민재가 반경 안으로 들어온 순간(3.3초)부터 브랜드 색(하늘)으로 강조된다
  const [near, setNear] = useState(reduced);
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setNear(true), 3300);
    return () => clearTimeout(id);
  }, [reduced]);
  // 함께 타기 버튼이 눌린 뒤(5초) 완료 배지로 전환
  const [matched, setMatched] = useState(reduced);
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setMatched(true), 5000);
    return () => clearTimeout(id);
  }, [reduced]);

  const isNear = tracked ? tracked.inside : near;
  const distOf = (r, i) => {
    if (i === 0 && tracked) return `${tracked.meters}m`;
    return i === 0 && isNear && r.near ? r.near : r.far;
  };
  const showAlert = tracked ? tracked.inside : true;
  const showMatched = !tracked && (matched || touched);
  const showJoin = tracked ? tracked.inside : !showMatched;

  return (
    <>
      <div className="mldMap" aria-hidden="true" onPointerMove={onMapMove} onPointerLeave={onMapLeave}>
        <img src="/images/home/map-match.jpg" alt="" width="1720" height="900" />

        <motion.div className={`mldRadius${tracked?.inside ? ' isInside' : ''}`} {...at(0.4)}>
          {!reduced && (
            <motion.span
              className="mldPulse"
              animate={{ scale: [1, 1.35], opacity: [0.45, 0] }}
              // 매칭 완료(5초) 전까지 두 번만 퍼지고 멈춘다 — 1회 재생 후 마지막 상태 유지
              transition={{ duration: 1.8, repeat: 1, ease: 'easeOut', delay: 0.6 }}
            />
          )}
          <span className="mldRadiusLabel">{t.radius}</span>
        </motion.div>

        <motion.div className="mldMe" {...at(0.2)}><span>{t.me}</span></motion.div>

        {t.riders.map((r, i) => {
          const pin = PINS[i];
          const appear = 0.8 + i * 0.3;
          const moving = Boolean(pin.to);
          return (
            <motion.div
              key={r.name}
              className={`mldPin${moving && isNear ? ' isNear' : ''}${hovered === i ? ' isHover' : ''}${moving && tracked ? ' isCursor' : ''}`}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              initial={reduced ? false : { opacity: 0, scale: 0.6, ...pin.from }}
              animate={{ opacity: 1, scale: 1, ...(moving ? (tracked ? { left: tracked.left, top: tracked.top } : pin.to) : pin.from) }}
              transition={reduced ? { duration: 0 } : {
                opacity: { delay: touched ? 0 : appear, duration: 0.35 },
                scale: { delay: touched ? 0 : appear, type: 'spring', stiffness: 260, damping: 18 },
                // 커서를 따라갈 땐 바로, 벗어나면 제자리로 부드럽게 돌아간다
                left: tracked ? { duration: 0 } : { delay: touched ? 0 : 2, duration: touched ? 0.5 : 1.4, ease: 'easeInOut' },
                top: tracked ? { duration: 0 } : { delay: touched ? 0 : 2, duration: touched ? 0.5 : 1.4, ease: 'easeInOut' },
              }}
            >
              {letterOf(r.name)}
              {(hovered === i || (moving && tracked)) && <span className="mldPinTip">{r.name} · {distOf(r, i)}</span>}
            </motion.div>
          );
        })}

        {showAlert && (
          <motion.div className="mldAlert" {...at(touched ? 0 : 3.5)}>
            <span className="mldAlertDot" />{t.nearAlert}
          </motion.div>
        )}
      </div>

      <div className="mldPanel">
        <div className="mldPanelHead">
          <strong>{t.panelTitle}</strong>
          <span>{t.panelBadge}</span>
        </div>
        <ul className="mldList">
          {t.riders.map((r, i) => (
            <motion.li
              key={r.name}
              className={`${i === 0 && isNear ? 'isNear' : ''}${hovered === i ? ' isHover' : ''}`}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(null)}
              {...at(0.8 + i * 0.3)}
            >
              <span className="mldAvatar" aria-hidden="true">{letterOf(r.name)}</span>
              <span className="mldName">{r.name}</span>
              <span className="mldDist">
                {i === 0 && (tracked || touched) ? (
                  <span className={isNear ? 'mldDistLive isNear' : 'mldDistLive'}>{distOf(r, i)}</span>
                ) : i === 0 && r.near ? (
                  <>
                    <motion.span
                      className="mldDistFar"
                      initial={reduced ? false : { opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ delay: reduced ? 0 : 3.3, duration: reduced ? 0 : 0.25 }}
                    >
                      {r.far}
                    </motion.span>
                    <motion.span
                      className="mldDistNear"
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: reduced ? 0 : 3.3, duration: reduced ? 0 : 0.25 }}
                    >
                      {r.near}
                    </motion.span>
                  </>
                ) : r.far}
              </span>
            </motion.li>
          ))}
        </ul>
        {/* 매칭 전엔 버튼만, 매칭되면 같은 자리에서 완료 배지로 바뀐다 */}
        <div className="mldAction">
          <AnimatePresence mode="wait" initial={false}>
            {showMatched ? (
              <motion.p key="matched" className="mldMatched"
                initial={reduced ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduced ? 0 : 0.3 }}>
                <span className="mldMatchedIcon" aria-hidden="true">✓</span>{t.matched}
              </motion.p>
            ) : showJoin ? (
              <motion.div key="join" {...at(touched ? 0 : 3.9)} exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}>
                <motion.div className="mldJoin" animate={reduced || touched ? undefined : PULSE} transition={PULSE_JOIN}>
                  {minjae.name} · {t.joinBtn}
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function MatchLiveDemo() {
  const ref = useRef(null);
  // 처음 보일 때 한 번만 재생 — 스크롤로 벗어났다 돌아와도 다시 시작하지 않는다(다시 보기로만 재시작)
  const visible = useInView(ref, { amount: 0.25, once: true });
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  return (
    <div className="mld" ref={ref}>
      {/* 시연 장면은 그림 한 장처럼 읽히게 하고, 버튼·링크는 그 밖에 둔다 */}
      <div className="mldStage" role="img" aria-label={t.aria}>
        {visible && <Scene key={replay} reduced={reduced} />}
      </div>
      <button className="mldReplay" type="button" onClick={() => setReplay((v) => v + 1)} aria-label={t.replayAria}>
        ↻ <span>{t.replay}</span>
      </button>
      <a className="mldCredit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        {t.credit}
      </a>
    </div>
  );
}
