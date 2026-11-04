// 라이딩 화면 지도 핀의 프로필 미리보기 카드 — 개인 라이딩·크루(파티) 라이딩이 같은 모양을 쓴다.
// 핀에 마우스를 올리거나(PC) 탭하면(모바일) 뜨는 Leaflet 툴팁 내용이라 HTML 문자열로 만든다.

const GENDER_LABEL = { male: '남성', female: '여성' };

const letterOf = (name) => (name || '?').trim().charAt(0);

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmtProxDist(d) {
  if (d == null) return '';
  return d < 1000 ? `${Math.round(d)}m 근처` : `${(d / 1000).toFixed(1)}km`;
}

// profile 이 'loading' 이면 아직 안 불러온 것, null 이면 실패한 것 — 둘 다 이름·거리만 보여준다
export function profileTooltipHtml(name, dist, profile) {
  const head = `<div class="rrProfileHead">`
    + `<span class="rrProfileAvatar">${escapeHtml(letterOf(name))}</span>`
    + `<div class="rrProfileHeadText"><strong>${escapeHtml(name)}</strong><span class="rrProfileDist">${fmtProxDist(dist)}</span></div>`
    + `</div>`;

  if (!profile || profile === 'loading') {
    return `<div class="rrProfileCard">${head}<p class="rrProfileLoading">${profile === 'loading' ? '불러오는 중…' : '정보를 불러오지 못했어요'}</p></div>`;
  }

  const metaParts = [];
  if (GENDER_LABEL[profile.gender]) metaParts.push(GENDER_LABEL[profile.gender]);
  if (profile.age) metaParts.push(`${profile.age}세`);
  if (profile.region) metaParts.push(profile.region);
  const meta = metaParts.length ? `<div class="rrProfileMeta">${escapeHtml(metaParts.join(' · '))}</div>` : '';
  const bike = profile.bikeInfo ? `<div class="rrProfileMeta">자전거 · ${escapeHtml(profile.bikeInfo)}</div>` : '';
  const bio = profile.bio ? `<p class="rrProfileBio">${escapeHtml(profile.bio)}</p>` : '';

  return `<div class="rrProfileCard">${head}${meta}${bike}${bio}</div>`;
}
