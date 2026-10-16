import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import BrandLogo from '../BrandLogo';
import { homeParty } from '../../constants';
import './party-live-demo.css';

const t = homeParty.demoText;
const letterOf = (name) => (name || '?').trim().charAt(0);

// 지도 이미지(map-party.jpg, 1720×900, z16) 위 경로 좌표 — 이촌한강공원 한강북자전거길(한강대교 → 반포대교)
const ROUTE = [[150, 485], [330, 595], [500, 665], [720, 740], [860, 765], [1000, 775], [1160, 775], [1350, 740], [1500, 680], [1600, 620]];
const ROUTE_D = `M${ROUTE.map(([x, y]) => `${x} ${y}`).join(' L')}`;
const pct = ([x, y]) => ({ left: `${(x / 1720) * 100}%`, top: `${(y / 900) * 100}%` });
const START = pct(ROUTE[0]);
// 같이 출발할 때 멤버마다 멈추는 지점(앞사람부터) — 한 덩어리로 달리는 느낌
const STOP_AT = [9, 8, 7];

// 강조 펄스 — 렌더마다 새 객체를 만들면 framer-motion 이 애니메이션을 다시 시작하므로 고정해 둔다
const PULSE = { scale: [1, 1, 1.06, 1] };
const pulseAt = (delay) => ({ delay, duration: 1.2, times: [0, 0.4, 0.7, 1] });
const PULSE_OPEN = pulseAt(1.4);
const PULSE_APPROVE = pulseAt(0.6);

// at(초) 뒤에 true — 숫자·색이 바뀌는 순간용. 모션 줄이기면 처음부터 true.
function useAfter(ms, reduced) {
  const [done, setDone] = useState(reduced);
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(id);
  }, [ms, reduced]);
  return done;
}

