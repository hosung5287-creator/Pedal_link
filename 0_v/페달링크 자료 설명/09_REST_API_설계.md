# REST API 설계 — 프론트↔백엔드 통신

## REST API란?
URL + HTTP 메서드 조합으로 서버 자원을 다루는 약속.

| HTTP 메서드 | 의미 | 이 프로젝트 예시 |
|-------------|------|-----------------|
| GET | 조회 | 경로 목록, 파티 목록, 다른 사람 위치 |
| POST | 생성 | 회원가입, 로그인, 경로 저장, 파티 개설·신청 |
| PUT | 수정 | 위치 공유 설정 변경 |
| DELETE | 삭제 | (미사용 — 삭제도 POST로 처리 중) |

---

## 전체 API 목록 (2026-08-19 기준)

### 인증 — AuthController (`/api/auth`)
| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| PUT | `/api/auth/users/{id}/location-sharing` | 위치 공유 on/off 저장 |

### 경로 — RouteController (`/api`)
| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/api/routes` | 경로 저장 |
| GET | `/api/routes?userId=2` | 경로 목록 (userId 없으면 전체) |
| GET | `/api/routes/{id}` | 경로 1개 상세 (좌표 포함) |
| POST | `/api/routes/delete` | 경로 삭제 (ID 배열) |

### 자전거도로 — CyclewayController
| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/api/cycleways` | 서울 자전거도로 GeoJSON 전체 |

### 실시간 위치 — LocationController (`/api`)
| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/api/locations` | 내 위치 보고 (3초마다) |
| GET | `/api/locations?userId=나` | 나를 제외한 접속자 위치 목록 |

### 둘러보기 — FeedController (`/api`)
| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/api/feed?userId=2` | 피드 목록 (최신순). userId는 선택 — 좋아요 표시용 |
| POST | `/api/routes/{routeId}/like` | 좋아요 토글 → `{ liked, likeCount }` |
| POST | `/api/routes/{routeId}/post` | 게시물 올리기 (문구·해시태그) → 갱신된 카드 |

### 주행 기록 — RideRecordController (`/api/ride-records`)
| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/api/ride-records` | 라이딩 종료 시 기록 저장 |
| GET | `/api/ride-records?userId=2` | 내 주행 기록 목록 (최신순) |

### 파티(링크) — PartyController (`/api/parties`)
| 메서드 | URL | 설명 |
|--------|-----|------|
| GET | `/api/parties` | 파티 목록 (최신순) |
| POST | `/api/parties` | 파티 개설 |
| POST | `/api/parties/{id}/apply` | 참여 신청 |
| POST | `/api/parties/{id}/requests/{userId}/approve` | 호스트가 신청 수락 |
| POST | `/api/parties/{id}/requests/{userId}/reject` | 호스트가 신청 거절 |

### ⚠️ 아직 백엔드에 없는 것
| 메서드 | URL | 현재 상태 |
|--------|-----|----------|
| GET | `/oauth2/authorization/{provider}` | 백엔드 OAuth2 미설정 → **소셜 로그인 버튼은 비활성** 처리됨 ([07](07_Spring_Security.md)) |

> `GET /api/auth/me` 와 `POST /api/auth/logout` 을 부르던 `getMe()` / `logout()` 함수는
> 아무 데서도 쓰이지 않아 `api/auth.js` 에서 삭제했다. 세션 인증을 도입할 때 다시 만들면 된다.

---

## 요청/응답 예시

### 회원가입
```json
POST /api/auth/signup
{ "name": "홍길동", "email": "test@test.com", "password": "12345678" }
```
```json
200 OK  { "message": "회원가입 완료" }
400     { "message": "이미 사용 중인 이메일입니다." }
```

### 로그인
```json
POST /api/auth/login
{ "email": "test@test.com", "password": "12345678" }
```
```json
200 OK  { "id": 2, "name": "testuser", "email": "test@test.com", "locationShareEnabled": false }
400     { "message": "이메일 또는 비밀번호가 틀렸습니다." }
```
이 응답 객체가 그대로 프론트의 `localStorage.user` 가 된다.

### 위치 공유 설정
```json
PUT /api/auth/users/2/location-sharing
{ "enabled": true }
```
```json
200 OK  { "id": 2, "locationShareEnabled": true }
```

### 경로 저장
```json
POST /api/routes
{
  "userId": 2,
  "routeName": "한강 라이딩",
  "fromLat": 37.56, "fromLng": 126.97, "fromLabel": "여의도",
  "toLat": 37.55,  "toLng": 127.08,  "toLabel": "뚝섬",
  "distanceKm": 12.4,
  "bikeRoute":     [{ "lat": 37.56, "lng": 126.97 }, ...],
  "shortestRoute": [{ "lat": 37.56, "lng": 126.97 }, ...]
}
```
```json
200 OK  { "id": 12, "message": "경로 저장 완료" }
```

### 경로 목록
```
GET /api/routes?userId=2
```
```json
[ { "id": 1, "routeName": "한강 라이딩", "fromLabel": "여의도", "toLabel": "뚝섬",
    "distanceKm": 12.4, "createdAt": "2026-07-19T..." } ]
