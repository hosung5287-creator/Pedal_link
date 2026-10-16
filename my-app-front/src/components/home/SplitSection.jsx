import { motion } from 'framer-motion';
import { fadeUp, stagger, viewportOnce } from '../../utils/motion';

// 좌우 분할 섹션 — 한쪽 텍스트(뱃지+제목+설명+체크 리스트) + 반대쪽 이미지 자리.
// 실시간 매칭(S3) · 둘러보기(S5, reverse) 에 재사용. 텍스트는 순차 등장, 이미지는 스프링 페이드업.
// media 를 주면 이미지 자리 대신 그 내용을 넣는다 (둘러보기 섹션의 흐르는 피드).
// 체크 리스트 앞 미니 아이콘 — constants 의 pointIcons 이름으로 고른다 (없으면 기본 점)
const ICONS = {
  radar: <><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
};

export default function SplitSection({ eyebrow, title, sub, points, pointIcons, imageLabel, reverse, media }) {
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
            {points.map((p, i) => (
              <li key={p}>
                {pointIcons?.[i] ? (
                  <span className="homeSplitIcon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[pointIcons[i]]}</svg>
                  </span>
                ) : <span className="homeSplitDot" aria-hidden="true" />}
                {p}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          className={media ? 'homeMediaSlot' : 'homeImgSlot'}
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          aria-hidden={media ? undefined : true}
        >
          {media || <span>{imageLabel}</span>}
        </motion.div>
      </div>
    </section>
  );
}
