package com.example.demo.controller;

import com.example.demo.dto.CrewRequest;
import com.example.demo.dto.CrewResponse;
import com.example.demo.service.CrewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api/crews")
@RequiredArgsConstructor
public class CrewController {

    private final CrewService crewService;

    @GetMapping
    public List<CrewResponse> getCrews() {
        return crewService.getCrews();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getCrew(@PathVariable Long id) {
        return handle(() -> crewService.getCrew(id));
    }

    @PostMapping
    public ResponseEntity<?> createCrew(@RequestBody CrewRequest req) {
        return handle(() -> crewService.createCrew(req));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<?> join(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        return handle(() -> crewService.join(id, body.get("userId")));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<?> leave(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        return handle(() -> crewService.leave(id, body.get("userId")));
    }

    @PostMapping("/{id}/requests/{userId}/approve")
    public ResponseEntity<?> approve(@PathVariable Long id, @PathVariable Long userId) {
        return handle(() -> crewService.approve(id, userId));
    }

    @PostMapping("/{id}/requests/{userId}/reject")
    public ResponseEntity<?> reject(@PathVariable Long id, @PathVariable Long userId) {
        return handle(() -> crewService.reject(id, userId));
    }

    private ResponseEntity<?> handle(Supplier<CrewResponse> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