```
> 목록은 `RouteResponse` 가 아니라 `Map` 으로 축약해서 반환한다 (`RouteService.getRouteList`).
> **좌표(bikeRoute/shortestRoute)는 들어있지 않다** — 목록이 무거워지지 않도록 일부러 뺀 것이고,
> 좌표가 필요하면 `GET /api/routes/{id}` 로 하나씩 가져온다.
> `distanceKm` 은 경로 저장 시 BRouter 분석값을 함께 저장한 것이라, 그 이전에 저장된 경로는 `null` 이다.

### 경로 삭제
```json
POST /api/routes/delete
[1, 3, 5]                      ← 배열 자체가 body
```
```json
200 OK  { "message": "삭제 완료" }
```
> 삭제인데 `DELETE` 가 아니라 `POST` 인 이유: 여러 id를 body에 담아 보내려고.
> REST 관례상으로는 `DELETE /api/routes?ids=1,3,5` 가 더 적절하다.

### 위치 보고 / 조회
```json
POST /api/locations
{ "userId": 2, "name": "홍길동", "lat": 37.56, "lng": 126.97 }
→ 200 OK { "message": "ok" }
→ 400    { "message": "userId, lat, lng는 필수입니다" }
```
```json
GET /api/locations?userId=2
→ [ { "userId": 7, "name": "라이더A", "lat": 37.561, "lng": 126.972, "updatedAt": 1755600000000 } ]
```

### 둘러보기 피드
```
GET /api/feed?userId=2
```
```json
[ { "id": 6, "routeName": "한강 야경 라이딩",
    "fromLabel": "잠실", "toLabel": "여의도",
    "distanceKm": 15.2, "ascendM": 45, "timeMin": 80,
    "authorId": 3, "authorName": "sosos",
    "description": "한강 야경을 즐기며 달리는 코스입니다.",
    "tags": ["야경", "초보코스", "한강"],
    "path": [ { "lat": 37.5133, "lng": 127.1028 }, ... ],
    "likeCount": 2, "liked": true,
    "createdAt": "2026-08-19T15:04:00" } ]
```
> `path` 는 썸네일용으로 **서버에서 60점 이하로 솎아낸** 좌표다. 원본 전체가 아니다.
> `description` / `tags` 가 `null` 이면 프론트가 출발지·도착지·거리로 자동 문구를 만든다.

### 좋아요 토글
```json
POST /api/routes/6/like
{ "userId": 2 }
→ 200 { "liked": true, "likeCount": 2 }
→ 400 { "message": "로그인이 필요합니다" }
```

### 게시물 올리기
```json
POST /api/routes/6/post
{ "userId": "3", "description": "한강 야경을 즐기며 달리는 코스입니다.", "tags": "#야경 #초보코스 #한강" }
```
```json
200 { ...갱신된 피드 카드..., "tags": ["야경", "초보코스", "한강"] }
400 { "message": "로그인이 필요합니다" }
403 { "message": "본인이 저장한 경로만 올릴 수 있습니다" }
```
> 태그는 서버가 정리한다 — `#` 제거, 쉼표/공백 아무거나로 분리, 중복 제거, 최대 10개.
> **이 프로젝트에서 403을 쓰는 유일한 곳**이다 (잘못된 요청이 아니라 권한 문제이므로).

