package com.example.demo.service;

import com.example.demo.dto.RideTipResponse;
import com.example.demo.entity.RideRecord;
import com.example.demo.entity.RideTip;
import com.example.demo.repository.RideTipRepository;
import com.example.demo.service.GeminiClient.AiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// 프로필 라이딩 통계 카드의 "한마디 조언".
// 횟수·거리·시간·상승고도·산악 완주가 지난번 조언 때와 달라지면, 프로필을 열 때 Gemini 가 그 변화에 맞는 조언을 새로 한 문장 쓴다.
// - 통계가 그대로면 저장된 조언을 그대로 보여주고 AI 를 부르지 않는다(비용).
// - 매번 다른 말이 나오게 최근 조언 5개를 같이 보내 겹치지 않게 한다.
// - 조언이 없거나 API 키가 없으면 화면에 아무것도 보여주지 않는다.
@Slf4j
@Service
@RequiredArgsConstructor
public class RideTipService {

    public static final String QUESTION = "내 라이딩 통계가 지난번보다 어떻게 늘었는지 확인하고, 지금 나에게 맞는 조언을 한마디로 해줘.";

    private static final int KEEP_TIPS = 5;

    private static final String SYSTEM_PROMPT = """
            당신은 자전거 라이딩 앱 PedalLink 의 라이딩 코치입니다. 사용자의 라이딩 통계가 지난번 조언 뒤로 어떻게 바뀌었는지 보고,
            그 변화에 맞는 조언을 한 문장으로 건넵니다.

            데이터는 사용자 메시지의 <riding_stats> 안 JSON 입니다. current 는 지금 통계, previous 는 지난번 조언을 만들 때의 통계,
            change 는 그 차이입니다. previous 가 null 이면 첫 조언입니다. 거리는 km, 시간은 분, 상승고도는 m 입니다.
            lastRide 는 가장 최근 라이딩 한 건입니다.

            - tip 은 한 문장, 60자 안팎, 친근한 존댓말(~해요)로 씁니다.
            - change 에서 늘어난 것(횟수, 거리, 시간, 상승고도, 산악 완주) 중 하나 이상을 자연스럽게 짚고,
              그 흐름에서 다음에 해 볼 구체적인 행동 하나를 권하세요.
            - 첫 조언이거나 늘어난 것이 없으면 지금 통계 전체를 보고 조언하세요.
            - previousTips 의 조언과 같은 내용이나 같은 표현을 되풀이하지 말고,
              매번 다른 관점(꾸준함, 거리, 속도, 오르막, 회복, 함께 타기 등)으로 말합니다.
            - 숫자는 데이터에 있는 것만 쓰고 지어내지 마세요. 부상·건강 진단은 하지 않습니다.
            """;

