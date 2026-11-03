import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

// home-ltx.css 의 .lxPanel(sticky) 조건과 같아야 한다 — 낮은 창·모바일에선 일반 스크롤
const STACK_QUERY = '(min-width: 1024px) and (min-height: 760px)';

function useStackEnabled() {
  const reduced = useReducedMotion();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(STACK_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide && !reduced;
}

// 스크롤하면 화면에 멈춰 있고, 다음 판이 올라와 덮는 동안 안쪽이 작아지며 사라진다.
// coverRef: 다음 판 바로 앞의 표시(.lxMark). 없으면 마지막 판이라 줄어들지 않는다.
export default function CoverPanel({ coverRef, className = '', children, ...rest }) {
  const enabled = useStackEnabled();
  const { scrollYProgress } = useScroll(coverRef ? { target: coverRef, offset: ['start end', 'start start'] } : {});
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const scale = useTransform(smooth, [0, 1], [1, 0.5]);
  const opacity = useTransform(smooth, [0, 1], [1, 0]);

  return (
    <div className={`lxPanel ${className}`.trim()} {...rest}>
      <motion.div className="lxPanelInner" style={enabled && coverRef ? { scale, opacity } : undefined}>
        {children}
      </motion.div>
    </div>
  );
}
