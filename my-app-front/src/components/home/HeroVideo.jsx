import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// jsdom·저전력 모드 등에서 play() 가 막혀도 조용히 넘어간다
const tryPlay = (video) => {
  try { video.play()?.catch?.(() => {}); } catch { /* 재생 불가 환경 */ }
};

// 메인 히어로 배경 영상 — 음소거 반복. 움직임 줄이기 설정이면 멈춘 첫 장면(poster)으로 시작.
// 5초 넘게 움직이는 화면이라 오른쪽 아래에 일시정지 버튼을 둔다. 영상을 못 불러오면 원래 그라데이션만 남는다.
export default function HeroVideo({ src, poster, play, pause }) {
  const video = useRef(null);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(Boolean(reduced));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused) v.pause?.();
    else tryPlay(v);
  }, [paused]);

  return (
    <div className="hdHeroMedia">
      {!failed && (
        <video
          ref={video}
          className="hdHeroVideo"
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setFailed(true)}
        />
      )}
      <div className="hdHeroShade" aria-hidden="true" />
      {!failed && (
        <button type="button" className="hdHeroToggle" onClick={() => setPaused((p) => !p)} aria-label={paused ? play : pause}>
          <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        </button>
      )}
    </div>
  );
}
