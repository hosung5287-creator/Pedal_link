import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function CourseTabs({ features }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const timer = useRef();
  const buttons = useRef([]);
  const reduced = useReducedMotion();
  useEffect(() => () => clearTimeout(timer.current), []);
  const select = (index) => {
    clearTimeout(timer.current);
    if (index === active) return;
    setDirection(index > active ? 1 : -1);
    setActive(index);
  };
  const navigate = (event, index) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % features.length
      : event.key === 'ArrowLeft' ? (index + features.length - 1) % features.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? features.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    buttons.current[next]?.focus();
  };
  return (
    <motion.div className="courseShowcase" initial={reduced ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
      <div className="courseTabList" role="tablist" aria-label="코스 만들기 기능">
        {features.map((feature, index) => (
          <button key={feature.title} ref={node => { buttons.current[index] = node; }}
            type="button" role="tab" id={`course-tab-${index}`} aria-controls={`course-panel-${index}`}
            aria-selected={active === index} tabIndex={active === index ? 0 : -1}
            className={`courseTab${active === index ? ' isActive' : ''}`}
            onClick={() => select(index)} onFocus={() => select(index)}
            onPointerEnter={event => { if (event.pointerType === 'mouse') { clearTimeout(timer.current); timer.current = setTimeout(() => select(index), 120); } }}
            onPointerLeave={() => clearTimeout(timer.current)} onKeyDown={event => navigate(event, index)}>
            <span className="courseTabTitle"><span className="courseTabNumber" aria-hidden="true">0{index + 1}</span>{feature.title}</span>
            <span className="courseTabDesc">{feature.desc}</span>
            {active === index && <motion.span className="courseTabIndicator" layoutId="course-active-tab"
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }} />}
          </button>
        ))}
      </div>
      <div className="courseTabMedia">
        {features.map((feature, index) => (
          <motion.div key={feature.title} role="tabpanel" id={`course-panel-${index}`}
            aria-labelledby={`course-tab-${index}`} aria-hidden={active !== index}
            className="courseTabPanel" initial={false}
            animate={{ opacity: active === index ? 1 : 0, scale: active === index || reduced ? 1 : 1.045,
              x: active === index || reduced ? 0 : direction * -24 }}
            transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: active === index ? 'auto' : 'none', zIndex: active === index ? 1 : 0 }}>
            <img src={feature.image} alt={feature.alt} width={index === 1 ? 1450 : 2080} height={index === 1 ? 753 : 1080} decoding="async" />
          </motion.div>
        ))}
        <span className="courseMapCredit">© OpenStreetMap contributors</span>
      </div>
    </motion.div>
  );
}
