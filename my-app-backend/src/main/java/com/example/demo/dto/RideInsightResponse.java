package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

// 프로필 AI 라이딩 리포트 응답.
// available: 서버에 Gemini API 키가 있는지 / stale: 저장된 분석 뒤로 라이딩 기록이 바뀌었는지
@Data
@AllArgsConstructor
public class RideInsightResponse {

    @Data
    @AllArgsConstructor
    public static class Insight {
        private String level;
        private String summary;
        private List<String> advice;
        private String model;
        private LocalDateTime createdAt;
    }

    private boolean available;
    private int rideCount;
    private boolean stale;
    private Insight insight; // 아직 분석한 적 없으면 null
}
