package com.example.demo.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

// Gemini API 연결 하나를 프로필 AI 기능들(AI 라이딩 리포트, 통계 한마디 조언)이 같이 쓴다.
// - API 키는 환경변수 GEMINI_API_KEY(또는 my-app-backend/.env)로만 받는다. 없으면 AI 기능만 꺼지고(available=false) 나머지는 그대로 동작한다.
// - REST generateContent 를 직접 부른다(추가 라이브러리 없음). 응답은 JSON 스키마(responseSchema)로 받아
//   텍스트(JSON 문자열)로 돌려준다. 파싱은 부르는 쪽이 한다.
// - 실패는 화면에 그대로 보여줄 문구 + HTTP 상태를 담은 AiException 으로 던진다.
@Slf4j
@Component
public class GeminiClient {

    private static final String DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
    private static final String DEFAULT_MODEL = "gemini-3.8-flash";

    // 화면에 그대로 보여줄 메시지와 HTTP 상태를 같이 들고 다닌다
    public static class AiException extends RuntimeException {
        private final int status;

        public AiException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int getStatus() {
            return status;
        }
    }

    @Value("${gemini.api-key:}")
    private String apiKey;

    // 바꾸고 싶을 때만 GEMINI_MODEL 로 준다 (예: 더 싸고 빠른 gemini-3.5-flash-lite)
    @Value("${gemini.model:}")
    private String modelName;

    // 비워 두면 Google 기본 주소. 프록시나 테스트용 가짜 서버를 쓸 때만 넣는다.
    @Value("${gemini.base-url:}")
    private String baseUrl;

    private final JsonMapper json = JsonMapper.builder().build();
    private HttpClient http;
    private String key;
    private String model = DEFAULT_MODEL;
    private URI endpoint;

    @PostConstruct
    void init() {
        if (modelName != null && !modelName.isBlank()) model = modelName.strip();
        if (apiKey == null || apiKey.isBlank()) {
            log.info("GEMINI_API_KEY 가 없어 프로필 AI 기능(리포트·한마디 조언)을 끕니다.");
            return;
        }
        String k = apiKey.strip();
        // .env 에 GEMINI_API_KEY="AIza..." 처럼 따옴표째 적어도 동작하게
        if (k.length() >= 2 && (k.startsWith("\"") && k.endsWith("\"") || k.startsWith("'") && k.endsWith("'"))) {
            k = k.substring(1, k.length() - 1).strip();
        }
        // 키는 HTTP 헤더로 나가서 영문·숫자·기호(ASCII)만 쓸 수 있다. 복사하다 다른 대시나 한글·공백이 섞이면
        // 요청마다 실패하므로 켤 때 미리 막는다. 로그에는 키 값을 남기지 않는다.
        for (int i = 0; i < k.length(); i++) {
            char ch = k.charAt(i);
            if (ch < 0x21 || ch > 0x7E) {
                log.error("GEMINI_API_KEY {}번째 글자(U+{})는 키에 쓸 수 없는 문자예요. Google AI Studio 에서 키를 다시 복사해 넣어 주세요. AI 기능을 끕니다.",
                        i + 1, String.format("%04X", (int) ch));
                return;
            }
        }
        String base = (baseUrl == null || baseUrl.isBlank()) ? DEFAULT_BASE_URL : baseUrl.strip().replaceAll("/+$", "");
        endpoint = URI.create(base + "/v1beta/models/" + URLEncoder.encode(model, StandardCharsets.UTF_8) + ":generateContent");
        key = k;
        http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        log.info("Gemini AI 기능을 켭니다 — 모델 {}", model);
    }

    public boolean available() {
        return http != null;
    }

    // 결과를 저장할 때 어떤 모델이 썼는지 함께 남긴다
    public String model() {
        return model;
    }

