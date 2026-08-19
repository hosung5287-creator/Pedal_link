# Spring Security — 인증/보안

## 이 프로젝트에서 쓰인 곳
- 비밀번호 BCrypt 암호화/검증 (**이게 사실상 전부**)
- 개발 중 모든 API 요청 허용 설정
- Security 필터가 CORS·로그인폼으로 간섭하지 않도록 끄기

> 요약: Spring Security 라이브러리를 넣긴 했지만 **인증 기능은 쓰지 않고**
> `BCryptPasswordEncoder` 하나만 쓰고 있다. 나머지 설정은 전부 "방해하지 마"에 가깝다.

---

## 실제 설정 코드 (Config/SecurityConfig.java)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())      // ① WebConfig의 CORS 설정을 따르게 함
            .csrf(csrf -> csrf.disable())         // ② CSRF 보호 비활성화
            .formLogin(login -> login.disable())  // ③ 기본 로그인 폼 비활성화
            .httpBasic(basic -> basic.disable())  // ④ 브라우저 기본 인증창 비활성화
            .authorizeHttpRequests(auth -> auth
                .anyRequest().permitAll()          // ⑤ 모든 요청 허용 (개발 중)
            );
        return http.build();
    }

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

### 네 줄이 각각 왜 필요했나 (커밋 기록 기준)

| 설정 | 없으면 생기는 문제 | 관련 커밋 |
|------|-------------------|----------|
| `.cors(...)` | Security 필터가 CORS preflight(OPTIONS)를 먼저 막아서, `WebConfig` 설정이 있어도 프론트에서 CORS 에러 | `c42da00` |
| `.csrf().disable()` | POST/PUT 요청이 403으로 거부됨 (CSRF 토큰 없음) | — |
| `.formLogin().disable()` | 인증 실패 시 Spring이 **로그인 HTML 페이지로 리다이렉트** → 프론트가 JSON 대신 HTML을 받고 파싱 실패 | `b08c13a` |
| `.httpBasic().disable()` | 브라우저 기본 인증 팝업창이 뜸 | `b08c13a` |

**운영 환경에서는 ⑤를 이렇게 바꿔야 한다:**
```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/**").permitAll()  // 로그인/회원가입은 누구나
    .anyRequest().authenticated()                  // 나머지는 로그인 필요
)
```

---

## BCryptPasswordEncoder — 비밀번호 암호화

비밀번호를 그대로 저장하면 DB 유출 시 위험하다.
BCrypt는 **단방향 해시** — 해시값에서 원래 비밀번호를 되돌릴 수 없다.

**회원가입 시 — 암호화해서 저장 (AuthController)**
```java
User user = new User();
user.setEmail(req.getEmail());
user.setPassword(passwordEncoder.encode(req.getPassword()));  // "12345678" → "$2a$10$..."
user.setProvider("local");
userRepository.save(user);
```

**로그인 시 — 입력값과 저장값 비교**
```java
if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
    return ResponseEntity.badRequest().body(Map.of("message", "이메일 또는 비밀번호가 틀렸습니다."));
}
```
`matches()` 는 입력 비밀번호를 **저장된 해시에 들어있는 salt로 다시 해싱해서** 비교한다.
그래서 같은 비밀번호라도 사용자마다 저장된 해시값이 다르다.

**작은 보안 습관 하나**: 이 코드는 "이메일 없음"과 "비밀번호 틀림"에 **똑같은 메시지**를 준다.
메시지를 다르게 하면 공격자가 "이 이메일은 가입돼 있구나"를 알아낼 수 있기 때문이다.

---

## CSRF란?
Cross-Site Request Forgery — 다른 사이트에서 사용자 대신 요청을 보내는 공격.
쿠키 세션 기반 웹앱에서 위험하다. REST API + 토큰 방식에서는 일반적으로 비활성화한다.

---

## 현재 프로젝트의 인증 방식과 한계

```
로그인 성공 → 서버가 user 정보(id, name, email, locationShareEnabled) 반환
           → 프론트가 localStorage에 저장
           → 이후 요청에 userId를 body/쿼리에 직접 담아서 보냄
```