    // Gemini 가 채워 돌려줄 JSON 의 모양 (Gemini responseSchema 형식)
    private static final Map<String, Object> OUTPUT_SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "tip", Map.of(
                            "type", "STRING",
                            "description", "통계 변화에 맞춘 조언 한 문장(60자 안팎)")),
            "required", List.of("tip"));

    private static final JsonMapper JSON = JsonMapper.builder().build();

    // 조언을 만들 때 기준으로 삼는 통계. 이 값이 하나라도 바뀌면 새 조언을 만든다.
    public record Snapshot(int rideCount, double totalDistanceKm, int totalDurationMin, int totalAscendM, long mountainRideCount) {
    }

    record TipOutput(String tip) {
    }

    private final RideTipRepository tipRepository;
    private final GeminiClient gemini;

    // 같은 사용자가 탭 두 개로 열어도 AI 를 한 번만 부르게
    private final Set<Long> running = ConcurrentHashMap.newKeySet();

    // 저장된 조언 + 새로 만들 차례인지 (AI 는 부르지 않는다). stats: 프로필 통계와 같은 값
    public RideTipResponse get(Long userId, Map<String, Object> stats) {
        RideTip saved = tipRepository.findById(userId).orElse(null);
        return response(saved, isStale(saved, snapshotOf(stats)));
    }

    // 통계가 바뀌었으면 Gemini 에 새 조언을 받아 저장한다. 그대로면 저장된 조언을 준다.
    public RideTipResponse refresh(Long userId, List<RideRecord> records, Map<String, Object> stats) {
        Snapshot current = snapshotOf(stats);
        if (current.rideCount() == 0) {
            throw new AiException(400, "라이딩 기록이 생기면 조언을 드릴게요.");
        }
        if (!gemini.available()) {
            throw new AiException(503, "AI 기능이 아직 설정되지 않았어요.");
        }
        RideTip saved = tipRepository.findById(userId).orElse(null);
        if (!isStale(saved, current)) {
            return response(saved, false);
        }
        if (!running.add(userId)) {
            throw new AiException(409, "새 조언을 만들고 있어요. 잠시만 기다려 주세요.");
        }
        try {
            Snapshot previous = saved == null ? null : JSON.readValue(saved.getStats(), Snapshot.class);
            List<String> previousTips = saved == null ? List.of()
                    : JSON.readValue(saved.getRecentTips(), new TypeReference<List<String>>() {});

            String tip = ask(buildData(current, previous, previousTips, records));

            List<String> recent = new ArrayList<>();
            recent.add(tip);
            previousTips.stream().filter(t -> !t.equals(tip)).limit(KEEP_TIPS - 1).forEach(recent::add);

            RideTip row = saved != null ? saved : new RideTip();
            row.setUserId(userId);
            row.setTip(tip);
            row.setStats(JSON.writeValueAsString(current));
            row.setRecentTips(JSON.writeValueAsString(recent));
            row.setModel(gemini.model());
            row.setCreatedAt(LocalDateTime.now());
            tipRepository.save(row);
            return response(row, false);
        } finally {
            running.remove(userId);
        }
    }

    private String ask(String dataJson) {
        String text = gemini.askJson("한마디 조언", SYSTEM_PROMPT,
                QUESTION + "\n\n<riding_stats>\n" + dataJson + "\n</riding_stats>", OUTPUT_SCHEMA);
        try {
            TipOutput out = JSON.readValue(text, TipOutput.class);
            if (out.tip() == null || out.tip().isBlank()) throw new AiException(502, "AI 응답을 읽지 못했어요.");
            String tip = out.tip().trim();
            return tip.length() <= 300 ? tip : tip.substring(0, 300);
        } catch (JacksonException e) {
            log.warn("한마디 조언 응답 파싱 실패: {}", e.getMessage());
            throw new AiException(502, "AI 응답을 읽지 못했어요.");
        }
    }

    // Gemini 에 보낼 숫자 — 지금 통계, 지난번 통계, 그 차이, 가장 최근 라이딩, 최근 조언
    private String buildData(Snapshot current, Snapshot previous, List<String> previousTips, List<RideRecord> records) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("today", LocalDate.now().toString());
        data.put("current", current);
        data.put("previous", previous);
        if (previous != null) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("rideCount", current.rideCount() - previous.rideCount());
            change.put("totalDistanceKm", round1(current.totalDistanceKm() - previous.totalDistanceKm()));
            change.put("totalDurationMin", current.totalDurationMin() - previous.totalDurationMin());
            change.put("totalAscendM", current.totalAscendM() - previous.totalAscendM());
            change.put("mountainRideCount", current.mountainRideCount() - previous.mountainRideCount());
            data.put("change", change);
        } else {
            data.put("change", null);
        }
        if (!records.isEmpty()) { // 최신순
            RideRecord last = records.get(0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", last.getRidedAt().toLocalDate().toString());
            m.put("distanceKm", last.getDistanceKm() == null ? null : round1(last.getDistanceKm()));
            m.put("durationMin", last.getDurationMin());
            m.put("ascendM", last.getAscendM());
            m.put("withParty", last.getPartyId() != null);
            data.put("lastRide", m);
        }
        data.put("previousTips", previousTips);
        return JSON.writeValueAsString(data);
    }

    private RideTipResponse response(RideTip saved, boolean stale) {
        return new RideTipResponse(gemini.available(), stale,
                saved == null ? null : saved.getTip(),
                saved == null ? null : saved.getCreatedAt());
    }

    // 기록이 있고, 조언이 아직 없거나 그때와 통계가 달라졌으면 새로 만들 차례
    private static boolean isStale(RideTip saved, Snapshot current) {
        if (current.rideCount() == 0) return false;
        if (saved == null) return true;
        try {
            return !current.equals(JSON.readValue(saved.getStats(), Snapshot.class));
        } catch (JacksonException e) {
            return true;
        }
    }

    private static Snapshot snapshotOf(Map<String, Object> stats) {
        return new Snapshot(
                num(stats.get("rideCount")).intValue(),
                round1(num(stats.get("totalDistanceKm")).doubleValue()),
                num(stats.get("totalDurationMin")).intValue(),
                num(stats.get("totalAscendM")).intValue(),
                num(stats.get("mountainRideCount")).longValue());
    }

    private static Number num(Object v) {
        return v instanceof Number n ? n : 0;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
