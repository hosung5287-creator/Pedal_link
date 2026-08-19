# React 19

## 이 프로젝트에서 쓰인 곳
- 전체 프론트엔드 UI (HomePage, MapPage, LoginPage, SignupPage, PartyPage)
- 페이지 라우팅 (`window.history` 기반 SPA — React Router 미사용)
- 로그인 상태 관리 (useState + localStorage)

---

## 핵심 개념

### 1. 컴포넌트
UI를 함수로 나눈 조각. 이 프로젝트의 모든 페이지가 컴포넌트다.

```jsx
export default function LoginPage({ onMoveHome }) {
  return <div>로그인 페이지</div>;
}
```

### 2. useState — 상태 관리
컴포넌트 안에서 변하는 값을 저장하는 방법. **값이 바뀌면 화면이 다시 그려진다.**

```jsx
const [user, setUser] = useState(null);  // 초기값 null
setUser({ id: 1, name: '홍길동' });      // 값 변경 → 화면 자동 업데이트
```

**이 프로젝트 사용 예시 — 지연 초기화(lazy initializer)**
```jsx
// App.js — 로그인 유저 상태, localStorage에서 초기값 복원
const [user, setUser] = useState(() => {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
});
```
`useState(값)` 이 아니라 `useState(() => 값)` 으로 쓰면 **첫 렌더 때 딱 한 번만** 실행된다.
매 렌더마다 localStorage를 다시 읽지 않게 하는 최적화.

MapPage의 위치공유 토글도 같은 패턴이다.
```jsx
const [locationShareEnabled, setLocationShareEnabled] = useState(() => {
  try {
    const saved = localStorage.getItem('locationShareEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  } catch { return false; }
});
```

### 3. useEffect — 사이드 이펙트
렌더링 후 실행할 작업 (API 호출, 이벤트 리스너, 타이머 등).

```jsx
useEffect(() => {
  window.addEventListener('popstate', handlePopState);   // 실행
  return () => window.removeEventListener('popstate', handlePopState); // 정리
}, []); // [] = 처음 한 번만 실행
```

**정리(cleanup)를 빼먹으면 생기는 일**: MapPage는 GPS 감시(`watchPosition`)와 3초 폴링
(`setInterval`)을 걸어둔다. 정리하지 않으면 페이지를 떠나도 계속 돌면서 배터리·네트워크를 먹고,
이미 사라진 지도에 마커를 추가하려다 에러가 난다. 그래서 MapPage의 모든 effect는
`clearWatch` / `clearInterval` / `marker.remove()` 를 return 함수에서 수행한다.

**비동기 작업에는 `cancelled` 플래그를 같이 쓴다**
```jsx
useEffect(() => {
  let cancelled = false;
  const timer = setInterval(async () => {
    const others = await getOtherLocations(myId);
    if (cancelled || !mapRef.current) return;  // 응답 기다리는 사이 언마운트됐으면 중단
    // ... 지도 반영
  }, 3000);
  return () => { cancelled = true; clearInterval(timer); };
}, [user?.id, locationShareEnabled]);
```
`await` 중에 컴포넌트가 사라질 수 있기 때문에, 응답이 온 뒤 **다시 한 번 유효성을 확인**해야 한다.

### 4. useRef — ① DOM 직접 접근
Leaflet 지도처럼 React가 아닌 외부 라이브러리가 DOM을 직접 다룰 때 사용.

```jsx
const mapNodeRef = useRef(null);  // <div ref={mapNodeRef} /> 와 연결
L.map(mapNodeRef.current);        // Leaflet이 이 div에 지도를 그림
```

### 5. useRef — ② "최신 값 보관함" (이 프로젝트에서 중요)
`useRef` 는 **값이 바뀌어도 화면을 다시 그리지 않는다.** 이 성질을 이용해
"화면에 안 보여도 되지만 콜백 안에서 최신 값이 필요한 것"을 담아둔다.

