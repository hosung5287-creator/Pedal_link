import { fireEvent, render, screen } from '@testing-library/react';
import { homeDraft } from '../../constants';
import RideReportDemo from './RideReportDemo';

const t = homeDraft.report;

test('AI 요약·조언과 라이딩 잔디를 예시 데이터로 보여준다', () => {
  render(<RideReportDemo />);
  expect(screen.getByText(t.summary)).toBeInTheDocument();
  t.advice.forEach((a) => expect(screen.getByText(a)).toBeInTheDocument());
  expect(screen.getByText(t.by)).toBeInTheDocument(); // 예시임을 표시
  expect(screen.getByRole('img', { name: /라이딩 잔디/ })).toBeInTheDocument();
});

test('그래프 탭을 누르면 해당 그래프로 바뀐다', () => {
  render(<RideReportDemo />);
  const speed = screen.getByRole('button', { name: t.tabs[1].label });
  fireEvent.click(speed);
  expect(speed).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('img', { name: /라이딩 잔디/ })).toBeNull();
});
