import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SectionMenu from './SectionMenu';

const items = [
  { id: 'feed', label: '피드' },
  { id: 'course', label: '코스 만들기' },
  { id: 'party', label: '파티' },
];

function setup() {
  const marks = { feed: createRef(), course: createRef(), party: createRef() };
  render(
    <>
      <SectionMenu label="메뉴" items={items} marks={marks} />
      {items.map((item) => <span key={item.id} ref={marks[item.id]} />)}
    </>,
  );
  return marks;
}
const button = (name) => screen.getByRole('button', { name });

test('처음엔 첫 항목이 켜져 있다', () => {
  setup();
  expect(button('피드')).toHaveAttribute('aria-current', 'true');
});

test('누르면 그 항목이 켜지고 해당 섹션으로 스크롤한다', () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  setup();
  fireEvent.click(button('파티'));
  expect(button('파티')).toHaveAttribute('aria-current', 'true');
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  delete Element.prototype.scrollIntoView;
});

test('스크롤하면 화면 절반을 넘은 마지막 섹션이 켜진다', () => {
  const marks = setup();
  marks.feed.current.getBoundingClientRect = () => ({ top: -500 });
  marks.course.current.getBoundingClientRect = () => ({ top: 100 });
  marks.party.current.getBoundingClientRect = () => ({ top: window.innerHeight });
  fireEvent.scroll(window);
  expect(button('코스 만들기')).toHaveAttribute('aria-current', 'true');
  expect(button('피드')).not.toHaveAttribute('aria-current');
});
