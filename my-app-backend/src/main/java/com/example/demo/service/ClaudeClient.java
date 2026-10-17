package com.example.demo.service;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlock;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.stream.Collectors;

// Claude API 연결 하나를 프로필 AI 기능들(AI 라이딩 리포트, 통계 한마디 조언)이 같이 쓴다.
// - API 키는 환경변수 ANTHROPIC_API_KEY 로만 받는다. 없으면 AI 기능만 꺼지고(available=false) 나머지는 그대로 동작한다.
// - 응답은 JSON 스키마(structured output)로 받아 텍스트(JSON 문자열)로 돌려준다. 파싱은 부르는 쪽이 한다.
// - 실패는 화면에 그대로 보여줄 문구 + HTTP 상태를 담은 AiException 으로 던진다.
@Slf4j
@Component
public class ClaudeClient {

    public static final String MODEL = "claude-opus-5-5";

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

    @Value("${anthropic.api-key:}")
    private String apiKey;

    // 비워 두면 Anthropic 기본 주소. 프록시나 테스트용 가짜 서버를 쓸 때만 넣는다.
    @Value("${anthropic.base-url:}")
    private String baseUrl;

    private AnthropicClient client;

    @PostConstruct
    void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("ANTHROPIC_API_KEY 가 없어 프로필 AI 기능(리포트·한마디 조언)을 끕니다.");
            return;
        }
        String key = apiKey.strip();
        // .env 에 ANTHROPIC_API_KEY="sk-..." 처럼 따옴표째 적어도 동작하게
        if (key.length() >= 2 && (key.startsWith("\"") && key.endsWith("\"") || key.startsWith("'") && key.endsWith("'"))) {
            key = key.substring(1, key.length() - 1).strip();
        }
        // 키는 HTTP 헤더로 나가서 영문·숫자·기호(ASCII)만 쓸 수 있다. 복사하다 하이픈이 다른 대시(‑, –)로 바뀌거나
        // 한글·말줄임표가 섞이면 요청마다 500 이 나고, 그 오류 메시지에 키 값이 그대로 찍힌다 → 켤 때 미리 막는다.
        for (int i = 0; i < key.length(); i++) {
            char ch = key.charAt(i);
            if (ch < 0x21 || ch > 0x7E) {
                log.error("ANTHROPIC_API_KEY {}번째 글자(U+{})는 키에 쓸 수 없는 문자예요. 콘솔에서 키를 다시 복사해 넣어 주세요. AI 기능을 끕니다.",
                        i + 1, String.format("%04X", (int) ch));
                return;
            }
        }
        AnthropicOkHttpClient.Builder builder = AnthropicOkHttpClient.builder()
                .apiKey(key)
                .timeout(Duration.ofSeconds(90)); // 사용자가 화면에서 기다리는 요청이라 너무 오래 붙잡지 않는다
        if (baseUrl != null && !baseUrl.isBlank()) builder.baseUrl(baseUrl);
        client = builder.build();
    }

    @PreDestroy
    void shutdown() {
        if (client != null) client.close();
    }

    public boolean available() {
        return client != null;
    }

    // system + user 메시지를 보내고, format 스키마에 맞춘 JSON 문자열을 받는다. what 은 로그에 남길 기능 이름.
    public String askJson(String what, String system, String user, JsonOutputFormat format) {
        if (client == null) {
            throw new AiException(503, "AI 기능이 아직 설정되지 않았어요.");
        }
        MessageCreateParams params = MessageCreateParams.builder()
                .model(MODEL)
                .maxTokens(16000L)
                .system(system)
                .outputConfig(OutputConfig.builder()
                        .format(format)
                        .effort(OutputConfig.Effort.LOW) // 숫자를 보고 짧게 쓰는 일이라 깊게 생각할 일이 아니다
                        .build())
                // 안전 분류기가 거절하면 서버가 거절 종류에 맞는 다른 모델로 다시 돌린다
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .addUserMessage(user)
                .build();

        Message message;
        try {
            message = client.messages().create(params);
        } catch (RateLimitException e) {
            throw new AiException(429, "지금 AI 요청이 많아요. 잠시 후 다시 시도해 주세요.");
        } catch (UnauthorizedException | PermissionDeniedException e) {
            log.error("Claude API 키 오류: {}", e.getMessage());
            throw new AiException(503, "AI 설정에 문제가 있어요. 관리자에게 알려 주세요.");
        } catch (AnthropicServiceException e) {
            log.warn("Claude API 오류 {}: {}", e.statusCode(), e.getMessage());
            throw new AiException(502, "AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.");
        } catch (AnthropicIoException e) {
            log.warn("Claude API 연결 실패: {}", e.getMessage());
            throw new AiException(502, "AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
        } catch (RuntimeException e) {
            // 요청을 만들다 난 예외(헤더 값 오류 등) — 메시지에 키가 들어 있을 수 있어 예외 종류만 남긴다
            log.error("Claude API 요청을 보내지 못했어요: {}", e.getClass().getName());
            throw new AiException(502, "AI 요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        }

        StopReason reason = message.stopReason().orElse(null);
        if (StopReason.REFUSAL.equals(reason)) {
            throw new AiException(502, "AI 가 이 기록에 답하지 못했어요.");
        }
        if (StopReason.MAX_TOKENS.equals(reason)) {
            throw new AiException(502, "AI 응답이 중간에 끊겼어요. 다시 시도해 주세요.");
        }
        log.info("{} 생성 — 입력 {} / 출력 {} 토큰", what,
                message.usage().inputTokens(), message.usage().outputTokens());

        return message.content().stream()
                .flatMap(block -> block.text().stream())
                .map(TextBlock::text)
                .collect(Collectors.joining());
    }
}
