package com.example.demo.controller;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LocationController {

    private final Map<Long, LiveLocation> locations = new ConcurrentHashMap<>();
    private static final long STALE_MS = 15_000;

    public record LiveLocation(Long userId, String name, double lat, double lng, long updatedAt) {}
    public record LocationReport(Long userId, String name, Double lat, Double lng) {}

    @PostMapping("/locations")
    public ResponseEntity<?> report(@RequestBody LocationReport req) {
        if (req.userId() == null || req.lat() == null || req.lng() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "userId, lat, lng는 필수입니다"));
        }
        String name = (req.name() == null || req.name().isBlank()) ? "익명" : req.name();
        locations.put(req.userId(),
                new LiveLocation(req.userId(), name, req.lat(), req.lng(), System.currentTimeMillis()));
        return ResponseEntity.ok(Map.of("message", "ok"));
    }

    @GetMapping("/locations")
    public ResponseEntity<List<LiveLocation>> others(@RequestParam Long userId) {
        long now = System.currentTimeMillis();
        locations.values().removeIf(l -> now - l.updatedAt() > STALE_MS);
        List<LiveLocation> result = locations.values().stream()
                .filter(l -> !l.userId().equals(userId))
                .toList();
        return ResponseEntity.ok(result);
    }
}
