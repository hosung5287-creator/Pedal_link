package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

// 피드 사이드바 (GET /api/feed/summary) — 피드를 20개씩 나눠 받으므로 순위는 서버가 전체 게시물로 계산한다
@Data
@AllArgsConstructor
public class FeedSummaryResponse {

    @Data
    @AllArgsConstructor
    public static class RegionStat {
        private String name;   // 출발지 앞 두 단어 ("서울 마포구")
        private long posts;    // 게시물 수
        private long riders;   // 올린 사람 수
    }

    private List<FeedResponse> topRoutes;   // 인기 코스 (좋아요 많은 순)
    private List<RegionStat> topRegions;    // 활발한 지역 (게시물 많은 순)
}
