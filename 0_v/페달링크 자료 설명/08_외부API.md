# 외부 API 연동

## 이 프로젝트에서 쓰이는 외부 서비스

| 서비스 | 역할 | 호출 위치 |
|--------|------|-----------|
| BRouter | 자전거 경로 계산 | 프론트 (`utils/leaflet.js`) |
| Kakao Local API | 장소 이름 검색 | 프론트 (`pages/MapPage.js`) |
| OpenStreetMap 타일 | 지도 배경 이미지 | 프론트 (`utils/leaflet.js`) |

세 서비스 모두 **백엔드를 거치지 않고 브라우저에서 직접 호출**한다.

---

## 0. API 키는 환경변수로 관리한다 ★

예전에는 `constants.js` 에 카카오 키가 그대로 적혀 있었지만, 지금은 환경변수를 읽는다.

```js
// src/constants.js
export const KAKAO_API_KEY = process.env.REACT_APP_KAKAO_API_KEY;
```

**설정 방법**
```bash
cd my-app-front
cp .env.example .env.local     # .env.local 은 .gitignore 에 있어서 커밋되지 않는다
```
```ini
# .env.local
REACT_APP_KAKAO_API_KEY=발급받은_REST_API_키
REACT_APP_API_BASE=http://localhost:8080
```

**규칙 2가지**
1. Create React App은 **`REACT_APP_` 으로 시작하는 변수만** 읽어들인다.
2. `.env.local` 을 고치면 **`npm start` 를 껐다 켜야** 반영된다 (빌드 시점에 값이 박히기 때문).

> ⚠️ 주의: 프론트 환경변수는 **빌드 결과물에 그대로 들어간다.** 브라우저 개발자도구에서
> 누구나 볼 수 있으므로 "비밀"이 아니다. 커밋 이력에서 감추는 효과일 뿐이다.
> 진짜로 숨기려면 백엔드가 대신 호출해주는 프록시 엔드포인트를 만들어야 한다.
> (카카오 콘솔에서 허용 도메인을 제한하는 것도 방법)

---

## 1. BRouter — 자전거 경로 계산

자전거 도로 데이터 기반으로 출발지→도착지 경로를 계산해주는 무료 서비스. 키가 필요 없다.

### 요청 형식
```
GET https://brouter.de/brouter?
  lonlats=경도1,위도1|경도2,위도2
  &profile=trekking
  &alternativeidx=0
  &format=geojson
```

### 실제 코드 (utils/leaflet.js)
```js
export async function requestBrouterRoute(from, to, profile) {
  const url = new URL('https://brouter.de/brouter');
  url.searchParams.set('lonlats', `${from.lng},${from.lat}|${to.lng},${to.lat}`);
  url.searchParams.set('profile', profile);
  url.searchParams.set('alternativeidx', '0');
  url.searchParams.set('format', 'geojson');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error('Route request failed');

  const geojson = await response.json();
  const feature = geojson.type === 'FeatureCollection' ? geojson.features?.[0] : geojson;
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates?.length) throw new Error('Route geometry missing');

  return {
    coords: coordinates.map(([lng, lat]) => [lat, lng]),   // Leaflet용으로 뒤집기
    stats: parseBrouterStats(feature?.properties || {}),   // 거리·상승고도·노면 분석
  };
}
```

> 📌 **반환값이 배열이 아니라 `{ coords, stats }` 객체다.** 예전에는 좌표 배열만 돌려줬는데,
> 경로 분석 기능이 붙으면서 바뀌었다. 자세한 내용은 [14_경로_분석.md](14_경로_분석.md).

**`new URL()` + `searchParams` 를 쓰는 이유**: 장소명에 `&`, 공백 같은 문자가 있어도
자동으로 인코딩해준다. 문자열을 직접 이어붙이면 깨진다.

### 두 경로를 동시에 요청 (MapPage.js)
```js
const [bike, short] = await Promise.all([
  requestBrouterRoute(from, to, 'trekking'),   // 자전거 친화 경로
  requestBrouterRoute(from, to, 'shortest'),   // 최단거리
]);
```
`Promise.all` 은 두 요청을 **동시에** 보낸다. 순서대로 `await` 하면 시간이 2배 걸린다.

### 프로필 종류
| 프로필 | 설명 |
|--------|------|
| `trekking` | 자전거도로 우선 (이 프로젝트의 '자전거 경로') |
| `shortest` | 최단거리 우선 (이 프로젝트의 '최단 경로') |
| `fastbike` | 빠른 자전거용 (미사용) |

