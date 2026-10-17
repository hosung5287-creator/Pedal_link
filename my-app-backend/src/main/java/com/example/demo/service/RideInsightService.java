package com.example.demo.service;

import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.JsonOutputFormat;
import com.example.demo.dto.RideInsightResponse;
import com.example.demo.entity.RideInsight;
import com.example.demo.entity.RideRecord;
import com.example.demo.repository.RideInsightRepository;
import com.example.demo.service.ClaudeClient.AiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// 프로필 "AI 라이딩 리포트" — 내 라이딩 기록 숫자를 Claude 에 보내 수준 한줄 요약과 조언을 받는다.
//
// - 질문은 모든 사용자에게 같다(QUESTION). 사용자가 직접 입력하지 않는다.
// - Claude 에는 숫자(거리·시간·상승고도·날짜·파티 여부)만 보낸다. 이름·이메일은 보내지 않는다.
// - 그래프는 프론트가 실제 기록으로 그린다. Claude 는 글만 쓴다(숫자를 지어낼 일이 없게).
// - 결과는 ride_insights 에 저장해 두고, 기록이 그대로면 다시 부르지 않는다(비용).
// - Claude 연결·오류 처리는 ClaudeClient 가 맡는다(API 키가 없으면 이 기능만 꺼진다).
@Slf4j
@Service
@RequiredArgsConstructor
public class RideInsightService {

    public static final String QUESTION =
            "나의 프로필에서 라이딩통계을 확인후 나의 라이딩 수준을 한줄 요약과 앞으로 어떻게 하면 더욱 라이딩을 발전시킬 수 있나 "
                    + "데이터을 확인하고 그의 맞는 전세계의 국가대표의 자전거 라이딩의 조언해 줍니다.";

    private static final int RECENT_RIDES = 30; // 보내는 최근 기록 수 — 요청 크기(비용)를 일정하게 묶어 둔다
    private static final int MAX_ADVICE = 3;

    private static final String SYSTEM_PROMPT = """
            당신은 자전거 라이딩 앱 PedalLink 의 라이딩 코치입니다. 사용자의 라이딩 기록 숫자를 보고 수준을 판단하고,
            세계 여러 나라 국가대표·프로 사이클 선수들이 쓰는 훈련 방법을 이 사람에게 맞게 줄여서 조언합니다.

            데이터는 사용자 메시지의 <riding_data> 안 JSON 입니다. 거리는 km, 시간은 분, 상승고도는 m 입니다.
            상승고도(ascendM)는 코스를 따라 탄 기록에만 있고, 자유주행이면 null 입니다(오르막이 0 이라는 뜻이 아닙니다).
            withParty 는 다른 사람과 함께(파티·크루) 탄 기록입니다. 모든 숫자는 앱이 계산한 실제 값이니 새로 지어내지 마세요.

            수준은 아래 기준을 참고해 하나를 고르세요. 한 가지 숫자만 보지 말고 횟수·거리·속도·꾸준함·오르막을 함께 봅니다.
            - 입문: 기록이 3회 미만이거나, 1회 평균 10km 미만
            - 초급: 1회 평균 10~25km, 평균 속도 15km/h 안팎
            - 중급: 1회 평균 25~50km, 평균 속도 18~22km/h, 주 1회 이상 꾸준히 탐
            - 상급: 1회 평균 50km 이상이거나 평균 속도 23km/h 이상, km당 상승 10m 이상의 오르막도 소화

            summary 는 이 사람의 수준을 숫자를 하나 이상 넣어 한 문장(60자 안팎)으로 씁니다.
            advice 는 2~3개, 각각 1~2문장입니다. 이 사람의 숫자(횟수, 거리, 속도, 오르막, 꾸준함)에서 가장 발전할 여지가 큰 부분을 골라,
            국가대표·프로 선수들이 실제로 쓰는 훈련 방법(예: 낮은 강도로 오래 타는 지구력 훈련, 인터벌, 케이던스 훈련, 업힐 반복, 회복일)을
            이 사람 수준에 맞는 구체적인 다음 목표로 바꿔서 제안하세요. 기록이 적으면 꾸준히 기록을 쌓는 것부터 권하세요.
            특정 선수의 말이나 기록을 지어내지 말고, 널리 알려진 훈련 원칙으로 설명합니다.
            부상·건강 진단은 하지 말고, 안전 이야기는 필요할 때만 짧게 합니다.

            그래프(라이딩 잔디, 평균 속도 추이, 누적 거리)는 앱이 같은 데이터로 따로 그려 보여줍니다.
            글이나 표로 그래프를 그리지 말고, 필요하면 "잔디 그래프", "속도 그래프"처럼 이름으로만 언급하세요.
            말투는 친근한 존댓말(~해요)로 씁니다.
            """;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    // Claude 가 채워 돌려줄 JSON 의 모양. 아래 OUTPUT_FORMAT 스키마와 같아야 한다.
    // (SDK 의 클래스→스키마 자동 변환은 effort 설정과 같이 쓸 수 없어서 스키마를 직접 적는다)
    public enum RiderLevel { 입문, 초급, 중급, 상급 }