// 화면용 시연일 뿐 — 파티 API 를 부르지 않는다.
function Scene({ stage, reduced }) {
  const at = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.45, delay: reduced ? 0 : delay },
  });
  const opened = useAfter(2600, reduced || stage !== 0);
  const joined = useAfter(1800, reduced || stage === 2);
  // 모집 인원: 개설 0→1(방장) / 승인 2→3 / 출발 3
  const memberCount = stage === 0 ? (opened ? 1 : 0) : stage === 1 && !joined ? 2 : 3;
  const startCount = stage === 0 ? 0 : stage === 1 ? 2 : 3;
  const members = t.members.slice(0, memberCount);

  return (
    <>
      <div className="pldMap" aria-hidden="true">
        <img src="/images/home/map-party.jpg" alt="" width="1720" height="900" />
        <svg className="pldRoute" viewBox="0 0 1720 900" preserveAspectRatio="none">
          <motion.path className="pldRouteCase" d={ROUTE_D}
            initial={{ pathLength: reduced || stage !== 0 ? 1 : 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 1.2, delay: reduced ? 0 : 0.3 }} />
          <motion.path className="pldRouteLine" d={ROUTE_D}
            initial={{ pathLength: reduced || stage !== 0 ? 1 : 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 1.2, delay: reduced ? 0 : 0.3 }} />
        </svg>

        <motion.div className="pldStart" style={START} {...at(stage === 0 ? 0.2 : 0)}>
          <BrandLogo /><span>{t.mapStart}</span>
        </motion.div>

        {/* 멤버 핀 — 승인 단계에선 출발점에 모이고, 출발 단계에선 경로를 따라 함께 이동 */}
        {stage >= 1 && members.map((name, i) => {
          const near = { left: `calc(${START.left} + ${(i - 1) * 3}%)`, top: `calc(${START.top} + 7%)` };
          if (stage === 1) {
            return (
              <motion.div key={name} className="pldMember" style={near}
                initial={reduced ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduced ? 0 : (i < 2 ? 0.1 + i * 0.15 : 0), type: 'spring', stiffness: 260, damping: 18 }}>
                {letterOf(name)}
              </motion.div>
            );
          }
          const path = ROUTE.slice(0, STOP_AT[i] + 1).map(pct);
          const end = path[path.length - 1];
          return (
            <motion.div key={name} className="pldMember isRiding"
              initial={reduced ? false : { left: path[0].left, top: path[0].top }}
              animate={reduced ? end : { left: path.map((p) => p.left), top: path.map((p) => p.top) }}
              transition={reduced ? { duration: 0 } : { duration: 3.6, delay: 3 + i * 0.3, ease: 'linear' }}>
              {letterOf(name)}
            </motion.div>
          );
        })}

        {/* 같이 출발 카운트다운 3·2·1·출발! — 숫자가 밝은 지도 위에서도 보이게 잠깐 어둡게 깐다 */}
        {stage === 2 && !reduced && (
          <motion.div className="pldCountDim" initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: 0.1, duration: 3.1, times: [0, 0.1, 0.85, 1] }} />
        )}
        {stage === 2 && !reduced && t.countdown.map((n, i) => {
          const last = i === t.countdown.length - 1;
          return (
            <motion.div key={n} className={`pldCount${last ? ' isGo' : ''}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={last ? { opacity: [0, 1, 1, 0], scale: [0.7, 1, 1, 1.05] } : { opacity: [0, 1, 0], scale: [0.7, 1, 1.15] }}
              transition={{ delay: 0.2 + i * 0.7, duration: last ? 1.6 : 0.7, times: last ? [0, 0.2, 0.8, 1] : [0, 0.3, 1] }}>
              {n}
            </motion.div>
          );
        })}
      </div>

      <aside className="pldPanel">
        <div className="pldAppHead">
          {stage > 0 && <span className="pldBack" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></span>}
          <strong>{t.appTitle}</strong>
          <span className="pldLive">{t.live}</span>
        </div>

        <motion.div className="pldCard" {...at(0.2)}>
          <div className="pldCardHead">
            <strong>{t.partyTitle}</strong>
            {stage === 0 && opened && <motion.span className="pldBadge" {...at(0)}>{t.opened}</motion.span>}
            {stage === 2 && <span className="pldBadge isRiding">{t.riding}</span>}
          </div>
          <p>{t.course}</p>
          <p>{t.time}</p>
          <div className="pldCapacity">
            <small>{t.capacityLabel}</small>
            <div className="pldBar">
              <motion.i initial={reduced ? false : { width: `${(startCount / 4) * 100}%` }}
                animate={{ width: `${(memberCount / 4) * 100}%` }} transition={{ duration: reduced ? 0 : 0.4 }} />
            </div>
            <b>{memberCount}/4</b>
          </div>
        </motion.div>

        {stage === 0 && (
          <motion.div {...at(1.2)}>
            <motion.div className="pldButton" animate={reduced ? undefined : PULSE} transition={PULSE_OPEN}>
              {t.openBtn}
            </motion.div>
          </motion.div>
        )}

        {stage === 1 && (
          <motion.div className="pldRequest" {...at(0.3)}>
            <small>{t.requestTitle}</small>
            <div className="pldRequestRow">
              <span className="pldAvatar">{letterOf(t.requester)}</span>
              <span>{joined ? t.approved : t.requestMsg}</span>
              {!joined && (
                <motion.span className="pldApprove"
                  animate={reduced ? undefined : PULSE} transition={PULSE_APPROVE}>
                  {t.approve}
                </motion.span>
              )}
              {joined && <span className="pldCheck" aria-hidden="true">✓</span>}
            </div>
          </motion.div>
        )}

        {stage >= 1 && (
          <motion.div className="pldMembers" {...at(stage === 1 ? 0.1 : 0.2)}>
            <small>{t.membersLabel}</small>
            <div>
              {members.map((name) => (
                <motion.span key={name} className="pldAvatar" title={name}
                  initial={reduced ? false : { opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
                  {letterOf(name)}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {stage === 2 && <motion.p className="pldNote" {...at(2.9)}>{t.rideNote}</motion.p>}
      </aside>
    </>
  );
}

export default function PartyLiveDemo({ stage }) {
  const ref = useRef(null);
  // 처음 보일 때 한 번만 재생 — 탭 전환·다시 보기로만 재시작
  const visible = useInView(ref, { amount: 0.25, once: true });
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  return (
    <div className="pld" ref={ref}>
      <div className="pldStage" role="img" aria-label={`${t.aria}: ${homeParty.features[stage]?.title ?? ''}`}>
        {visible && <Scene key={`${stage}-${replay}`} stage={stage} reduced={reduced} />}
      </div>
      <button className="pldReplay" type="button" onClick={() => setReplay((v) => v + 1)} aria-label={t.replayAria}>
        ↻ <span>{t.replay}</span>
      </button>
      <a className="pldCredit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        {t.credit}
      </a>
    </div>
  );
}
