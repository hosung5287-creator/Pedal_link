import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// 움직임 줄이기 설정 — 페이지를 연 뒤에 바꿔도 바로 따라간다.
// (framer-motion 의 useReducedMotion 은 처음 값만 읽고 변경을 듣지 않는다)
export function useReducedMotionLive() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches));
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return undefined;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