    public record InsightOutput(RiderLevel level, String summary, List<String> advice) {
    }

    private static final JsonOutputFormat OUTPUT_FORMAT = JsonOutputFormat.builder()
            .schema(JsonOutputFormat.Schema.builder()
                    .putAdditionalProperty("type", JsonValue.from("object"))
                    .putAdditionalProperty("properties", JsonValue.from(Map.of(
                            "level", Map.of(
                                    "type", "string",
                                    "enum", List.of("입문", "초급", "중급", "상급"),
                                    "description", "라이딩 수준"),
                            "summary", Map.of(
                                    "type", "string",
                                    "description", "이 사람의 라이딩 수준을 숫자를 넣어 한 문장(60자 안팎)으로 요약"),
                            "advice", Map.of(
                                    "type", "array",
                                    "items", Map.of("type", "string"),
                                    "description", "이 사람 데이터에 맞춘, 국가대표·프로 선수 훈련법 기반의 발전 조언 2~3개, 각각 1~2문장"))))
                    .putAdditionalProperty("required", JsonValue.from(List.of("level", "summary", "advice")))
                    .putAdditionalProperty("additionalProperties", JsonValue.from(false))
                    .build())
            .build();

    private final RideInsightRepository insightRepository;
    private final ClaudeClient claude;

    // 같은 사용자가 버튼을 여러 번 눌러 Claude 를 중복 호출하지 않게
    private final Set<Long> running = ConcurrentHashMap.newKeySet();

    // 저장된 분석 + 그 뒤로 기록이 바뀌었는지 (Claude 는 부르지 않는다)
    public RideInsightResponse get(Long userId, List<RideRecord> records) {
        return response(records, insightRepository.findById(userId).orElse(null));
    }

    // records: 최신순, ascendM 이 채워진 기록 / stats: 프로필 통계와 같은 값
    public RideInsightResponse analyze(Long userId, List<RideRecord> records, Map<String, Object> stats) {
        if (records.isEmpty()) {
            throw new AiException(400, "라이딩 기록이 생기면 분석할 수 있어요.");
        }
        if (!claude.available()) {
            throw new AiException(503, "AI 분석이 아직 설정되지 않았어요.");
        }
        RideInsight saved = insightRepository.findById(userId).orElse(null);
        if (saved != null && !isStale(saved, records)) {
            return response(records, saved); // 기록이 그대로면 저장된 결과를 그대로 준다
        }
        if (!running.add(userId)) {
            throw new AiException(409, "이미 분석하고 있어요. 잠시만 기다려 주세요.");
        }
        try {
            InsightOutput out = ask(buildData(records, stats));

            RideInsight insight = saved != null ? saved : new RideInsight();
            insight.setUserId(userId);
            insight.setLevel(out.level().name());
            insight.setSummary(truncate(out.summary().trim(), 300));
            List<String> advice = out.advice().stream()
                    .map(String::trim).filter(s -> !s.isEmpty()).limit(MAX_ADVICE).toList();
            insight.setAdvice(JSON.writeValueAsString(advice));
            insight.setRideCount(records.size());
            insight.setLastRideId(lastRideId(records));
            insight.setModel(ClaudeClient.MODEL);
            insight.setCreatedAt(LocalDateTime.now());
            insightRepository.save(insight);
            return response(records, insight);
        } finally {
            running.remove(userId);
        }
    }

