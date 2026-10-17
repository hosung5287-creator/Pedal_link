import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import BrandLogo from '../BrandLogo';
import { homeCrew } from '../../constants';
import './party-live-demo.css';
import './crew-live-demo.css';

const t = homeCrew.demoText;
const letterOf = (name) => (name || '?').trim().charAt(0);

// 지도 이미지(map-crew.jpg, 1720×900, z15) 위 크루 모임 장소 — 이촌한강공원 · 남산 · 한남
// 첫 번째가 시연의 주인공(한강 새벽 크루)
const PINS = [[580, 847], [883, 185], [1279, 626]];
const pct = ([x, y]) => ({ left: `${(x / 1720) * 100}%`, top: `${(y / 900) * 100}%` });
const MEET = pct(PINS[0]);

const PULSE = { scale: [1, 1, 1.06, 1] };
const pulseAt = (delay) => ({ delay, duration: 1.2, times: [0, 0.4, 0.7, 1] });
const PULSE_JOIN = pulseAt(0.6);
const PULSE_ATTEND = pulseAt(1);

// ms 뒤에 true — 버튼 상태가 바뀌는 순간용. 모션 줄이기면 처음부터 true.
function useAfter(ms, reduced) {
  const [done, setDone] = useState(reduced);
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(id);
  }, [ms, reduced]);
  return done;
}

// 화면용 시연일 뿐 — 크루 API 를 부르지 않는다. 골격·스타일은 파티 시연(.pld)과 같다.
function Scene({ stage, reduced }) {
  const at = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.45, delay: reduced ? 0 : delay },
  });
  const picked = useAfter(1800, reduced || stage !== 0);
  const pending = useAfter(1700, reduced || stage !== 1);
  const joined = useAfter(3300, reduced || stage !== 1);
  const attending = useAfter(2000, reduced || stage !== 2);
  const crew = t.crews[0];

  return (
    <>
      <div className="pldMap" aria-hidden="true">
        <img src="/images/home/map-crew.jpg" alt="" width="1720" height="900" />

        {/* 크루 모임 장소 핀 — 찾기 단계에선 3개, 이후엔 내 크루 하나 */}
        {(stage === 0 ? t.crews : [crew]).map((c, i) => (
          <motion.div key={c.name} className={`crdPin${(stage === 0 && picked && i === 0) || stage > 0 ? ' isActive' : ''}`}
            style={pct(PINS[i])}
            initial={reduced ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduced ? 0 : (stage === 0 ? 0.3 + i * 0.25 : 0.1), type: 'spring', stiffness: 260, damping: 18 }}>
            <BrandLogo /><span>{stage === 2 ? t.meetPoint : c.name}</span>
          </motion.div>
        ))}

        {/* 정기 라이딩 — 멤버들이 모임 장소로 모인다 */}
        {stage === 2 && t.members.map((name, i) => {
          const from = pct([[1100, 700], [1500, 300], [300, 720], [1250, 120]][i]);
          // 모임 장소 핀 오른쪽에 나란히 (지도 아래 끝이라 위·아래 대신 옆으로)
          const to = { left: `calc(${MEET.left} + ${7 + i * 3}%)`, top: `calc(${MEET.top} - 4%)` };
          return (
            <motion.div key={name} className="pldMember"
              initial={reduced ? false : { ...from, opacity: 0 }}
              animate={reduced ? to : { ...to, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { duration: 1.6, delay: 0.4 + i * 0.25, ease: [0.22, 1, 0.36, 1] }}>
              {letterOf(name)}
            </motion.div>
          );
        })}
      </div>

      <aside className="pldPanel">
        <div className="pldAppHead">
          {stage > 0 && <span className="pldBack" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></span>}
          <strong>{t.appTitles[stage]}</strong>
          {stage === 0 && <span className="pldLive">{t.live}</span>}
        </div>

        {stage === 0 && (
          <>
            <motion.div className="crdChips" {...at(0.1)}>
              {t.filters.map((label) => <span key={label} className="crdChip">{label}</span>)}
            </motion.div>
            <div className="crdList">
              {t.crews.map((c, i) => (
                <motion.div key={c.name} className={`crdItem${picked && i === 0 ? ' isActive' : ''}`} {...at(0.3 + i * 0.25)}>
                  <strong>{c.name}</strong>
                  <span>{c.region} · {c.schedule}</span>
                  <b>{c.members}{t.memberUnit}</b>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {stage === 1 && (
          <>
            <motion.div className="pldCard" {...at(0.2)}>
              <div className="pldCardHead">
                <strong>{crew.name}</strong>
                <span className="pldBadge isRiding">{crew.tag}</span>
              </div>
              <p>{crew.region}</p>
              <p>{crew.schedule}</p>
              <p className="crdCount">{joined ? crew.members + 1 : crew.members}{t.memberUnit}</p>
            </motion.div>
            <motion.div {...at(0.4)}>
              <motion.div className={`pldButton crdJoin${joined ? ' isJoined' : pending ? ' isPending' : ''}`}
                animate={reduced || pending ? undefined : PULSE} transition={PULSE_JOIN}>
                {joined ? `✓ ${t.joined}` : pending ? t.pending : t.join}
              </motion.div>
            </motion.div>
            {joined && <motion.p className="pldNote" {...at(0)}>{t.approvedNote}</motion.p>}
          </>
        )}

        {stage === 2 && (
          <>
            <motion.div className="pldCard" {...at(0.2)}>
              <div className="pldCardHead">
                <strong>{t.upcomingTitle}</strong>
                <span className="pldBadge">{crew.name}</span>
              </div>
              <p>{t.ride.when}</p>
              <p>{t.ride.where}</p>
            </motion.div>
            <motion.div {...at(0.5)}>
              <motion.div className={`pldButton crdJoin${attending ? ' isJoined' : ''}`}
                animate={reduced || attending ? undefined : PULSE} transition={PULSE_ATTEND}>
                {attending ? `✓ ${t.attendYes}` : t.attendYes}
              </motion.div>
            </motion.div>
            <motion.div className="pldMembers" {...at(0.7)}>
              <small>{attending ? t.attendCount : t.attendCountBefore}</small>
              <div>
                {t.members.map((name) => <span key={name} className="pldAvatar" title={name}>{letterOf(name)}</span>)}
              </div>
            </motion.div>
          </>
        )}
      </aside>
    </>
  );
}

export default function CrewLiveDemo({ stage }) {
  const ref = useRef(null);
  // 처음 보일 때 한 번만 재생 — 항목 전환·다시 보기로만 재시작
  const visible = useInView(ref, { amount: 0.25, once: true });
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  return (
    <div className="pld" ref={ref}>
      <div className="pldStage" role="img" aria-label={`${t.aria}: ${homeCrew.features[stage]?.title ?? ''}`}>
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
