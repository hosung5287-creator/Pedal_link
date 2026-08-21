# PedalLink 기술 스택 공부 가이드

> 최종 현행화: 2026-08-21 (기준 커밋 `a985c38`)
> 이 폴더의 문서는 **실제 저장소 코드 기준**으로 작성돼 있다. 코드를 고치면 관련 문서도 같이 고칠 것.

## 파일 목록

### 기술 스택 (기초)
| 파일 | 내용 |
|------|------|
| [01_전체_스택_개요.md](01_전체_스택_개요.md) | 전체 구조 한눈에 보기 + 공부 순서 |
| [02_React.md](02_React.md) | useState, useEffect, useRef, Props, localStorage |
| [03_Leaflet_지도.md](03_Leaflet_지도.md) | 지도 생성, 마커, 폴리라인, GeoJSON, divIcon, Circle |
| [04_Spring_Boot.md](04_Spring_Boot.md) | Controller, Service, ResponseEntity, CORS, Gradle |
| [05_JPA_Hibernate.md](05_JPA_Hibernate.md) | Entity, 연관관계, Repository, Optional, Hibernate Spatial |
| [06_PostgreSQL_PostGIS.md](06_PostgreSQL_PostGIS.md) | 테이블 구조, geometry 타입, 공간 쿼리 |
| [07_Spring_Security.md](07_Spring_Security.md) | BCrypt 암호화, SecurityFilterChain |
| [08_외부API.md](08_외부API.md) | BRouter 경로 계산, Kakao 장소 검색, fetch, 환경변수 |
| [09_REST_API_설계.md](09_REST_API_설계.md) | HTTP 메서드, 상태 코드, DTO 패턴, **전체 API 목록** |

### 기능별 구현 해설
| 파일 | 내용 |
|------|------|
| [10_실시간_위치공유_지오펜싱.md](10_실시간_위치공유_지오펜싱.md) | watchPosition, 폴링, 메모리 보관, 지오펜스 상태 전이 (개념·흐름) |
| [11_지오펜싱_테스트_구현코드.md](11_지오펜싱_테스트_구현코드.md) | 지오펜싱 실제 코드 전문 해설 (파일별 위치·역할) |
| [12_파티_링크_기능.md](12_파티_링크_기능.md) | 파티(링크) 모집·신청·승인 — JPA 연관관계 실전 예제 |
| [13_라이딩_기록.md](13_라이딩_기록.md) | 라이딩 시작/종료, Haversine 거리 누적, 기록 저장 API |
| [14_경로_분석.md](14_경로_분석.md) | BRouter 응답 파싱 → 거리·상승고도·노면/도로종류 분포 |
| [15_둘러보기_피드.md](15_둘러보기_피드.md) | 피드 카드, 좌표→SVG 썸네일, 좋아요, 게시물 작성, N+1 회피 |
| [16_파티_라이딩_구현.md](16_파티_라이딩_구현.md) | 파티 함께 달리기 — 멤버 위치 필터, 팔로우/heading-up, 기록 저장, 터널 공개 |

## 추천 공부 순서

```
REST API 개념 (09)
    ↓
React 기초 (02)
    ↓
Spring Boot 기초 (04)
    ↓
JPA / Hibernate (05)  ←→  파티 기능 (12) 으로 연관관계 실습
    ↓
PostgreSQL (06)
    ↓
Leaflet 지도 (03)
    ↓
Spring Security (07)
    ↓
외부 API 연동 (08)  ←→  경로 분석 (14)
    ↓
실시간 위치공유·지오펜싱 (10 → 11)
```

## 현재 구현된 기능 한눈에

| 기능 | 프론트 | 백엔드 | 상태 |
|------|--------|--------|------|
| 회원가입 / 로그인 | SignupPage, LoginPage | AuthController | ✅ |
| 소셜 로그인 (구글/네이버) | SocialLoginButtons | ❌ 없음 | ⚠️ 버튼 비활성 처리 |
| 경로 탐색 (BRouter) | MapPage, utils/leaflet | — (외부 API) | ✅ |
| 경로 저장/조회/삭제 | MapPage | RouteController + RouteService | ✅ |
| 자전거도로 표시 | MapPage | CyclewayController | ✅ |
| 경로 분석 (노면/도로종류) | MapPage AnalysisBar | — (프론트 계산) | ✅ |
| 실시간 위치공유 + 지오펜싱 | MapPage | LocationController (메모리) | ✅ |
| 위치 공유 on/off 저장 | MapPage 체크박스 | AuthController PUT | ✅ |
| 파티(링크) 모집/신청/승인 | PartyPage | PartyController + PartyService | ✅ |
| 파티 함께 달리기 | MapPage 파티모드 | `/api/locations?partyId=` | ✅ |
| 팔로우 모드 / heading-up | MapPage | — (프론트) | ✅ |
| 파티 종료 · 삭제 | PartyPage | `/end`, `DELETE /api/parties/{id}` | ✅ (호스트만) |
| 둘러보기 피드 | BrowsePage | FeedController + FeedService | ✅ |
| 피드 좋아요 | BrowsePage | `route_likes` | ✅ |
| 게시물 올리기(문구·태그) | ComposePostModal | `routes.description / tags` | ✅ |
| 피드 댓글/공유/북마크 | 아이콘만 | ❌ 없음 | ⚠️ 비활성 |
| 라이딩 기록 저장 | MapPage | RideRecordController | ✅ |
| 경로 분석값 저장 | MapPage 저장 시 전송 | `routes.distance_km / ascend_m / time_min` | ✅ (이전 저장분은 null) |
