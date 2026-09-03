import '@testing-library/jest-dom';

// jsdom 에는 IntersectionObserver 가 없다. Framer Motion 의 whileInView 가
// 이걸 쓰므로, 테스트 환경에서만 최소 스텁을 심는다 (브라우저에는 원래 있음).
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
