package com.example.demo.controller;

import com.example.demo.dto.FeedPageResponse;
import com.example.demo.dto.FeedResponse;
import com.example.demo.dto.FeedSummaryResponse;
import com.example.demo.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feedService;

    // 둘러보기 피드 전체 (userId 는 선택 — 없으면 좋아요 여부만 전부 false)
    // 게시물이 많으면 무거우므로 화면은 아래 /feed/page 를 쓴다
    @GetMapping("/feed")
    public List<FeedResponse> getFeed(@RequestParam(required = false) Long userId) {
        return feedService.getFeed(userId);
    }

    // 피드 한 페이지 — 최신순 size 개씩, region(구 이름)으로 거를 수 있다
    @GetMapping("/feed/page")
    public FeedPageResponse getFeedPage(@RequestParam(required = false) Long userId,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size,
                                        @RequestParam(required = false) String region) {
        return feedService.getFeedPage(userId, page, size, region);
    }

    // 피드 사이드바 — 인기 코스·활발한 지역 순위 (전체 게시물 기준)
    @GetMapping("/feed/summary")
    public FeedSummaryResponse getFeedSummary(@RequestParam(required = false) Long userId) {
        return feedService.getSummary(userId);
    }

    // 게시물 올리기 — 저장된 내 경로에 문구·해시태그를 붙인다
    @PostMapping("/routes/{routeId}/post")
    public ResponseEntity<?> publish(@PathVariable Long routeId,
                                     @RequestBody Map<String, String> body) {
        String rawUserId = body.get("userId");
        if (rawUserId == null || rawUserId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        try {
            return ResponseEntity.ok(feedService.publish(
                    routeId, Long.valueOf(rawUserId), body.get("description"), body.get("tags"), body.get("region")));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 북마크(저장) 토글 — 다른 사람의 코스를 내 저장 목록에 담거나 뺀다 → { bookmarked }
    @PostMapping("/routes/{routeId}/bookmark")
    public ResponseEntity<?> toggleBookmark(@PathVariable Long routeId,
                                            @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        try {
            return ResponseEntity.ok(feedService.toggleBookmark(routeId, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 좋아요 토글
    @PostMapping("/routes/{routeId}/like")
    public ResponseEntity<?> toggleLike(@PathVariable Long routeId,
                                        @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        return ResponseEntity.ok(feedService.toggleLike(routeId, userId));
    }
}
