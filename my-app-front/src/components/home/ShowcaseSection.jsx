import { motion } from 'framer-motion';
import FeatureAccordion from './FeatureAccordion';
import PartyLiveDemo from './PartyLiveDemo';
import SectionVideo from './SectionVideo';
import { fadeUp, stagger, viewportOnce } from '../../utils/motion';

// 쇼케이스 섹션 — 헤드(뱃지+제목+설명) + 큰 이미지 자리 + 3칸 기능.
// 코스 만들기(S2) · 함께 달리기(S4) 에 재사용. 이미지는 .homeImgSlot 자리에 따로 제작해 넣는다.
// 스크롤 진입 시 블록별로 스프링 등장(Framer Motion), 기능 3칸은 순차 등장.
export default function ShowcaseSection({ id, variant, eyebrow, title, sub, imageLabel, features, demo, tabsLabel, accordionLabel, cta, onCta, video }) {
  return (
    <section
      className={`homeShowcase${variant === 'wash' ? ' isWash' : ''}${demo === 'video' ? ' isVideo' : ''}`}
      id={id}
      aria-label={title}
    >
      <div className="homeShowcaseInner">
        {/* Meta Muse 처럼 왼쪽 제목·설명, 오른쪽 버튼 — 버튼이 없으면 제목만 */}
        <div className="homeShowcaseTop">
          <motion.div
            className="homeShowcaseHead"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
          >
            <motion.span className="homePill" variants={fadeUp}>{eyebrow}</motion.span>
            <motion.h2 variants={fadeUp}>{title}</motion.h2>
            <motion.p className="homeShowcaseSub" variants={fadeUp}>{sub}</motion.p>
          </motion.div>
          {cta && onCta && <button type="button" className="hdCta" onClick={onCta}>{cta}</button>}
        </div>

        {demo === 'party' ? <FeatureAccordion features={features} label={tabsLabel} Demo={PartyLiveDemo} idPrefix="party" />
          : demo === 'video' ? <SectionVideo {...video} />
          : features.every(feature => feature.image) ? <FeatureAccordion features={features} label={accordionLabel} /> : <>
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

        <motion.div
          className="homeFeatRow"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
        >
          {features.map((f) => (
            <motion.div className="homeFeat" variants={fadeUp} key={f.title}>
              <span className="homeFeatIcon" aria-hidden="true" />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
        </>}
      </div>
    </section>
  );
}
