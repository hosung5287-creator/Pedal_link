import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// 페이지가 떠 있는 동안만 스크롤을 부드럽게 (메인 홈 전용 — 지도·채팅 화면엔 쓰지 않는다).
// 움직임 줄이기 설정이면 켜지 않고, 터치 스크롤은 기기 기본 그대로 둔다.
export function useSmoothScroll() {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis = null;
    const sync = () => {
      if (media.matches) {
        lenis?.destroy();
        lenis = null;
      } else if (!lenis) {
        lenis = new Lenis({
          lerp: 0.1,
          autoRaf: true,
          allowNestedScroll: true, // 도크·모달 안쪽 목록은 안쪽이 먼저 스크롤
          prevent: (node) => Boolean(node.closest?.('.partyDock, .composeBackdrop')),
        });
      }
    };
    sync();
    media.addEventListener?.('change', sync);
    return () => {
      media.removeEventListener?.('change', sync);
      lenis?.destroy();
    };
  }, []);
}
