import { render, screen } from '@testing-library/react';
import App from './App';

test('코스 플래너 화면을 렌더링한다', () => {
  render(<App />);
  expect(screen.getByText(/다음 라이딩을 계획해보세요/i)).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
  expect(screen.getByText(/지도 위에서 바로 코스를 그리세요/i)).toBeInTheDocument();
});