```jsx
const lastPosRef = useRef(null);

navigator.geolocation.watchPosition((pos) => {
  lastPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
});

// 3초 타이머는 이 ref만 읽어서 서버로 보고한다
setInterval(() => { reportLocation(lastPosRef.current); }, 3000);
```
GPS는 1초에 여러 번 갱신될 수 있는데, 이걸 `useState`로 받으면 그때마다 리렌더가 일어난다.
ref에 담아두고 전송은 3초 타이머가 따로 하도록 **분리**한 것이 핵심.

MapPage에는 이런 ref가 많다: `startPointRef`, `endPointRef`, `cyclewayDataRef`,
`bikeRouteRef`, `otherMarkersRef`(상대방 마커 Map), `othersInsideRef`(지오펜스 안/밖 상태).

```jsx
// state가 바뀔 때마다 ref도 최신으로 맞춰주는 관용구
useEffect(() => { startPointRef.current = startPoint; }, [startPoint]);
```

### 6. useCallback — 함수 메모이제이션
의존성이 바뀌지 않으면 함수를 재생성하지 않음.

```jsx
const findRoutes = useCallback(async (from, to) => {
  // BRouter 경로 탐색 로직
}, []);
```

### 7. useMemo — 값 메모이제이션
계산 비용이 큰 값을 캐싱.

```jsx
// HomePage.js — 캐러셀을 무한 반복시키려고 배열을 2배로 이어붙임
const routeLoop = useMemo(() => [...routes, ...routes], []);
```

### 8. Props — 컴포넌트 간 데이터 전달
```jsx
// 부모 (App.js)
<LoginPage onLogin={handleLogin} onMoveHome={moveHome} />

// 자식 (LoginPage.js)
export default function LoginPage({ onLogin, onMoveHome }) { ... }
```

이 프로젝트는 상태 관리 라이브러리(Redux 등) 없이 **App.js가 user를 들고 props로 내려주는**
구조다. `MapPage({ user, onBackHome })`, `PartyPage({ user, onMoveHome, onMoveLogin })`.

---

## SPA 라우팅 (이 프로젝트 방식)

```jsx
const moveTo = (path) => {
  window.history.pushState(null, '', path);  // URL 변경 (페이지 새로고침 없음)
  setCurrentPath(path);                       // 상태 업데이트 → 화면 변경
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 뒤로가기 버튼 대응
useEffect(() => {
  const handlePopState = () => setCurrentPath(window.location.pathname);
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, []);

// URL에 따라 다른 컴포넌트 렌더링
if (currentPath === '/map')    return <MapPage ... />;
if (currentPath === '/login')  return <LoginPage ... />;
if (currentPath === '/party')  return <PartyPage ... />;
return <HomePage ... />;
```

---

## 브라우저 저장소 3종 비교 (이 프로젝트에서 다 쓴다)

| 저장소 | 수명 | 이 프로젝트 용도 |
|--------|------|-----------------|
| `localStorage` | 브라우저를 닫아도 유지 | 로그인 유저(`user`), 위치공유 설정(`locationShareEnabled`) |
| `sessionStorage` | **탭 단위**, 탭 닫으면 삭제 | 비로그인 게스트 ID(`liveLocId`) — 탭마다 다른 ID가 생겨서 탭 2개로 위치공유 테스트 가능 |
| `useRef` | 컴포넌트가 살아있는 동안 (메모리) | GPS 최신 좌표, 마커 목록 |

```js
localStorage.setItem('user', JSON.stringify({ id: 1, name: '홍길동' }));
const user = JSON.parse(localStorage.getItem('user'));
localStorage.removeItem('user');
```

---

## 알아두면 좋은 코드 습관 (이 저장소에서 실제로 쓰는 것)

**OS 네이티브 팝업(alert/confirm/prompt)을 쓰지 않는다.**
커밋 `66ec63b` 에서 전부 제거됐다. 대신:
- 알림 → `showToast(msg, type)` 로 3초 뒤 사라지는 토스트
- 확인 → `confirmDelete` state + 모달 UI
- 입력 → `saveModalOpen` + `saveRouteName` state + 모달 UI

이유: `alert` 는 브라우저 UI를 멈추게 하고 스타일을 못 바꾸며, 모바일에서 보기 나쁘다.

---

## 공부 리소스
- 공식 문서: https://react.dev
- 한국어: https://ko.react.dev
