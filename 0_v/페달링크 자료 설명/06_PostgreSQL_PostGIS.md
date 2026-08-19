# PostgreSQL 18 + PostGIS — 공간 데이터베이스

## 이 프로젝트에서 쓰인 곳
- 사용자(`users`), 경로(`routes`), 자전거도로(`cycleways`), 파티(`parties`, `party_members`) 저장
- 자전거 경로를 `LineString`(선 좌표 배열) 타입으로 저장
- 서울 자전거도로 GIS 데이터 저장 및 GeoJSON 변환 조회

DB 이름은 **`Pedal_link`** (대소문자 구분 — 쿼리에서 큰따옴표 필요).

---

## PostgreSQL 기본 개념

### 주요 명령어 (psql)
```sql
\l              -- 데이터베이스 목록
\c Pedal_link   -- 데이터베이스 연결
\dt             -- 테이블 목록
\d users        -- users 테이블 구조 보기
\q              -- 종료
```

---

## 이 프로젝트 테이블 구조

### users
```sql
id                      BIGINT PRIMARY KEY
name                    VARCHAR(255) NOT NULL
email                   VARCHAR(255) NOT NULL
password                VARCHAR(255)       -- BCrypt 해시값
provider                VARCHAR(255)       -- 'local' | 'google' | 'naver'
provider_id             VARCHAR(255)
location_share_enabled  BOOLEAN            -- 위치 공유 동의 (엔티티 추가 후 자동 생성)
created_at              TIMESTAMP NOT NULL DEFAULT now()

-- ⚠️ 옛 스키마 잔재 (User 엔티티에 없어서 아무도 안 씀)
login_id                VARCHAR(50)
password_hash           VARCHAR(255)
```
> `login_id`, `password_hash` 는 초기 설계 때 만든 컬럼인데 지금 엔티티에는 없다.
> `ddl-auto=update` 는 **컬럼을 지우지 않기 때문에** 계속 남아있다. 정리하려면 직접
> `ALTER TABLE users DROP COLUMN login_id, DROP COLUMN password_hash;` 를 실행해야 한다.

### routes
```sql
id             BIGINT PRIMARY KEY (IDENTITY)
user_id        BIGINT                       -- 어떤 유저의 경로인지 (FK 제약은 없음)
route_name     VARCHAR(255)
from_lat       DOUBLE PRECISION
from_lng       DOUBLE PRECISION
from_label     VARCHAR(255)                 -- 출발지 이름
to_lat         DOUBLE PRECISION
to_lng         DOUBLE PRECISION
to_label       VARCHAR(255)                 -- 도착지 이름
distance_km    DOUBLE PRECISION             -- 경로 거리 km (BRouter 분석값, 저장 시 함께 기록)
ascend_m       INTEGER                      -- 상승고도 m  (@Column(name=...) 로 컬럼명 고정)
time_min       INTEGER                      -- 예상 소요 분
description    VARCHAR(500)                 -- 둘러보기 게시물 문구 (작성 모달에서 입력)
tags           VARCHAR(300)                 -- 해시태그, 쉼표 구분 "야경,초보코스,한강"
bike_path      geometry(LineString, 4326)   -- PostGIS 타입 (자전거 경로)
shortest_path  geometry(LineString, 4326)   -- 최단 경로
created_at     TIMESTAMP(6)
```

### cycleways (서울 자전거도로 — ogr2ogr로 임포트)
```sql
id       BIGSERIAL PRIMARY KEY
name     VARCHAR
gu       VARCHAR NOT NULL     -- 구 이름 (지역 필터에 사용, 인덱스 있음)
highway  VARCHAR NOT NULL
bicycle  VARCHAR
surface  VARCHAR
oneway   VARCHAR
geom     geometry(LineString, 4326) NOT NULL
```
총 **2673행**. 임포트 방법은 `SETUP.md` Step 9 참고.

### route_likes (둘러보기 좋아요)
```sql
id         BIGINT PRIMARY KEY
route_id   BIGINT NOT NULL
user_id    BIGINT NOT NULL
created_at TIMESTAMP

UNIQUE (route_id, user_id)      -- 같은 사람이 같은 경로에 두 번 못 누르게
```

### ride_records (주행 기록)
```sql
id           BIGINT PRIMARY KEY
user_id      BIGINT
distance_km  DOUBLE PRECISION     -- 주행 거리 (km)
duration_min INTEGER              -- 소요 시간 (분)
rided_at     TIMESTAMP
```

### parties (파티 = "링크")
```sql
id            BIGINT PRIMARY KEY
host_user_id  BIGINT NOT NULL      -- FK → users.id
route_id      BIGINT               -- routes.id 를 가리키지만 FK 제약은 없음 (엔티티가 Long 필드)
title         VARCHAR(200) NOT NULL
start_at      TIMESTAMP NOT NULL   -- 모임 시간
max_members   INT NOT NULL         -- 기본 6
status        VARCHAR(20) NOT NULL -- 'open' | 'full'
created_at    TIMESTAMP NOT NULL
```

### party_members (참가 신청/확정)
```sql
id         BIGINT PRIMARY KEY
party_id   BIGINT NOT NULL      -- FK → parties.id
user_id    BIGINT NOT NULL      -- FK → users.id
status     VARCHAR(20) NOT NULL -- 'pending' | 'joined' | 'rejected'
joined_at  TIMESTAMP

UNIQUE (party_id, user_id)      -- 같은 파티에 같은 사람 중복 신청 금지
```

