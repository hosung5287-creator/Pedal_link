import { useEffect, useRef } from 'react';

// 대상이 뷰포트에 들어오면 isVisible 클래스를 붙이고 관찰을 멈춘다.
// 한 번 등장하면 다시 스크롤해도 애니메이션이 반복되지 않는다.
export default function useReveal({ threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // IntersectionObserver 미지원 환경에서는 애니메이션 없이 바로 표시
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('isVisible');
      return;
    }

    // 백그라운드 탭 등에서는 observer 콜백이 지연되므로,
    // 마운트 시점에 이미 화면 안에 있는 요소는 직접 확인해서 표시한다.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('isVisible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('isVisible');
          observer.unobserve(entry.target);
        });
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}