    // system + user 메시지를 보내고, schema(Gemini responseSchema 형식)에 맞춘 JSON 문자열을 받는다.
    // what 은 로그에 남길 기능 이름.
    public String askJson(String what, String system, String user, Map<String, Object> schema) {
        if (!available()) {
            throw new AiException(503, "AI 기능이 아직 설정되지 않았어요.");
        }
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", system))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", user)))),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", schema));

        HttpResponse<String> res;
        try {
            HttpRequest req = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(90)) // 사용자가 화면에서 기다리는 요청이라 너무 오래 붙잡지 않는다
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", key)
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8))
                    .build();
            res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (HttpTimeoutException e) {
            log.warn("Gemini API 응답 시간 초과 ({})", what);
            throw new AiException(502, "AI 응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.");
        } catch (IOException e) {
            log.warn("Gemini API 연결 실패: {}", e.getClass().getSimpleName());
            throw new AiException(502, "AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AiException(502, "AI 요청이 중단됐어요. 다시 시도해 주세요.");
        } catch (RuntimeException e) {
            // 요청을 만들다 난 예외 — 메시지에 키가 들어 있을 수 있어 예외 종류만 남긴다
            log.error("Gemini API 요청을 보내지 못했어요: {}", e.getClass().getName());
            throw new AiException(502, "AI 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        }

        JsonNode root;
        try {
            root = json.readTree(res.body());
        } catch (JacksonException e) {
            log.warn("Gemini API 응답을 읽지 못했어요 (HTTP {})", res.statusCode());
            throw new AiException(502, "AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
        }

        int code = res.statusCode();
        if (code != 200) {
            String status = root.path("error").path("status").asString("");
            String message = root.path("error").path("message").asString("");
            log.warn("Gemini API 오류 {} {}: {}", code, status, message.length() > 300 ? message.substring(0, 300) : message);
            if (code == 429) {
                throw new AiException(429, "지금 AI 요청이 많거나 사용 한도를 넘었어요. 잠시 후 다시 시도해 주세요.");
            }
            // 키가 틀림(400 API_KEY_INVALID)·권한 없음(401/403)·모델 이름이 틀림(404) — 서버 설정 문제
            if (code == 401 || code == 403 || code == 404 || (code == 400 && message.contains("API key"))) {
                throw new AiException(503, "AI 설정에 문제가 있어요. 관리자에게 알려 주세요.");
            }
            throw new AiException(502, "AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.");
        }

        JsonNode candidate = root.path("candidates").path(0);
        if (candidate.isMissingNode()) {
            // 질문 자체가 안전 필터에 걸리면 후보 없이 이유만 온다
            log.warn("Gemini 가 답하지 않았어요 ({}): blockReason={}", what,
                    root.path("promptFeedback").path("blockReason").asString(""));
            throw new AiException(502, "AI 가 이 기록에 답하지 못했어요.");
        }
        String finish = candidate.path("finishReason").asString("STOP");
        if ("MAX_TOKENS".equals(finish)) {
            throw new AiException(502, "AI 응답이 중간에 끊겼어요. 다시 시도해 주세요.");
        }
        if (!"STOP".equals(finish)) {
            log.warn("Gemini 응답이 끝까지 오지 않았어요 ({}): finishReason={}", what, finish);
            throw new AiException(502, "AI 가 이 기록에 답하지 못했어요.");
        }

        StringBuilder text = new StringBuilder();
        for (JsonNode part : candidate.path("content").path("parts")) {
            if (!part.path("thought").asBoolean(false)) text.append(part.path("text").asString(""));
        }
        JsonNode usage = root.path("usageMetadata");
        log.info("{} 생성 ({}) — 입력 {} / 출력 {} / 생각 {} 토큰", what, model,
                usage.path("promptTokenCount").asInt(0), usage.path("candidatesTokenCount").asInt(0),
                usage.path("thoughtsTokenCount").asInt(0));
        if (text.isEmpty()) {
            throw new AiException(502, "AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
        }
        return text.toString();
    }
}
