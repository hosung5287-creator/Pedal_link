package com.example.demo.controller;

import com.example.demo.dto.CrewRideRequest;
import com.example.demo.dto.CrewRideResponse;
import com.example.demo.service.CrewRideService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.function.Supplier;

// 크루 라이딩 ("이번주 라이딩 열기") — 흐름은 CrewRideService 주석 참고
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CrewRideController {

    private final CrewRideService crewRideService;

    // 팀장이 연다
    @PostMapping("/crews/{crewId}/rides")
    public ResponseEntity<?> open(@PathVariable Long crewId, @RequestBody CrewRideRequest req) {
        return handle(() -> crewRideService.open(crewId, req));
    }

    // 크루의 진행 중인 라이딩 (없으면 204)
    @GetMapping("/crews/{crewId}/rides/active")
    public ResponseEntity<?> active(@PathVariable Long crewId, @RequestParam(required = false) Long userId) {
        return crewRideService.getActive(crewId, userId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    // 라이딩 1건 — 채팅 초대 카드가 쓴다
    @GetMapping("/crew-rides/{eventId}")
    public ResponseEntity<?> get(@PathVariable Long eventId, @RequestParam(required = false) Long userId) {
        return handle(() -> crewRideService.get(eventId, userId));
    }

    // 내가 체크되어 지금 라이딩 중인 크루 라이딩 { eventId, partyId } (없으면 204) — 라이딩 화면 자동 이동용
    @GetMapping("/crew-rides/my-riding")
    public ResponseEntity<?> myRiding(@RequestParam Long userId) {
        return crewRideService.findMyRiding(userId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    // 초대받은 멤버의 참여/불참 { userId, accept }
    @PostMapping("/crew-rides/{eventId}/respond")
    public ResponseEntity<?> respond(@PathVariable Long eventId, @RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") == null ? null : ((Number) body.get("userId")).longValue();
        boolean accept = Boolean.TRUE.equals(body.get("accept"));
        return handle(() -> crewRideService.respond(eventId, userId, accept));
    }

    // 팀장: 인원 체크 시작 { userId }
    @PostMapping("/crew-rides/{eventId}/start-check")
    public ResponseEntity<?> startCheck(@PathVariable Long eventId, @RequestBody Map<String, Long> body) {
        return handle(() -> crewRideService.startCheck(eventId, body.get("userId")));
    }

    // 팀장: 인원 체크 { userId(팀장), targetUserId(없으면 일괄) }
    @PostMapping("/crew-rides/{eventId}/check")
    public ResponseEntity<?> check(@PathVariable Long eventId, @RequestBody Map<String, Long> body) {
        return handle(() -> crewRideService.check(eventId, body.get("userId"), body.get("targetUserId")));
    }

    // 팀장: 라이딩 시작 { userId }
    @PostMapping("/crew-rides/{eventId}/start")
    public ResponseEntity<?> start(@PathVariable Long eventId, @RequestBody Map<String, Long> body) {
        return handle(() -> crewRideService.start(eventId, body.get("userId")));
    }

    // 팀장: 취소 { userId }
    @PostMapping("/crew-rides/{eventId}/cancel")
    public ResponseEntity<?> cancel(@PathVariable Long eventId, @RequestBody Map<String, Long> body) {
        return handle(() -> crewRideService.cancel(eventId, body.get("userId")));
    }

    private ResponseEntity<?> handle(Supplier<CrewRideResponse> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
