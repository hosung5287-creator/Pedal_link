import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

// 메인 소개 메뉴 — 스크롤해도 따라오는 알약 메뉴. 누르면 그 섹션으로 이동하고,
// 스크롤하면 지금 보이는 섹션이 켜진다. marks: { 항목 id: 섹션 앞 표시(.lxMark) ref }
// 판은 sticky 라 위치가 고정돼 보이므로, 흐름에 그대로 있는 표시로 현재 섹션을 판단한다.
export default function SectionMenu({ label, items, marks }) {
  const [active, setActive] = useState(items[0].id);
  const reduced = useReducedMotion();

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

  const select = (id) => {
    setActive(id);
    marks[id].current?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <nav className="lxMenu" aria-label={label}>
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
