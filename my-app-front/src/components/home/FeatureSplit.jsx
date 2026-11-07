import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionLive } from '../../hooks/useReducedMotionLive';
import CoverPanel from './CoverPanel';
import { blurIn, fadeUp, stagger, viewportOnce } from '../../utils/motion';

// 움직임 없이 바로 보이는 상태 — 설정이 바뀌어도 요소를 다시 만들지 않고 목표값만 바꾼다
// (다시 만들면 안쪽 파티·크루 체험 상태와 영상 정지가 초기화된다)
const STILL_GROUP = { hidden: {}, show: {} };
const STILL_ITEM = { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { duration: 0 } } };
const STILL_MEDIA = { hidden: { filter: 'blur(0px)' }, show: { filter: 'blur(0px)', transition: { duration: 0 } } };

// 좁은 화면(휴대폰·태블릿)에서는 큰 화면 흐림 등장이 무거워 건너뛴다
function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 1023px)');
    if (!media) return undefined;
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return Boolean(narrow);
}

// 메인 섹션 공통 틀 — 왼쪽 큰 제목·설명·버튼 2개, 오른쪽 큰 화면.
// 판 겹침은 CoverPanel 이 맡는다. coverRef: 다음 판 앞 표시 / tone: 'wash' 면 연한 판.
export default function FeatureSplit({ id, title, sub, primary, secondary, tone, coverRef, onAction, media }) {
  const reduced = useReducedMotionLive();
  const narrow = useNarrow(); // 훅은 조건 없이 항상 부른다
  const plain = reduced || narrow;
  const item = reduced ? STILL_ITEM : fadeUp;
  // 정지 상태면 화면에 들어오기를 기다리지 않고 바로 show 로 맞춘다
  const textMotion = reduced
    ? { variants: STILL_GROUP, initial: false, animate: 'show' }
    : { variants: stagger, initial: 'hidden', whileInView: 'show', viewport: viewportOnce };
  const mediaMotion = plain
    ? { variants: STILL_MEDIA, initial: false, animate: 'show' }
    : { variants: blurIn, initial: 'hidden', whileInView: 'show', viewport: viewportOnce };
  return (
    <CoverPanel className={`fsPanel${tone === 'wash' ? ' isWash' : ''}`} coverRef={coverRef} id={id}>
      <section className="fsGrid" aria-label={title}>
        <motion.div className="fsText" {...textMotion}>
          <motion.h2 variants={item} tabIndex={-1}>{title}</motion.h2>
          <motion.p variants={item}>{sub}</motion.p>
          <motion.div className="fsBtns" variants={item}>
            <button type="button" className="fsBtn isPrimary" onClick={onAction?.(primary.to)}>
              {primary.label} <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="fsBtn" onClick={onAction?.(secondary.to)}>
              {secondary.label} <span aria-hidden="true">↗</span>
            </button>
          </motion.div>
        </motion.div>
        <motion.div className="fsMedia" {...mediaMotion}>
          {media}
        </motion.div>
      </section>
    </CoverPanel>
  );
}
