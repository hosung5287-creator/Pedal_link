# Spring Data JPA + Hibernate — ORM

## ORM이란?
자바 객체(클래스)와 DB 테이블을 자동으로 연결해주는 기술.
SQL을 직접 짜지 않아도 자바 코드로 DB를 조작할 수 있다.

```
자바 클래스  ↔  ORM(JPA/Hibernate)  ↔  DB 테이블
User.java    →  자동 SQL 생성       →  users 테이블
```

---

## 이 프로젝트에서 쓰인 곳
- `User`, `Route`, `Party`, `PartyMember`, `RideRecord`, `RouteLike` 엔티티를 DB 테이블과 연결
- `ddl-auto=update` 로 엔티티 변경 시 DB 스키마 자동 반영
- Repository로 SQL 없이 DB 조회/저장/삭제
- Hibernate Spatial 로 PostGIS `LineString` 을 자바 객체로 다룸

> 예외: `CyclewayController` 만 JPA를 안 쓰고 **JDBC로 직접 SQL**을 실행한다.
> PostGIS `ST_AsGeoJSON()` 결과를 그대로 문자열로 내보내는 게 목적이라 엔티티가 필요 없기 때문.

---

## 핵심 개념

### 1. @Entity — DB 테이블과 연결
```java
@Entity
@Table(name = "users")   // DB 테이블명 지정
@Data                    // Lombok: getter/setter 자동 생성
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // AUTO INCREMENT
    private Long id;

    private String name;
    private String email;
    private String password;      // BCrypt 해시값

    private String provider;      // 'local' | 'google' | 'naver'
    private String providerId;    // 제공자별 고유 식별자

    private boolean locationShareEnabled = false;   // ★ 위치 공유 동의 여부

    private LocalDateTime createdAt = LocalDateTime.now();
}
```

**필드명 → 컬럼명 자동 변환**: 자바의 camelCase 는 DB의 snake_case 로 바뀐다.
`locationShareEnabled` → `location_share_enabled`, `providerId` → `provider_id`.

**`boolean` 필드의 getter는 `is`로 시작한다**: `user.isLocationShareEnabled()` (Lombok `@Data` 규칙).

### 2. 연관관계 매핑 — @ManyToOne / @OneToMany
`Party`(파티)와 `PartyMember`(참가자)가 실제 예제다.

```java
// Party.java — 파티 1개는 호스트(User) 1명을 가리킨다
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "host_user_id", nullable = false)
private User host;                    // → parties 테이블에 host_user_id 컬럼 생성

// 파티 1개에 참가자 여러 명
@OneToMany(mappedBy = "party", cascade = CascadeType.ALL, orphanRemoval = true)
private List<PartyMember> members = new ArrayList<>();
```

| 옵션 | 뜻 |
|------|-----|
| `@ManyToOne` | 여러 파티가 한 유저(호스트)를 가리킬 수 있다 — **외래키를 가진 쪽** |
| `@JoinColumn(name=...)` | 그 외래키 컬럼 이름 지정 |
| `@OneToMany(mappedBy="party")` | 반대편. `mappedBy` 는 "외래키는 저쪽(PartyMember.party)이 관리한다"는 뜻 |
| `cascade = ALL` | 파티를 저장/삭제하면 소속 멤버도 함께 |
| `orphanRemoval = true` | 리스트에서 빠진 멤버는 DB에서도 삭제 |

**`fetch = FetchType.LAZY` 가 중요한 이유**
기본값(`EAGER`)이면 파티 1개를 조회할 때마다 호스트 User도 무조건 같이 SELECT 한다.
`LAZY` 는 `party.getHost()` 를 **실제로 호출할 때** 비로소 조회한다 → 불필요한 쿼리 감소.

단, LAZY는 트랜잭션이 끝난 뒤에 접근하면 `LazyInitializationException` 이 난다.
그래서 `PartyService` 의 메서드에 `@Transactional` 이 붙어 있고, 트랜잭션 안에서
`PartyResponse.from(party)` 이 `party.getHost().getName()` 을 읽어 DTO로 변환한다.

### 3. 복합 유니크 제약
"같은 파티에 같은 사람이 두 번 신청" 을 DB 레벨에서 막는다.
```java
@Table(name = "party_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"party_id", "user_id"})
})
```
서비스 코드에도 `existsByPartyAndUser` 검사가 있지만, **동시 요청(더블클릭 등)** 은
코드 검사만으로 못 막기 때문에 DB 제약이 최후의 방어선이 된다.

### 4. Repository — DB 조회 메서드
`JpaRepository` 를 상속하면 기본 CRUD 메서드를 무료로 얻는다.

