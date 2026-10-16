import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import './section-video.css';

// jsdom·저전력 모드 등에서 play() 가 막혀도 조용히 넘어간다
const tryPlay = (video) => {
  try { video.play()?.catch?.(() => {}); } catch { /* 재생 불가 환경 */ }
};

// 지금 시각이 몇 번째 단계인지 (steps 는 시작 시각 오름차순)
const stepAt = (steps, time) => {
  let idx = 0;
  steps.forEach((s, i) => { if (time >= s.at) idx = i; });
  return idx;
};

// 홈 섹션 시연 영상(Remotion 제작, 음소거 반복) — 코스 만들기·플로팅 버튼 섹션에서 쓴다.
// copy: { aria, play, pause } · steps: [{ title, at(초) }] · duration: 영상 길이(초)
// steps 가 있으면 영상 아래에 단계 표시(지금 단계 + 진행 막대, 누르면 그 단계로 이동)를 붙인다.
export default function SectionVideo({ src, poster, copy, steps = [], duration = 0 }) {
  const wrap = useRef(null);
  const video = useRef(null);
  const bars = useRef([]);
  const visible = useInView(wrap, { amount: 0.3 });
  const reduced = useReducedMotion();
  // 움직임 줄이기 설정이면 처음엔 멈춘 상태로 시작
  const [paused, setPaused] = useState(Boolean(reduced));
  const [step, setStep] = useState(0);

  // 화면에 보이고 사용자가 멈추지 않았을 때만 재생
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (visible && !paused) tryPlay(v);
    else v.pause?.();
  }, [visible, paused]);

  // 진행 막대 — 매 프레임 영상 시각을 읽어 막대 길이만 직접 바꾼다 (React 렌더는 단계가 바뀔 때만)
  useEffect(() => {
    if (!steps.length || !visible) return undefined; // 화면 밖에선 멈춘다
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v) {
        const time = v.currentTime || 0;
        const idx = stepAt(steps, time);
        const end = steps[idx + 1]?.at ?? (duration || v.duration || time + 1);
        const ratio = Math.min(1, Math.max(0, (time - steps[idx].at) / (end - steps[idx].at)));
        bars.current.forEach((bar, i) => {
          if (bar) bar.style.transform = `scaleX(${i === idx ? ratio : 0})`;
        });
        setStep((prev) => (prev === idx ? prev : idx));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [steps, duration, visible]);

  const goTo = (i) => {
    const v = video.current;
    if (v) v.currentTime = steps[i].at;
    setStep(i);
  };

  return (
    <motion.div
      className="cvd"
      ref={wrap}
      initial={reduced ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
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

      {steps.length > 0 && (
        <div className="cvdSteps">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`cvdStep${i === step ? ' isActive' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => goTo(i)}
            >
              <span className="cvdStepBar"><i ref={(node) => { bars.current[i] = node; }} /></span>
              <span className="cvdStepText"><b>0{i + 1}</b>{s.title}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
