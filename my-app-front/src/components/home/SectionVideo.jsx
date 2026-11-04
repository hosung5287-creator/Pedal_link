import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import './section-video.css';

// jsdom·저전력 모드 등에서 play() 가 막혀도 조용히 넘어간다
const tryPlay = (video) => {
  try { video.play()?.catch?.(() => {}); } catch { /* 재생 불가 환경 */ }
};

// 홈 섹션 시연 영상(Remotion 제작, 음소거 반복) — 코스 만들기·플로팅 버튼 섹션에서 쓴다.
// copy: { aria, play, pause } · 영상 왼쪽 아래에 정지 버튼
export default function SectionVideo({ src, poster, copy }) {
  const wrap = useRef(null);
  const video = useRef(null);
  const visible = useInView(wrap, { amount: 0.3 });
  const reduced = useReducedMotion();
  // 움직임 줄이기 설정이면 처음엔 멈춘 상태로 시작
  const [paused, setPaused] = useState(Boolean(reduced));

  // 화면에 보이고 사용자가 멈추지 않았을 때만 재생
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (visible && !paused) tryPlay(v);
    else v.pause?.();
  }, [visible, paused]);

  return (
    <motion.div
      className="cvd"
      ref={wrap}
      initial={reduced ? false : { filter: 'blur(16px)' }}
      whileInView={{ filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
    >
      <div className="cvdFrame">
        <video
          ref={video}
          className="cvdVideo"
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={copy.aria}
        />
        <button
          type="button"
          className="cvdToggle"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? copy.play : copy.pause}
        >
          <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        </button>
      </div>
    </motion.div>
  );
}
