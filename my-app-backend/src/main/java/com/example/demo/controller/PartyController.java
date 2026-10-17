package com.example.demo.controller;

import com.example.demo.dto.PartyRequest;
import com.example.demo.dto.PartyResponse;
import com.example.demo.service.PartyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parties")
@RequiredArgsConstructor
public class PartyController {

    private final PartyService partyService;

    // userId(보는 사람) 기준 목록 — 내 파티 + 호스트와 가까운(PartyService.PARTY_RANGE_M) 모집 중 파티
    @GetMapping
    public List<PartyResponse> getParties(@RequestParam(required = false) Long userId) {
        return partyService.getParties(userId);
    }

    // 파티 1건 — 지도에서 라이딩할 때 코스/멤버를 다시 읽기 위해 필요
    @GetMapping("/{id}")
    public ResponseEntity<PartyResponse> getParty(@PathVariable Long id) {
        return partyService.getParty(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<PartyResponse> createParty(@RequestBody PartyRequest req) {
        return ResponseEntity.ok(partyService.createParty(req));
    }

    @PostMapping("/{id}/apply")
    public ResponseEntity<?> apply(@PathVariable Long id,
                                   @RequestBody Map<String, Long> body) {
        return handle(() -> partyService.apply(id, body.get("userId")));
    }

    // 파티 삭제 (호스트 전용)
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @RequestParam Long userId) {
        try {
            partyService.delete(id, userId);
            return ResponseEntity.ok(Map.of("message", "삭제되었습니다"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 라이딩 시작 알림 (호스트 전용) — 참가자가 이 시각을 보고 자동 출발
    @PostMapping("/{id}/start-ride")
    public ResponseEntity<?> startRide(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        try {
            return ResponseEntity.ok(partyService.startRide(id, userId));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    // 라이딩만 종료 (파티는 유지, 호스트 전용)
    @PostMapping("/{id}/stop-ride")
    public ResponseEntity<?> stopRide(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        try {
            return ResponseEntity.ok(partyService.stopRide(id, userId));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    // 라이딩 종료 → 파티 종료 (호스트 전용)
    @PostMapping("/{id}/end")
    public ResponseEntity<?> end(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        Long userId = body.get("userId");
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        try {
            return ResponseEntity.ok(partyService.end(id, userId));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        }
    }

    // 참가자 스스로 준비 상태 표시 (대기방 화면)
    @PostMapping("/{id}/ready")
    public ResponseEntity<?> setReady(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long userId = ((Number) body.get("userId")).longValue();
        boolean ready = Boolean.TRUE.equals(body.get("ready"));
        return handle(() -> partyService.setReady(id, userId, ready));
    }

    // 참가자 스스로 파티 나가기 (호스트 제외)
    @PostMapping("/{id}/leave")
    public ResponseEntity<?> leave(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        return handle(() -> partyService.leave(id, body.get("userId")));
    }

    // 참가 요청 수락·거절 — body { userId } 는 처리하는 사람(방장)
    @PostMapping("/{id}/requests/{userId}/approve")
    public ResponseEntity<?> approve(@PathVariable Long id, @PathVariable Long userId,
                                     @RequestBody(required = false) Map<String, Long> body) {
        return handle(() -> partyService.approve(id, userId, body == null ? null : body.get("userId")));
    }

    @PostMapping("/{id}/requests/{userId}/reject")
    public ResponseEntity<?> reject(@PathVariable Long id, @PathVariable Long userId,
                                    @RequestBody(required = false) Map<String, Long> body) {
        return handle(() -> partyService.reject(id, userId, body == null ? null : body.get("userId")));
    }

    // 팀원 내보내기(강퇴) — body { userId } 는 방장. 내보내진 사람은 같은 파티에 다시 신청할 수 없다.
    @PostMapping("/{id}/members/{memberId}/kick")
    public ResponseEntity<?> kick(@PathVariable Long id, @PathVariable Long memberId,
                                  @RequestBody(required = false) Map<String, Long> body) {
        return handle(() -> partyService.kick(id, memberId, body == null ? null : body.get("userId")));
    }

    // 파티 코스 바꾸기 — body { userId(방장), routeId(방장이 만든 코스) }. 라이딩 시작 전에만.
    @PutMapping("/{id}/route")
    public ResponseEntity<?> changeRoute(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        if (body.get("routeId") == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "바꿀 코스를 골라 주세요"));
        }
        return handle(() -> partyService.changeRoute(id, body.get("routeId"), body.get("userId")));
    }

    /**
     * "이미 신청했습니다", "정원이 초과되었습니다" 같은 것은 사용자 실수이지 서버 오류가 아니다.
     * 그대로 두면 Spring 이 500 + 메시지 없는 응답을 보내 프론트가 이유를 보여줄 수 없다.
     * 방장 권한이 없는 요청(SecurityException)은 403 으로 구분한다.
     */
    private ResponseEntity<?> handle(java.util.function.Supplier<PartyResponse> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