    private InsightOutput ask(String dataJson) {
        String text = claude.askJson("AI 라이딩 리포트", SYSTEM_PROMPT,
                QUESTION + "\n\n<riding_data>\n" + dataJson + "\n</riding_data>", OUTPUT_FORMAT);
        InsightOutput out;
        try {
            out = JSON.readValue(text, InsightOutput.class);
        } catch (JacksonException e) {
            log.warn("AI 라이딩 리포트 응답 파싱 실패: {}", e.getMessage());
            throw new AiException(502, "AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
        }
        if (out.level() == null || out.summary() == null || out.advice() == null || out.advice().isEmpty()) {
            throw new AiException(502, "AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
        }
        return out;
    }

    // Claude 에 보낼 숫자 — 프로필 통계 + 몇 가지 파생 지표 + 최근 기록 30건
    private String buildData(List<RideRecord> records, Map<String, Object> stats) {
        LocalDate today = LocalDate.now();
        double totalKm = records.stream().mapToDouble(r -> nz(r.getDistanceKm())).sum();
        int totalMin = records.stream().mapToInt(r -> r.getDurationMin() == null ? 0 : r.getDurationMin()).sum();

        Map<String, Object> s = new LinkedHashMap<>();
        s.put("rideCount", records.size());
        s.put("totalDistanceKm", round1(totalKm));
        s.put("totalDurationMin", totalMin);
        s.put("totalAscendM", stats.get("totalAscendM"));
        s.put("ascendPerKm", stats.get("ascendPerKm"));
        s.put("mountainRideCount", stats.get("mountainRideCount"));
        s.put("mountainThresholdM", stats.get("mountainThresholdM"));
        s.put("avgDistanceKm", round1(totalKm / records.size()));
        s.put("avgSpeedKmh", speed(totalKm, totalMin));
        s.put("longestRideKm", round1(records.stream().mapToDouble(r -> nz(r.getDistanceKm())).max().orElse(0)));
        s.put("ridesLast4Weeks", records.stream().filter(r -> !r.getRidedAt().toLocalDate().isBefore(today.minusDays(27))).count());
        s.put("ridingDaysLast12Weeks", records.stream().map(r -> r.getRidedAt().toLocalDate())
                .filter(d -> !d.isBefore(today.minusDays(83))).distinct().count());
        s.put("partyRideCount", records.stream().filter(r -> r.getPartyId() != null).count());
        s.put("firstRideDate", records.get(records.size() - 1).getRidedAt().toLocalDate().toString());
        s.put("lastRideDate", records.get(0).getRidedAt().toLocalDate().toString());

        List<Map<String, Object>> recent = records.stream().limit(RECENT_RIDES).map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", r.getRidedAt().toLocalDate().toString());
            m.put("distanceKm", round1(nz(r.getDistanceKm())));
            m.put("durationMin", r.getDurationMin());
            m.put("speedKmh", speed(nz(r.getDistanceKm()), r.getDurationMin() == null ? 0 : r.getDurationMin()));
            m.put("ascendM", r.getAscendM());
            m.put("withParty", r.getPartyId() != null);
            return m;
        }).toList();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("today", today.toString());
        data.put("stats", s);
        data.put("recentRides", recent);
        return JSON.writeValueAsString(data);
    }

    private RideInsightResponse response(List<RideRecord> records, RideInsight saved) {
        RideInsightResponse.Insight insight = saved == null ? null : new RideInsightResponse.Insight(
                saved.getLevel(),
                saved.getSummary(),
                JSON.readValue(saved.getAdvice(), new TypeReference<List<String>>() {}),
                saved.getModel(),
                saved.getCreatedAt());
        boolean stale = saved != null && isStale(saved, records);
        return new RideInsightResponse(claude.available(), records.size(), stale, insight);
    }

    // 분석한 뒤로 기록이 추가·삭제됐는지
    private static boolean isStale(RideInsight saved, List<RideRecord> records) {
        Long last = lastRideId(records);
        return saved.getRideCount() != records.size()
                || (last == null ? saved.getLastRideId() != null : !last.equals(saved.getLastRideId()));
    }

    private static Long lastRideId(List<RideRecord> records) {
        return records.stream().map(RideRecord::getId).max(Long::compare).orElse(null);
    }

    private static Double speed(double km, int min) {
        return min > 0 ? round1(km / (min / 60.0)) : null;
    }

    private static double nz(Double v) {
        return v == null ? 0 : v;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
