import { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import BrandLogo from '../BrandLogo';
import './course-live-demo.css';

// Presentation only: these fixed example values never call route/save APIs.
function Scene({ stage, reduced }) {
  const delay = stage === 0 ? 1.5 : 0.25;
  const enter = (at = 0) => ({
    initial: reduced ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.5, delay: reduced ? 0 : at },
  });
  return (
    <>
      <div className="cldMap" aria-hidden="true">
        <img src="/images/course/map-demo.png" alt="" width="1720" height="900" />
        <svg className="cldRoute" viewBox="0 0 1720 900" preserveAspectRatio="none">
          <motion.path d="M440 320 L550 365 L650 395 L820 460 L990 525 L1135 548 L1335 564"
            fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: reduced || stage !== 0 ? 1 : 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 1.5, delay: reduced ? 0 : delay }} />
          <motion.path d="M440 320 L550 365 L650 395 L820 460 L990 525 L1135 548 L1335 564"
            fill="none" stroke="#2968f5" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: reduced || stage !== 0 ? 1 : 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 1.5, delay: reduced ? 0 : delay }} />
        </svg>
        <motion.div className="cldPin cldStart" {...enter(stage === 0 ? 0.35 : 0)}><BrandLogo /><span>출발</span></motion.div>
        <motion.div className="cldPin cldEnd" {...enter(stage === 0 ? 1.1 : 0)}><BrandLogo /><span>도착</span></motion.div>
        <motion.div className="cldMapMessage" {...enter(stage === 0 ? 3 : 0.5)}>
          <span className="cldSuccessDot" />{stage === 0 ? '두 지점이 하나의 코스로' : stage === 1 ? '경로에 맞춰 계산된 코스 정보' : '저장한 코스를 지도에서 다시 확인'}
        </motion.div>
      </div>
      <aside className="cldPlanner" aria-label="코스 기능 시연">
        <div className="cldBrand"><BrandLogo />PedalLink<span>미리보기</span></div>
        <div className="cldFields">
          <motion.div {...enter(0.2)}><small>출발지</small><strong>이촌 한강공원</strong><i /></motion.div>
          <motion.div {...enter(stage === 0 ? 1 : 0.15)}><small>도착지</small><strong>한강 자전거길</strong><i /></motion.div>
        </div>
        <div className="cldLegend"><i />자전거도로 <i />최단경로</div>
        {stage === 0 && <motion.div className="cldHint" {...enter(0.1)}>지도 위에 두 지점을 찍으면<br />나만의 코스가 이어집니다.</motion.div>}
        {stage === 1 && <motion.div className="cldResults" {...enter(0.45)}>
          <div className="cldCardHeading">코스 정보<span>계산 완료</span></div>
          <div className="cldStats">
            <motion.div {...enter(0.65)}><strong>0.4</strong><small>총 거리 · km</small></motion.div>
            <motion.div {...enter(0.85)}><strong>3</strong><small>상승 · m</small></motion.div>
            <motion.div {...enter(1.05)}><strong>1</strong><small>예상 시간 · 분</small></motion.div>
          </div>
          <div className="cldResultNote">이촌 한강공원 코스 기준</div>
        </motion.div>}
        {stage !== 2 && <motion.div className="cldSave" {...enter(stage === 0 ? 3.1 : 1.25)}>코스 저장 <span>↗</span></motion.div>}
        {stage === 2 && <motion.div className="cldSaved" {...enter(0.2)}>
          <div className="cldCardHeading">저장된 경로 목록<span>1개</span></div>
          <motion.div className="cldSavedItem" initial={reduced ? false : { borderColor: '#e5eef3', backgroundColor: '#fff' }}
            animate={{ borderColor: '#0ea5e9', backgroundColor: '#eff9ff' }} transition={{ delay: reduced ? 0 : 0.9, duration: 0.4 }}>
            <div className="cldMiniRoute"><svg viewBox="0 0 60 50"><path d="M8 38 Q20 8 30 26 T52 10" fill="none" stroke="#2968f5" strokeWidth="3" /></svg></div>
            <div><strong>한강 자전거 코스</strong><small>0.4 km · 약 1분</small></div>
            <motion.span {...enter(1)}>✓</motion.span>
          </motion.div>
          <motion.p {...enter(1.25)}>저장한 경로를 불러왔습니다.</motion.p>
        </motion.div>}
      </aside>
    </>
  );
}

export default function CourseLiveDemo({ stage }) {
  const ref = useRef(null);
  const visible = useInView(ref, { amount: 0.25 });
  const reduced = useReducedMotion();
  const [replay, setReplay] = useState(0);
  return <div className="cld" ref={ref}>
    {visible && <Scene key={`${stage}-${replay}`} stage={stage} reduced={reduced} />}
    <button className="cldReplay" type="button" onClick={() => setReplay(value => value + 1)} aria-label="코스 시연 다시 재생">↻ <span>다시 보기</span></button>
    <a className="cldCredit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>;
}