### 주행 기록 저장
```json
POST /api/ride-records
{ "userId": 2, "distance": 4.21, "duration": 34 }
```
```json
200 OK  { "id": 5, "message": "주행 기록 저장 완료" }
400     { "message": "userId, distance는 필수입니다" }
```
> 프론트는 `distance`(km) / `duration`(분) 이라는 이름으로 보내고, 엔티티는
> `distanceKm` / `durationMin` 이라는 이름으로 저장한다. 그 차이는 `RideRecordRequest` DTO가 흡수한다.
> **DTO가 존재하는 이유를 보여주는 좋은 예**다.

### 파티 개설
```json
POST /api/parties
{ "hostId": 2, "routeId": 1, "title": "한강 노을 라이딩", "startAt": "2026-08-20T18:00", "maxMembers": 6 }
```
```json
200 OK
{
  "id": 3, "title": "한강 노을 라이딩",
  "routeId": 1, "routeName": "한강 라이딩", "fromLabel": "여의도", "toLabel": "뚝섬",
  "distanceKm": null,
  "startAt": "2026-08-20T18:00:00", "maxMembers": 6,
  "hostId": 2, "hostName": "testuser", "status": "open",
  "participants":    [ { "userId": 2, "name": "testuser" } ],
  "pendingRequests": [],
  "createdAt": "2026-08-19T10:00:00"
}
```
신청/승인/거절 API도 **모두 갱신된 파티 객체 하나**를 돌려준다.
프론트는 목록에서 그 id만 교체하면 되므로 목록을 다시 안 불러도 된다.
```js
const replaceParty = (updated) =>
  setParties(prev => prev.map(p => (p.id === updated.id ? updated : p)));
```

---

## HTTP 상태 코드

| 코드 | 의미 | 이 프로젝트 사용 |
|------|------|-----------------|
| 200 | 성공 | 대부분의 정상 응답 |
| 400 | 잘못된 요청 | 이메일 중복, 로그인 실패, 위치 필수값 누락 |
| 401 | 인증 필요 | **미사용** (인증 자체가 없음) |
| 403 | 권한 없음 | **미사용** |
| 404 | 찾을 수 없음 | 없는 URL (`/oauth2/authorization/...` 등) |
| 500 | 서버 오류 | DB 오류, **파티 서비스의 예외** |

> ⚠️ `PartyService` 는 "이미 신청했습니다", "정원이 초과되었습니다" 같은 **사용자 실수**에도
> `RuntimeException` 을 던진다. Spring이 이걸 잡아서 **500 Internal Server Error** 로 응답한다.
> 원래는 400(잘못된 요청)이 맞다. `@RestControllerAdvice` 로 예외를 400으로 변환하는 것이 개선 후보.

---

## DTO (Data Transfer Object) 패턴

API 요청/응답 데이터의 형태를 명시적으로 정의하는 클래스.

```java
// 요청 DTO — 프론트에서 보내는 데이터 형태
@Data
public class LoginRequest {
    private String email;
    private String password;
}

// 응답 DTO — 서버가 돌려주는 데이터 형태
@Data @AllArgsConstructor
public class RouteResponse {
    private Long id;
    private String routeName;
    private List<PointDto> bikeRoute;
    private List<PointDto> shortestRoute;
    // ...
}
```

**엔티티를 그대로 반환하지 않고 DTO를 쓰는 이유**
1. `User` 를 그대로 주면 **비밀번호 해시까지 노출**된다
2. LAZY 연관관계를 JSON 변환하다가 무한 순환·예외가 난다 (`Party` → `members` → `party` → ...)
3. 화면에 필요한 형태로 가공할 수 있다 (`PartyResponse` 는 멤버를 `participants`/`pendingRequests` 로 나눠 담는다)

`LocationController` 는 DTO 대신 자바 `record` 를 쓴다 — 짧고 불변이라 이런 용도에 잘 맞는다.
```java
public record LiveLocation(Long userId, String name, double lat, double lng, long updatedAt) {}
```

컨트롤러에서 `@RequestBody` 가 JSON → DTO 자동 변환, `ResponseEntity.ok(dto)` 가 DTO → JSON 자동 변환.

---

## 공부 리소스
- REST API 이해: https://restfulapi.net
- HTTP 상태 코드: https://developer.mozilla.org/ko/docs/Web/HTTP/Status
