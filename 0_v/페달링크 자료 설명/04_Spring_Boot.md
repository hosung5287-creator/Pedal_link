# Spring Boot 4 — 백엔드 프레임워크

## 이 프로젝트에서 쓰인 곳
- REST API 서버 (포트 8080)
- 회원가입/로그인 처리
- 경로 저장/조회/삭제, 자전거도로 GeoJSON 제공
- 파티(링크) 모집·신청·승인
- 실시간 위치 보관/중계 (메모리)

---

## 핵심 개념

### 1. 프로젝트 구조 (실제)
```
com.example.demo
├── MyAppBackendApplication.java   ← @SpringBootApplication (메인)
├── TestController.java            ← 동작 확인용
├── WebConfig.java                 ← ★ CORS 설정 (최상위 패키지에 있음, Config/ 아님)
├── Config/
│   └── SecurityConfig.java        ← Spring Security 설정 + BCrypt Bean
├── controller/
│   ├── AuthController.java        ← 회원가입/로그인/위치공유 설정
│   ├── RouteController.java       ← 경로 API
│   ├── CyclewayController.java    ← 자전거도로 GeoJSON (JDBC 직접 사용)
│   ├── PartyController.java       ← 파티(링크) API
│   ├── RideRecordController.java  ← 주행 기록 저장/조회
│   ├── FeedController.java        ← 둘러보기 피드 / 좋아요
│   └── LocationController.java    ← 실시간 위치 보관/중계 (DB 미사용)
├── dto/
│   ├── SignupRequest / LoginRequest
│   ├── RouteRequest / RouteResponse / PointDto
│   ├── PartyRequest / PartyResponse
│   ├── RideRecordRequest
│   └── RouteService.java          ← ★ @Service 인데 dto 패키지에 있음 (원래는 service/ 가 맞음)
├── service/
│   ├── PartyService.java          ← 파티 비즈니스 로직
│   └── FeedService.java           ← 피드 조립 / 좋아요 토글
├── entity/
│   ├── User.java / Route.java / RideRecord.java / RouteLike.java
│   └── Party.java / PartyMember.java
└── repository/
    ├── UserRepository / RouteRepository / RideRecordRepository
    └── PartyRepository / PartyMemberRepository
```

> 📌 두 가지 "위치가 어색한" 파일이 있다. 동작에는 문제없지만 알고 있어야 한다.
> - `WebConfig` 는 `Config/` 폴더가 아니라 최상위 패키지
> - `RouteService` 는 `service/` 가 아니라 `dto/` 패키지
>
> Spring은 **메인 클래스가 있는 패키지 아래 전부를 스캔**하기 때문에 폴더 위치가 달라도
> `@Service` / `@Configuration` 은 정상 등록된다. 다만 사람이 찾기 어려워진다.

### 2. @RestController — API 엔드포인트 만들기
```java
@RestController              // JSON 응답을 반환하는 컨트롤러
@RequestMapping("/api/auth") // 기본 URL 경로
@RequiredArgsConstructor     // final 필드 생성자 자동 생성 → 의존성 주입
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @PostMapping("/login")   // POST /api/auth/login
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return ResponseEntity.ok(Map.of("id", 1, "name", "홍길동"));
    }
}
```

### 3. @RequestBody / @PathVariable / @RequestParam
```java
// 요청 Body (JSON → 자바 객체)
public ResponseEntity<?> signup(@RequestBody SignupRequest req)

// URL 경로의 값 (/routes/5 → id=5)
public ResponseEntity<?> getRoute(@PathVariable Long id)

// URL 쿼리 파라미터 (/routes?userId=2 → userId=2)
public ResponseEntity<?> getRoutes(@RequestParam(required = false) Long userId)

// 여러 개도 가능 (PartyController)
@PostMapping("/{id}/requests/{userId}/approve")
public ResponseEntity<PartyResponse> approve(@PathVariable Long id, @PathVariable Long userId)
```

### 4. ResponseEntity — HTTP 응답 제어
```java
ResponseEntity.ok(data)                    // 200 OK + 데이터
ResponseEntity.badRequest().body(message)  // 400 Bad Request + 메시지
ResponseEntity.status(500).body("DB 오류")  // 500
```

`ResponseEntity` 를 안 쓰고 객체를 그냥 반환해도 된다 (자동으로 200 OK).
```java
@GetMapping
public List<PartyResponse> getParties() {   // PartyController — 그냥 반환
    return partyService.getParties();
}
```

### 5. @Service — 비즈니스 로직
Controller와 Repository 사이에서 실제 처리를 담당.
```java
@Service
@RequiredArgsConstructor
public class PartyService {
    private final PartyRepository partyRepository;
    private final PartyMemberRepository partyMemberRepository;

    @Transactional                       // 메서드 전체를 하나의 DB 트랜잭션으로 묶음
    public PartyResponse createParty(PartyRequest req) {
        Party saved = partyRepository.save(party);
        partyMemberRepository.save(hostMember);   // 둘 다 성공하거나 둘 다 실패
        return toResponse(saved);
    }
}
```

