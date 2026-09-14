package com.example.demo.controller;

import com.example.demo.dto.MatchRequestResponse;
import com.example.demo.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @PostMapping
    public ResponseEntity<?> send(@RequestBody Map<String, Long> body) {
        try {
            return ResponseEntity.ok(MatchRequestResponse.from(matchService.send(body.get("fromUserId"), body.get("toUserId"))));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    // 내가 받은 대기중 신청
    @GetMapping("/incoming")
    public List<MatchRequestResponse> incoming(@RequestParam Long userId) {
        return matchService.listIncoming(userId).stream().map(MatchRequestResponse::from).toList();
    }

    // 내가 보낸 대기중 신청 (도크에 "신청 중…" 표시용)
    @GetMapping("/outgoing")
    public List<MatchRequestResponse> outgoing(@RequestParam Long userId) {
        return matchService.listOutgoing(userId).stream().map(MatchRequestResponse::from).toList();
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> accept(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        try {
            return ResponseEntity.ok(matchService.accept(id, body.get("userId")));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        try {
            matchService.reject(id, body.get("userId"));
            return ResponseEntity.ok(Map.of("message", "거절했습니다"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
