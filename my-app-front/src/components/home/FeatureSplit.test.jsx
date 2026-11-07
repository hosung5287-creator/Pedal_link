import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import FeatureSplit from './FeatureSplit';

// 화면 폭·움직임 줄이기를 바꿀 수 있는 가짜 matchMedia
function mockMedia() {
  const state = { narrow: false, reduced: false };
  const lists = [];
  window.matchMedia = (query) => {
    const list = {
      get matches() { return query.includes('max-width') ? state.narrow : query.includes('reduce') ? state.reduced : false; },
      listeners: new Set(),
      addEventListener: (_, fn) => list.listeners.add(fn),
      removeEventListener: (_, fn) => list.listeners.delete(fn),
    };
    lists.push(list);
    return list;
  };
  const set = (patch) => act(() => {
    Object.assign(state, patch);
    lists.forEach((l) => l.listeners.forEach((fn) => fn()));
  });
  return set;
}
afterEach(() => { delete window.matchMedia; });

function Counter() {
  const [n, setN] = useState(0);
  return <button type="button" onClick={() => setN(n + 1)}>눌린 수 {n}</button>;
}

const props = {
  title: '제목',
  sub: '설명',
  primary: { label: '첫 버튼', to: 'map' },
  secondary: { label: '둘째 버튼', to: 'party' },
  media: <div>화면</div>,
};

test('제목·설명·버튼 2개·화면을 그린다', () => {
  render(<FeatureSplit {...props} />);
  expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument();
  expect(screen.getByText('설명')).toBeInTheDocument();
  expect(screen.getByText('화면')).toBeInTheDocument();
});

test('버튼을 누르면 각자의 이동 함수를 부른다', () => {
  const go = { map: vi.fn(), party: vi.fn() };
  render(<FeatureSplit {...props} onAction={(to) => go[to]} />);
  fireEvent.click(screen.getByRole('button', { name: /첫 버튼/ }));
  fireEvent.click(screen.getByRole('button', { name: /둘째 버튼/ }));
  expect(go.map).toHaveBeenCalledTimes(1);
  expect(go.party).toHaveBeenCalledTimes(1);
});

test('화면 폭이나 움직임 줄이기가 바뀌어도 안쪽 화면을 다시 만들지 않는다', () => {
  const set = mockMedia();
  render(<FeatureSplit {...props} media={<Counter />} />);
  fireEvent.click(screen.getByRole('button', { name: /눌린 수/ }));
  set({ narrow: true });
  set({ reduced: true });
  set({ narrow: false, reduced: false });
  // 상태가 남아 있고, 글 영역도 하나뿐이다
  expect(screen.getByRole('button', { name: '눌린 수 1' })).toBeInTheDocument();
  expect(document.querySelectorAll('.fsText')).toHaveLength(1);
  expect(document.querySelectorAll('.fsMedia')).toHaveLength(1);
});
