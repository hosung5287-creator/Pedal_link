import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import { useReducedMotionLive } from '../../hooks/useReducedMotionLive';

// home-ltx.css 의 .lxPanel(sticky) 조건과 같아야 한다 — 낮은 창·모바일에선 일반 스크롤
const STACK_QUERY = '(min-width: 1024px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)';

function useStackEnabled() {
  const reduced = useReducedMotionLive();
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
  const inner = useRef(null);

  // 다음 판에 거의 다 덮이면 안쪽 버튼·링크를 탭 순서와 클릭에서 뺀다(보이지 않는 곳에 포커스가 가지 않게)
  const setCovered = (covered) => {
    const el = inner.current;
    if (!el) return;
    if (covered) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  };
  useMotionValueEvent(smooth, 'change', (v) => setCovered(Boolean(enabled && coverRef) && v > 0.96));
  useEffect(() => {
    setCovered(Boolean(enabled && coverRef) && smooth.get() > 0.96);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, coverRef]);

  return (
    <div className={`lxPanel ${className}`.trim()} {...rest}>
      <motion.div ref={inner} className="lxPanelInner" style={enabled && coverRef ? { scale, opacity } : undefined}>
        {children}
      </motion.div>
    </div>
  );
}
