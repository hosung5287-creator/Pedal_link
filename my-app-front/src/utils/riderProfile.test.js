import { fmtProxDist, profileTooltipHtml } from './riderProfile';

test('프로필 미리보기 카드 — 사용자가 쓴 글은 HTML 로 해석되지 않게 바꾸고, 없는 칸은 빼고 그린다', () => {
  const html = profileTooltipHtml('서<b>연', 183, { gender: 'female', age: 27, region: '서울 마포구', bikeInfo: '로드', bio: '<img src=x onerror=alert(1)>' });
  expect(html).toContain('서&lt;b&gt;연');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img');
  expect(html).toContain('여성 · 27세 · 서울 마포구');
  expect(html).toContain('자전거 · 로드');
  expect(html).toContain('183m 근처');

  const bare = profileTooltipHtml('민수', 20, { gender: 'none' });
  expect(bare).not.toContain('rrProfileMeta');
  expect(bare).not.toContain('rrProfileBio');
  expect(profileTooltipHtml('민수', 20, 'loading')).toContain('불러오는 중');
  expect(profileTooltipHtml('민수', 20, null)).toContain('불러오지 못했어요');
  expect(fmtProxDist(1530)).toBe('1.5km');
});
