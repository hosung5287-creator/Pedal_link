// 홈 섹션 공용 등장 애니메이션 (Framer Motion).
// 부모에 stagger, 자식에 fadeUp 을 물려 스크롤 진입 시 순차 등장시킨다.

// 아래에서 위로 + 페이드인 (스프링)
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 90, damping: 16, mass: 0.6 },
  },
};

// 자식들을 약간의 시차를 두고 순차 등장시키는 컨테이너
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

// whileInView 공통 옵션 — 화면에 25% 들어오면 한 번만 재생(재생 후 그대로 유지).
// 스크롤 올릴 때마다 다시 재생되게 하려면 once: false 로만 바꾸면 된다.
export const viewportOnce = { once: true, amount: 0.25 };