**한계 — 서버가 요청자를 전혀 검증하지 않는다.**

| 위험 | 구체적으로 |
|------|-----------|
| 남의 데이터 조작 | `POST /api/routes/delete` 에 남의 경로 id를 넣으면 그대로 삭제됨 |
| 사칭 | `POST /api/locations` 에 아무 userId나 넣으면 그 사람 위치인 척 가능 |
| 남의 파티 승인 | `POST /api/parties/{id}/requests/{userId}/approve` 를 아무나 호출 가능 (호스트 확인 없음) |
| 설정 변조 | `PUT /api/auth/users/{id}/location-sharing` 으로 남의 설정 변경 가능 |
| 새로고침 로그아웃 안 됨 | localStorage는 브라우저에 계속 남음 — 공용 PC에서 위험 |

**개선 방향**: JWT(토큰) 또는 세션 쿠키로 서버에서 인증하고,
각 API에서 "요청자 == 자원 주인" 을 확인해야 한다.

---

## JWT란? (다음 단계로 배울 것)
로그인 성공 시 서버가 서명된 토큰을 발급 → 클라이언트가 매 요청마다 토큰을 보냄 → 서버가 검증.

```
로그인 → 서버: "eyJhbGci..." 토큰 발급
요청  → Header: Authorization: Bearer eyJhbGci...
서버  → 토큰 서명 검증 → 유효하면 처리 + 토큰 안의 userId를 신뢰
```
이렇게 하면 프론트가 보내는 `userId` 를 안 믿고 **토큰에서 꺼낸 userId** 를 쓰게 되어
위 표의 문제들이 한 번에 해결된다.

---

## ⚠️ 소셜 로그인 — 프론트만 있고 백엔드가 없다 (현재 비활성)

`src/api/auth.js` 에는 백엔드 인가 URL로 이동시키는 함수가 있다:
```js
export const socialLoginUrl = (provider) => `${API_BASE}/oauth2/authorization/${provider}`;
export function startSocialLogin(provider) { window.location.href = socialLoginUrl(provider); }
```
하지만 백엔드에는 **OAuth2 설정이 없다.**
- `build.gradle` 에 `spring-boot-starter-oauth2-client` 의존성 없음
- `SecurityConfig` 에 `.oauth2Login()` 없음

그래서 누르면 404가 나던 구글/네이버 버튼을 **`disabled` 로 바꾸고
"소셜 로그인은 준비 중입니다" 안내를 붙였다** (`components/SocialLoginButtons.js`).
백엔드가 준비되면 `disabled` 를 지우고 `onClick={() => startSocialLogin('google')}` 을 다시 연결하면 된다.

세션 기반 함수였던 `getMe()` / `logout()` 은 아무 데서도 호출되지 않아 **삭제했다.**
(`/api/auth/me`, `/api/auth/logout` 도 백엔드에 없었다)

`User` 엔티티의 `provider` / `providerId` 필드와 `UserRepository.findByProviderAndProviderId()` 는
**미래를 대비해 미리 만들어둔 것**이라 그대로 남겨뒀다.

### 붙이려면 필요한 것
1. `build.gradle` 에 `implementation 'org.springframework.boot:spring-boot-starter-oauth2-client'`
2. `application.properties` 에 `spring.security.oauth2.client.registration.google.client-id/secret`
   (**절대 커밋하지 말 것** — `.example` 파일에는 자리표시자만)
3. `SecurityConfig` 에 `.oauth2Login(o -> o.successHandler(...))`
4. 성공 핸들러에서 `findByProviderAndProviderId()` 로 찾고 없으면 새로 가입시키기

---

## 공부 리소스
- Spring Security 문서: https://spring.io/projects/spring-security
- BCrypt 이해: https://auth0.com/blog/hashing-in-action-understanding-bcrypt/
- OAuth2 로그인: https://docs.spring.io/spring-security/reference/servlet/oauth2/login/index.html