> `parties` / `party_members` / `ride_records` / `route_likes` 와
> `routes` 의 분석·게시물 컬럼(`distance_km`, `ascend_m`, `time_min`, `description`, `tags`)은
> `DB/dump-Pedal_link-202607241122.sql`(7/24 덤프)에 **없다.**
> 그 이후에 추가된 엔티티/필드라서, 덤프를 복원한 뒤 백엔드를 한 번 실행하면
> `ddl-auto=update` 가 자동으로 만들어준다.
> 단, 이미 저장돼 있던 경로의 `distance_km` 는 `NULL` 로 남는다 (기존 행은 채워주지 않는다).

---

## PostGIS — 공간 데이터 확장

PostgreSQL에 지리 공간 데이터 처리 기능을 추가하는 확장 모듈.

### 설치 및 활성화
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### SRID 4326이란?
좌표계를 나타내는 코드. `4326` 은 WGS84 — GPS에서 쓰는 전 세계 표준 위도/경도 좌표계.

```sql
geometry(LineString, 4326)
-- LineString: 선 (여러 좌표를 이은 경로)
-- 4326: WGS84 좌표계
```

### geometry 타입 종류
| 타입 | 설명 | 예시 |
|------|------|------|
| Point | 점 하나 | 마커 위치 |
| LineString | 선 (좌표 배열) | 자전거 경로 |
| Polygon | 면 | 지역 경계 |
| MultiPolygon | 여러 면 | 서울시 구 경계 전체 |

### 이 프로젝트가 실제로 쓰는 PostGIS 함수
```sql
-- CyclewayController 가 쓰는 함수: geometry → GeoJSON 문자열
SELECT name, gu, highway, bicycle, surface, oneway,
       ST_AsGeoJSON(geom) AS geojson
FROM cycleways;
```
백엔드는 이 결과를 문자열로 이어붙여 `FeatureCollection` GeoJSON을 만들어 프론트에 준다.
프론트는 그걸 그대로 `L.geoJSON()` 에 넣는다.

### 알아두면 유용한 함수 (아직 코드에는 없음)
```sql
-- LineString의 길이 계산 (미터 단위) — 경로 거리 표시에 쓸 수 있다
SELECT ST_Length(bike_path::geography) FROM routes WHERE id = 1;

-- 특정 반경 1km 내 경로 조회 — 지오펜싱을 서버에서 하고 싶을 때
SELECT * FROM routes
WHERE ST_DWithin(bike_path::geography, ST_MakePoint(126.97, 37.56)::geography, 1000);
```
`::geography` 로 캐스팅해야 **미터 단위**로 계산된다. 캐스팅 안 하면 도(degree) 단위가 나온다.

---

## 유용한 관리 쿼리

```sql
-- 전체 경로 확인 (이메일 포함)
SELECT r.id, u.email, r.route_name, r.from_label, r.to_label, r.created_at
FROM routes r JOIN users u ON r.user_id = u.id
ORDER BY r.created_at DESC;

-- 특정 유저의 경로만
SELECT * FROM routes WHERE user_id = 2 ORDER BY created_at DESC;

-- 사용자 목록 (위치 공유 동의 여부 포함)
SELECT id, name, email, provider, location_share_enabled, created_at FROM users;

-- 파티 현황 — 정원 대비 확정 인원
SELECT p.id, p.title, u.name AS host, p.start_at, p.status,
       COUNT(*) FILTER (WHERE m.status = 'joined')  AS joined,
       COUNT(*) FILTER (WHERE m.status = 'pending') AS pending,
       p.max_members
FROM parties p
JOIN users u ON p.host_user_id = u.id
LEFT JOIN party_members m ON m.party_id = p.id
GROUP BY p.id, u.name
ORDER BY p.created_at DESC;

-- 유저별 누적 주행 거리
SELECT u.name, COUNT(*) AS rides, ROUND(SUM(r.distance_km)::numeric, 1) AS total_km
FROM ride_records r JOIN users u ON r.user_id = u.id
GROUP BY u.name ORDER BY total_km DESC;

-- 거리 정보가 없는(옛날에 저장된) 경로 찾기
SELECT id, route_name, created_at FROM routes WHERE distance_km IS NULL;

-- 피드 인기순 (좋아요 많은 코스)
SELECT r.id, r.route_name, u.name AS author, COUNT(l.id) AS likes
FROM routes r
LEFT JOIN users u ON r.user_id = u.id
LEFT JOIN route_likes l ON l.route_id = r.id
GROUP BY r.id, u.name
ORDER BY likes DESC, r.created_at DESC;

-- 문구를 직접 쓴 게시물만
SELECT id, route_name, description, tags FROM routes WHERE description IS NOT NULL;

-- 구별 자전거도로 개수
SELECT gu, COUNT(*) FROM cycleways GROUP BY gu ORDER BY COUNT(*) DESC;
```

---

## DB 덤프 & 복원

```powershell
# 덤프 (백업)
pg_dump -U postgres Pedal_link > backup.sql

# 복원
psql -U postgres -d Pedal_link -f backup.sql

# 전체 클러스터 덤프
pg_dumpall -U postgres > cluster_dump.sql
```
저장소의 최신 덤프: `DB/dump-Pedal_link-202607241122.sql` (2026-07-24, PostgreSQL 18.4)

---

## 공부 리소스
- PostgreSQL 문서: https://www.postgresql.org/docs/
- PostGIS 문서: https://postgis.net/documentation/
