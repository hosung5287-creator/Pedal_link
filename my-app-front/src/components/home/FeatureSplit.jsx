import { motion } from 'framer-motion';
import CoverPanel from './CoverPanel';
import { blurIn, fadeUp, stagger, viewportOnce } from '../../utils/motion';

// 메인 섹션 공통 틀 — 왼쪽 큰 제목·설명·버튼 2개, 오른쪽 큰 화면.
// 판 겹침은 CoverPanel 이 맡는다. coverRef: 다음 판 앞 표시 / tone: 'wash' 면 연한 판.
export default function FeatureSplit({ id, title, sub, primary, secondary, tone, coverRef, onAction, media }) {
  return (
    <CoverPanel className={`fsPanel${tone === 'wash' ? ' isWash' : ''}`} coverRef={coverRef} id={id}>
      <section className="fsGrid" aria-label={title}>
        <motion.div className="fsText" variants={stagger} initial="hidden" whileInView="show" viewport={viewportOnce}>
          <motion.h2 variants={fadeUp}>{title}</motion.h2>
          <motion.p variants={fadeUp}>{sub}</motion.p>
          <motion.div className="fsBtns" variants={fadeUp}>
            <button type="button" className="fsBtn isPrimary" onClick={onAction?.(primary.to)}>
              {primary.label} <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="fsBtn" onClick={onAction?.(secondary.to)}>
              {secondary.label} <span aria-hidden="true">↗</span>
            </button>
          </motion.div>
        </motion.div>
        <motion.div className="fsMedia" variants={blurIn} initial="hidden" whileInView="show" viewport={viewportOnce}>
          {media}
        </motion.div>
      </section>
    </CoverPanel>
  );
}
