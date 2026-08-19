package com.example.demo.controller;

import com.example.demo.dto.FeedResponse;
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

    // 둘러보기 피드 (userId 는 선택 — 없으면 좋아요 여부만 전부 false)
    @GetMapping("/feed")
    public List<FeedResponse> getFeed(@RequestParam(required = false) Long userId) {
        return feedService.getFeed(userId);
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
                    routeId, Long.valueOf(rawUserId), body.get("description"), body.get("tags")));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
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
