import { useEffect, useRef, useState } from 'react';

const BASE_W = 854; // 1440px 화면의 오른쪽 프레임 크기 — 이 크기로 배치를 맞췄다
const BASE_H = 480;
const MIN_ZOOM = 0.8; // 더 작으면 글자가 안 읽힌다 — 그때는 프레임 안에서 스크롤
const MAX_ZOOM = 1.1; // 글자를 더 키우면 화면을 확대한 느낌이 난다 — 남는 자리는 카드·지도·그래프가 채운다

// 작은 프레임에서는 안의 화면을 줄여 맞추고, 큰 프레임에서는 글자를 거의 그대로 둔다.
// 좁은 화면(글 위·화면 아래)은 높이가 내용을 따라가므로 건드리지 않는다.
export function useFrameZoom() {
  const ref = useRef(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    const frame = ref.current?.parentElement;
    if (!frame) return undefined;
    const fit = () => {
      const wide = window.matchMedia?.('(min-width: 1024px)').matches;
      const { clientWidth: w, clientHeight: h } = frame;
      setZoom(wide && w && h ? Math.max(MIN_ZOOM, Math.min(w / BASE_W, h / BASE_H, MAX_ZOOM)) : null);
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(frame);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return { ref, zoom, style: zoom ? { zoom } : undefined };
}
