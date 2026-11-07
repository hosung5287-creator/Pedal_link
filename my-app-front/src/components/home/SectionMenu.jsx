import { useEffect, useRef, useState } from 'react';
import { useReducedMotionLive } from '../../hooks/useReducedMotionLive';

// 메인 소개 메뉴 — 스크롤해도 따라오는 알약 메뉴. 누르면 그 섹션으로 이동하고,
// 스크롤하면 지금 보이는 섹션이 켜진다. marks: { 항목 id: 섹션 앞 표시(.lxMark) ref }
// 판은 sticky 라 위치가 고정돼 보이므로, 흐름에 그대로 있는 표시로 현재 섹션을 판단한다.
export default function SectionMenu({ label, items, marks }) {
  const [active, setActive] = useState(items[0].id);
  const reduced = useReducedMotionLive();
  const nav = useRef(null);
  const waiting = useRef(0); // 제목 포커스를 기다리는 requestAnimationFrame id

  // 화면을 떠나면 기다리던 포커스도 취소
  useEffect(() => () => cancelAnimationFrame(waiting.current), []);

  useEffect(() => {
    const onScroll = () => {
      const half = window.innerHeight / 2;
      const current = items.reduce((found, item) => (
        marks[item.id].current?.getBoundingClientRect().top <= half ? item.id : found
      ), items[0].id);
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items, marks]);

  useEffect(() => {
    const bar = nav.current;
    const on = bar?.querySelector('.isActive');
    if (!bar || !on || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo?.({ left: on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [active, reduced]);

  const select = (id) => {
    setActive(id);
    const mark = marks[id].current;
    mark?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth' });
    // 키보드·화면 낭독기 사용자를 위해 그 섹션 제목으로 포커스를 옮긴다.
    // 덮여 있던 판은 스크롤로 드러나야 inert 가 풀리므로, 풀릴 때까지(최대 2초) 기다렸다가 옮긴다.
    const title = mark?.nextElementSibling?.querySelector('h2');
    cancelAnimationFrame(waiting.current); // 앞서 누른 메뉴의 대기는 버린다
    if (!title) return;
    const start = performance.now();
    const tryFocus = () => {
      if (!title.closest('[inert]')) {
        title.focus({ preventScroll: true });
        return;
      }
      if (performance.now() - start < 2000) waiting.current = requestAnimationFrame(tryFocus);
    };
    tryFocus();
  };

  return (
    <nav ref={nav} className="lxMenu" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`lxMenuItem${item.id === active ? ' isActive' : ''}`}
          aria-current={item.id === active ? 'true' : undefined}
          onClick={() => select(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