```java
// 기본 제공 (JpaRepository에서 상속)
// save(x)        → INSERT / UPDATE
// findById(id)   → SELECT WHERE id = ?
// findAll()      → SELECT *
// deleteAllById(ids) → DELETE WHERE id IN (?)

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    // → SELECT * FROM users WHERE email = ?

    Optional<User> findByProviderAndProviderId(String provider, String providerId);
    // → SELECT * FROM users WHERE provider = ? AND provider_id = ?
}

public interface RouteRepository extends JpaRepository<Route, Long> {
    List<Route> findAllByOrderByCreatedAtDesc();
    List<Route> findByUserIdOrderByCreatedAtDesc(Long userId);
    // → SELECT * FROM routes WHERE user_id = ? ORDER BY created_at DESC
}

public interface RideRecordRepository extends JpaRepository<RideRecord, Long> {
    List<RideRecord> findByUserIdOrderByRidedAtDesc(Long userId);
}

public interface PartyMemberRepository extends JpaRepository<PartyMember, Long> {
    Optional<PartyMember> findByPartyAndUser(Party party, User user);
    List<PartyMember> findByPartyAndStatus(Party party, String status);
    boolean existsByPartyAndUser(Party party, User user);   // → SELECT EXISTS(...)
}
```

**메서드 이름이 곧 쿼리다.** 규칙:
`find/exists/count` + `By` + `필드명` + (`And`/`Or` + 필드명) + (`OrderBy` + 필드명 + `Asc`/`Desc`)

이름을 틀리면 **서버가 아예 안 뜬다** (시작 시점에 검증). 오타를 런타임까지 안 끌고 가는 장점.

### 5. Optional — null 안전 처리
```java
// 방법 1: isEmpty()로 확인
Optional<User> found = userRepository.findByEmail(req.getEmail());
if (found.isEmpty()) return ResponseEntity.badRequest().body(...);
User user = found.get();

// 방법 2: orElseThrow
User user = userRepository.findById(id)
    .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));

// 방법 3: ifPresent — 있을 때만 실행 (PartyService.toResponse)
routeRepository.findById(party.getRouteId()).ifPresent(route -> {
    r.setRouteName(route.getRouteName());
});
```

### 6. ddl-auto 옵션
```properties
spring.jpa.hibernate.ddl-auto=update
```
| 옵션 | 동작 |
|------|------|
| `create` | 시작 시 테이블 새로 만들기 (기존 데이터 삭제) |
| `update` | 엔티티 변경분만 DB에 반영 (컬럼/테이블 추가) |
| `validate` | 엔티티와 DB 일치 여부만 확인 |
| `none` | 아무것도 하지 않음 (운영 환경 권장) |

이 프로젝트가 `update` 라서, `User` 에 `locationShareEnabled` 를 추가했을 때
자동으로 `ALTER TABLE users ADD COLUMN location_share_enabled` 가 실행됐고,
`Party`/`PartyMember`/`RideRecord` 엔티티를 추가했을 때 `parties` / `party_members` /
`ride_records` 테이블이 자동 생성됐다. `Route` 에 `distanceKm` 을 추가했을 때도 마찬가지로
`routes.distance_km` 컬럼이 자동으로 붙었다 — **단, 기존 행의 값은 NULL 로 남는다.**

> 이렇게 자동 생성된 테이블은 덤프에도 그대로 담긴다.
> 최신 덤프 `DB/dump-Pedal_link-202608191557.sql` 에는 8개 테이블이 모두 들어 있다.

**`update` 가 못 하는 일**: 컬럼 삭제, 타입 변경, 이름 변경. 이런 건 직접 SQL을 쳐야 한다.

---

## Hibernate Spatial — 공간 데이터
PostGIS의 `LineString` 타입을 자바에서 다루기 위한 확장. 좌표를 다루는 자바 객체는
JTS 라이브러리(`org.locationtech.jts`)가 제공한다.

```java
// build.gradle
implementation 'org.hibernate.orm:hibernate-spatial'

// Route.java
import org.locationtech.jts.geom.LineString;

@Column(columnDefinition = "geometry(LineString, 4326)")
private LineString bikePath;      // 자전거 경로
@Column(columnDefinition = "geometry(LineString, 4326)")
private LineString shortestPath;  // 최단 경로
```

**좌표 배열 ↔ LineString 변환 (`dto/RouteService.java`)**
```java
// 저장할 때: PointDto 리스트 → LineString
private LineString toLineString(List<PointDto> points) {
    GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
    Coordinate[] coords = points.stream()
        .map(p -> new Coordinate(p.getLng(), p.getLat()))   // ★ PostGIS는 (경도, 위도) 순서
        .toArray(Coordinate[]::new);
    return gf.createLineString(coords);
}

// 읽을 때: LineString → PointDto 리스트
private List<PointDto> fromLineString(LineString line) {
    return Arrays.stream(line.getCoordinates())
        .map(c -> { PointDto p = new PointDto(); p.setLat(c.y); p.setLng(c.x); return p; })
        .collect(Collectors.toList());
}
```
`Coordinate` 의 `x` = 경도, `y` = 위도. **Leaflet과 반대**라는 걸 계속 기억해야 한다.

---

## 공부 리소스
- JPA 공식: https://spring.io/projects/spring-data-jpa
- Hibernate 문서: https://hibernate.org/orm/documentation
- 메서드 이름 규칙: https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html