**@Transactional 이 필요한 이유**: 파티를 만들면 `parties` 1행 + `party_members` 1행(호스트)을
같이 넣어야 한다. 중간에 실패했는데 파티만 남으면 "호스트 없는 파티"가 된다.
`@Transactional` 이 있으면 예외 발생 시 **전부 되돌린다(rollback)**.

### 6. record — 짧은 데이터 클래스 (Java 16+)
`LocationController` 는 Lombok 대신 자바 표준 `record` 를 쓴다.
```java
public record LiveLocation(Long userId, String name, double lat, double lng, long updatedAt) {}
```
- 생성자, getter(`userId()` 형태), `equals`, `hashCode`, `toString` 자동 생성
- **불변(immutable)** — 한 번 만들면 값을 못 바꿈. 여러 스레드가 동시에 읽어도 안전
- getter 이름에 `get` 이 안 붙는다 (`req.userId()`, `req.lat()`)

### 7. application.properties — 설정 파일
실제 `application.properties` 는 비밀번호가 들어가므로 **커밋되지 않는다.**
`application.properties.example` 을 복사해서 만든다.

```properties
spring.application.name=my-app-backend

spring.datasource.url=jdbc:postgresql://localhost:5432/Pedal_link
spring.datasource.username=postgres
spring.datasource.password=YOUR_DB_PASSWORD
spring.datasource.driver-class-name=org.postgresql.Driver

spring.jpa.hibernate.ddl-auto=update   # 엔티티 변경 시 DB 자동 반영
spring.jpa.show-sql=true               # 실행된 SQL을 콘솔에 출력
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```
> DB 이름은 `Pedal_link` 다. (`testbike` 는 옛 이름 — `DB/application.yml.txt` 에 남아있는 건 구버전)

### 8. Lombok — 반복 코드 자동 생성
```java
@Data                      // getter/setter/toString/equals 자동 생성
@RequiredArgsConstructor   // final 필드를 받는 생성자 자동 생성 (= 생성자 주입)
@AllArgsConstructor        // 모든 필드를 받는 생성자 (RouteResponse에서 사용)
```

---

## CORS 설정 (실제 코드)
프론트(3000포트)에서 백엔드(8080포트)로 요청 시 브라우저가 차단하는 것을 허용.

```java
// WebConfig.java — 허용 오리진은 이 한 곳에서만 관리한다 (컨트롤러별 @CrossOrigin 은 제거됨)
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(
                        "http://localhost:3000",
                        "https://*.trycloudflare.com")   // cloudflared 임시 터널 (재시작마다 주소가 바뀜)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

**`allowedOrigins` 가 아니라 `allowedOriginPatterns` 인 이유**
- `allowedOrigins` 는 `*` 와일드카드를 못 쓰고, `allowCredentials(true)` 와 같이 쓰면 에러가 난다
- `https://*.trycloudflare.com` 처럼 **서브도메인이 매번 바뀌는 터널 주소**를 허용하려면 패턴이 필요

**Spring Security도 CORS를 알아야 한다**
`WebConfig` 만 설정하면 Security 필터가 먼저 요청을 막아버린다. 그래서 `SecurityConfig` 에
`.cors(Customizer.withDefaults())` 를 넣어 "WebConfig의 CORS 설정을 따르라"고 알려준다.
(커밋 `c42da00` 이 이 문제를 고친 것)

---

## Gradle — 빌드 도구
```gradle
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }   // ★ Java 21

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'       // 웹 서버
    implementation 'org.springframework.boot:spring-boot-starter-webmvc'    // (Boot 4 신규 스타터)
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'  // ORM
    implementation 'org.springframework.boot:spring-boot-starter-security'  // 보안(BCrypt)
    implementation 'org.hibernate.orm:hibernate-spatial'                    // 공간 데이터
    implementation 'org.postgresql:postgresql'                              // PostgreSQL 드라이버
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
}
```
> 현재 `build.gradle` 에는 같은 의존성이 두 번 적힌 줄이 몇 개 있다 (web, data-jpa, lombok, postgresql).
> 빌드는 되지만 중복이므로 정리 대상.

---

## 실행 명령어
```bash
cd my-app-backend
gradlew bootRun      # 개발 서버 실행 (포트 8080) — 윈도우
./gradlew bootRun    # macOS/Linux
./gradlew build      # 빌드 (JAR 파일 생성)
```
`Started MyAppBackendApplication in x.xxx seconds` 가 뜨면 성공.

---

## 공부 리소스
- 공식 문서: https://spring.io/projects/spring-boot
- Spring 가이드: https://spring.io/guides
