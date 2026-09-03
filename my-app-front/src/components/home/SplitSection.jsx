import { motion } from 'framer-motion';
import { fadeUp, stagger, viewportOnce } from '../../utils/motion';

// 좌우 분할 섹션 — 한쪽 텍스트(뱃지+제목+설명+체크 리스트) + 반대쪽 이미지 자리.
// 실시간 매칭(S3) · 둘러보기(S5, reverse) 에 재사용. 텍스트는 순차 등장, 이미지는 스프링 페이드업.
export default function SplitSection({ eyebrow, title, sub, points, imageLabel, reverse }) {
  return (
    <section className={`homeSplit${reverse ? ' isReverse' : ''}`} aria-label={title}>
      <div className="homeSplitInner">
        <motion.div
          className="homeSplitText"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          <motion.span className="homePill" variants={fadeUp}>{eyebrow}</motion.span>
          <motion.h2 variants={fadeUp}>{title}</motion.h2>
          <motion.p className="homeSplitSub" variants={fadeUp}>{sub}</motion.p>
          <motion.ul className="homeSplitList" variants={fadeUp}>
            {points.map((p) => (
              <li key={p}><span className="homeSplitDot" aria-hidden="true" />{p}</li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          className="homeImgSlot"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          aria-hidden="true"
        >
          <span>{imageLabel}</span>
        </motion.div>
      </div>
    </section>
  );
}
