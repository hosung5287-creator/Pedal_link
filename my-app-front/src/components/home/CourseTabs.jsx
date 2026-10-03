import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import CourseLiveDemo from './CourseLiveDemo';

export default function CourseTabs({ features }) {
  const [active, setActive] = useState(0);

  const timer = useRef();
  const buttons = useRef([]);
  const reduced = useReducedMotion();
  useEffect(() => () => clearTimeout(timer.current), []);
  const select = (index) => {
    clearTimeout(timer.current);
    if (index === active) return;

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
      <div className="courseTabMedia" role="tabpanel" id={`course-panel-${active}`} aria-labelledby={`course-tab-${active}`}>
        <CourseLiveDemo stage={active} />
      </div>
    </motion.div>
  );
}
