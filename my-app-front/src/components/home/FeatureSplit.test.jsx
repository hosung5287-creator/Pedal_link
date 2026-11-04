import { fireEvent, render, screen } from '@testing-library/react';
import FeatureSplit from './FeatureSplit';

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
