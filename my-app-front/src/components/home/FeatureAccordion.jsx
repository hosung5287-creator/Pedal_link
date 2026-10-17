import { useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import CourseLiveDemo from './CourseLiveDemo';
import './feature-accordion.css';

// 펼친 설명 — 닫히는 애니메이션(퇴장) 동안에도 화면낭독기에는 즉시 숨긴다
function Panel({ id, labelledBy, reduced, children }) {
  const present = useIsPresent();
  return (
    <motion.div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      aria-hidden={present ? undefined : true}
      inert={present ? undefined : true}
      className="featAccPanel"
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reduced ? undefined : { height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// 왼쪽 아코디언(번호·제목, 펼친 항목만 설명) + 오른쪽 시연 (Meta Muse 참고).
// 항상 하나는 펼쳐져 있다 — 오른쪽 시연의 stage 와 1:1 로 맞물리기 때문.
// 1200px 이상에서만 좌우 배치, 그보다 좁으면 목록 위·시연 아래(시연은 전체 폭).
export default function FeatureAccordion({ features, label, Demo = CourseLiveDemo, idPrefix = 'course' }) {
  const [active, setActive] = useState(0);
  const buttons = useRef([]);
  const reduced = useReducedMotion();

  const onKeyDown = (event, index) => {
    const last = features.length - 1;
    const next = event.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <motion.div
      className="featAcc"
      initial={reduced ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="featAccList" role="group" aria-label={label}>
        {features.map((f, i) => {
          const open = i === active;
          const btnId = `${idPrefix}-acc-btn-${i}`;
          const panelId = `${idPrefix}-acc-panel-${i}`;
          return (
            <div key={f.title} className={`featAccItem${open ? ' isOpen' : ''}`}>
              <h3 className="featAccHeading">
                <button
                  ref={(node) => { buttons.current[i] = node; }}
                  type="button"
                  id={btnId}
                  className="featAccBtn"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <span className="featAccNum" aria-hidden="true">0{i + 1}</span>
                  <span className="featAccTitle">{f.title}</span>
                </button>
              </h3>
              {/* 접힌 설명은 렌더하지 않는다 — 접근성 트리에서도 빠진다 */}
              <AnimatePresence initial={false}>
                {open && (
                  <Panel key="panel" id={panelId} labelledBy={btnId} reduced={reduced}>
                    <p>{f.desc}</p>
                  </Panel>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="featAccMedia">
        <Demo stage={active} />
      </div>
    </motion.div>
  );
}
