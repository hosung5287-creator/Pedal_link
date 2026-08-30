import { motion } from 'framer-motion';
import { fadeUp, stagger, viewportOnce } from '../../utils/motion';

// 마무리 CTA(S6) — 다크 배경 밴드. 시작하기(지도) / 코스 둘러보기.
// 스크롤 진입 시 제목·설명·버튼이 순차 등장.
export default function ClosingCta({ title, sub, primary, secondary, onOpenMap, onMoveBrowse }) {
  return (
    <section className="homeCta" aria-labelledby="closing-title">
      <motion.div
        className="homeCtaInner"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.h2 id="closing-title" variants={fadeUp}>{title}</motion.h2>
        <motion.p variants={fadeUp}>{sub}</motion.p>
        <motion.div className="homeCtaActions" variants={fadeUp}>
          <button className="btn btn--solid" type="button" onClick={onOpenMap}>{primary}</button>
          <button className="homeCtaGhost" type="button" onClick={onMoveBrowse}>{secondary}</button>
        </motion.div>
      </motion.div>
    </section>
  );
}
