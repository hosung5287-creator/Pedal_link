import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

// 브라우저가 자동 재생을 막으면(NotAllowedError) onBlocked 로 알려 버튼을 ▶ 로 되돌린다.
// 음소거여야 자동 재생이 허용되므로 재생 직전에 속성으로 한 번 더 확실히 건다.
const tryPlay = (video, onBlocked) => {
  try {
    video.muted = true;
    video.play()?.catch?.((e) => { if (e?.name === 'NotAllowedError') onBlocked(); });
  } catch { /* 재생 불가 환경 */ }
};

// 메인 히어로 배경 영상 — 음소거 반복. 움직임 줄이기 설정이면 멈춘 첫 장면(poster)으로 시작.
// 5초 넘게 움직이는 화면이라 오른쪽 아래에 일시정지 버튼을 둔다. 영상을 못 불러오면 원래 그라데이션만 남는다.
export default function HeroVideo({ src, poster, play, pause }) {
  const video = useRef(null);
  const wrap = useRef(null);
  const visible = useInView(wrap, { amount: 0.1 });
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(Boolean(reduced));
  const [failed, setFailed] = useState(false);
  const [docVisible, setDocVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    const update = () => setDocVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused || !visible || !docVisible) v.pause?.();
    else tryPlay(v, () => setPaused(true));
  }, [paused, visible, docVisible]);

  return (
    <div className="hdHeroMedia" ref={wrap}>
      {!failed && (
        <video
          ref={video}
          className="hdHeroVideo"
          src={src}
          poster={poster}
          muted
          autoPlay={!paused}
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