### 좌표 순서 주의
- BRouter 요청: `경도,위도` 순서
- BRouter 응답(GeoJSON): `[경도, 위도]` 순서
- Leaflet 사용: `[위도, 경도]` 로 뒤집어야 함

---

## 2. Kakao Local API — 장소 이름 검색

한국 장소명으로 좌표를 찾는 서비스 (예: "강남역" → 위도/경도).

### 실제 코드 (MapPage.js — fetchResults)
```js
// ★ 절대주소가 아니라 '내 사이트 주소 + 경로' 로 요청한다 (아래 프록시 설명 참고)
const url = new URL('/v2/local/search/keyword.json', window.location.origin);
url.searchParams.set('query', query);
url.searchParams.set('size', '8');

const res = await fetch(url.toString(), {
  headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
});
const data = await res.json();

setSearchResults((data.documents || []).map(d => ({
  label: d.place_name,
  address: d.road_address_name || d.address_name,
  lat: Number(d.y),   // ★ y = 위도
  lng: Number(d.x),   // ★ x = 경도
})));
```
카카오 응답의 `x`/`y` 는 **문자열**이라 `Number()` 변환이 필요하고, `x`가 경도·`y`가 위도다.

### package.json proxy 설정 — 왜 필요한가
```json
"proxy": "https://dapi.kakao.com"
```
카카오 API는 브라우저에서 직접 부르면 **CORS 에러**가 난다.
CRA 개발 서버가 중간에서 대신 호출해주면 브라우저 입장에서는 같은 출처(localhost:3000)라
CORS가 발생하지 않는다.

```
브라우저 ──/v2/local/...──▶ localhost:3000 (CRA 개발서버) ──▶ dapi.kakao.com
                                   ↑ 여기서 서버끼리 통신하므로 CORS 없음
```

> ⚠️ **이 프록시는 `npm start`(개발 모드)에서만 동작한다.**
> `npm run build` 로 만든 정적 파일을 배포하면 프록시가 없어서 장소 검색이 깨진다.
> 배포하려면 (a) 백엔드에 검색 프록시 엔드포인트를 만들거나 (b) Nginx 같은 웹서버에서
> `/v2/local` 경로를 카카오로 넘기도록 설정해야 한다.

### 검색 디바운스
글자를 칠 때마다 API를 부르면 요청이 폭주한다. MapPage는 타이머로 지연시킨다.
```js
searchDebounceRef.current = setTimeout(() => fetchResults(value), 300);
```

---

## 3. fetch API — HTTP 요청 기본
```js
// GET
const res = await fetch('https://api.example.com/data');
const data = await res.json();

// POST
const res = await fetch('http://localhost:8080/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

> **`fetch` 는 404나 500에서도 예외를 던지지 않는다.** `res.ok` 를 직접 확인해야 한다.
> (네트워크 자체가 끊겼을 때만 예외가 난다)

### 이 프로젝트의 공통 클라이언트 (api/client.js)
백엔드 호출은 매번 fetch를 직접 쓰지 않고 공통 함수로 감쌌다.
```js
export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

export class ApiError extends Error {          // status 로 분기할 수 있는 커스텀 에러
  constructor(status, message) { super(...); this.status = status; }
}

async function request(path, { method = 'GET', body, headers, withCredentials = false } = {}) {
  const options = { method, headers: { ...headers } };
  if (withCredentials) options.credentials = 'include';
  if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
  if (res.status === 204) return null;         // 본문 없는 응답
  const raw = await res.text();
  return raw ? JSON.parse(raw) : null;         // 빈 본문이면 JSON.parse 에러가 나므로 방어
}

export const api = {
  get:  (path, opts)       => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put:  (path, body, opts) => request(path, { ...opts, method: 'PUT',  body }),
  del:  (path, opts)       => request(path, { ...opts, method: 'DELETE' }),
};
```

**이렇게 감싸서 얻는 것**
- 서버 주소가 바뀌면 `.env.local` 한 줄만 고치면 됨
- 에러 처리·JSON 파싱을 한 곳에서 통일
- 컴포넌트 코드가 `api.post('/api/routes', body)` 로 짧아짐

**규칙: 컴포넌트는 백엔드를 부를 때 반드시 `api/*.js` 모듈을 통한다.**
(외부 API인 BRouter·Kakao는 예외 — `API_BASE` 와 무관한 남의 서버이므로 `fetch` 직접 사용)

---

## 공부 리소스
- BRouter: https://brouter.de
- Kakao Local API: https://developers.kakao.com/docs/latest/ko/local/dev-guide
- Fetch API MDN: https://developer.mozilla.org/ko/docs/Web/API/Fetch_API
- CRA 환경변수: https://create-react-app.dev/docs/adding-custom-environment-variables/
