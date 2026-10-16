import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { homeTogether as t } from '../../constants';
import { fadeUp, stagger, viewportOnce } from '../../utils/motion';
import './together-section.css';

// 함께 달리기 — 폴더 탭(파티 | 크루) 아래 큰 판 하나. 탭을 바꾸면 판 안의 화면이 바뀐다.
// 판 안은 실제 파티·크루 화면 캡처로 채울 예정 — 지금은 자리표시. (이전 코드 시연: PartyLiveDemo·CrewLiveDemo)
export default function TogetherSection() {
  const [active, setActive] = useState(0);
  const tabs = useRef([]);
  const tab = t.tabs[active];

  // 탭 목록 키보드: ←/→ 이동, Home/End 처음/끝 (WAI-ARIA tabs 패턴)
  const onKeyDown = (event, index) => {
    const last = t.tabs.length - 1;
    const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section className="homeShowcase isWash" aria-label={t.title}>
      <div className="homeShowcaseInner">
        <motion.div className="homeShowcaseHead" variants={stagger} initial="hidden" whileInView="show" viewport={viewportOnce}>
          <motion.span className="homePill" variants={fadeUp}>{t.eyebrow}</motion.span>
          <motion.h2 variants={fadeUp}>{t.title}</motion.h2>
          <motion.p className="homeShowcaseSub" variants={fadeUp}>{t.sub}</motion.p>
        </motion.div>

        <div className="tgFolder">
          <div className="tgTabs" role="tablist" aria-label={t.tabsLabel}>
            {t.tabs.map((item, i) => (
              <button
                key={item.id}
                ref={(node) => { tabs.current[i] = node; }}
                type="button"
                role="tab"
                id={`together-tab-${item.id}`}
                aria-selected={i === active}
                aria-controls={`together-panel-${item.id}`}
                tabIndex={i === active ? 0 : -1}
                className={`tgTab${i === active ? ' isActive' : ''}`}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>
          <div className="tgPanel" role="tabpanel" id={`together-panel-${tab.id}`} aria-labelledby={`together-tab-${tab.id}`}>
            {/* 시연 자리 — 실제 파티·크루 화면을 찍어서 채울 예정이라 지금은 비워 둔다 */}
            <div className="tgSlot" aria-hidden="true"><span>{tab.slotLabel}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
