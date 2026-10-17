// 보유 자전거 칸(users.bike_info)은 문자열 하나라서, 쉼표로 여러 대를 적은 경우 나눠서 다룬다.

// "삼천리 로드, 자이언트 TCR" → ['삼천리 로드', '자이언트 TCR'] (빈 칸·중복 제거)
export function splitBikes(info) {
  if (!info) return [];
  const names = info.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
  return [...new Set(names)];
}

// 구글 검색어 — 이름만 넣으면 다른 결과(자동차 등)가 섞여서 "자전거"를 붙인다. 이미 들어 있으면 그대로.
export function bikeSearchQuery(name) {
  return name.includes('자전거') ? name : `${name} 자전거`;
}

// 주소 앞부분이 고정이고 검색어는 인코딩하므로, 어떤 글자를 적어도 다른 사이트로 넘어가지 않는다.
export function bikeSearchUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(bikeSearchQuery(name))}`;
}
