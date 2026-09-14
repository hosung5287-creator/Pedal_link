package com.example.demo.controller;

import com.example.demo.dto.RideRecordRequest;
import com.example.demo.entity.RideRecord;
import com.example.demo.repository.RideRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ride-records")
@RequiredArgsConstructor
public class RideRecordController {

    private final RideRecordRepository rideRecordRepository;

    // 라이딩 종료 시 기록 저장
    @PostMapping
    public ResponseEntity<?> save(@RequestBody RideRecordRequest req) {
        if (req.getUserId() == null || req.getDistance() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "userId, distance는 필수입니다"));
        }

        RideRecord record = new RideRecord();
        record.setUserId(req.getUserId());
        record.setDistanceKm(req.getDistance());
        record.setDurationMin(req.getDuration() != null ? req.getDuration() : 0);
        record.setPartyId(req.getPartyId());

        RideRecord saved = rideRecordRepository.save(record);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "주행 기록 저장 완료"));
    }

    // 내 주행 기록 목록 (최신순)
    @GetMapping
    public List<RideRecord> list(@RequestParam Long userId) {
        return rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
    }

    // 프로필에 보여줄 누적 통계 — 기록이 많지 않은 서비스 규모라 그냥 합산한다
    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam Long userId) {
        List<RideRecord> records = rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
        double totalDistanceKm = records.stream().mapToDouble(RideRecord::getDistanceKm).sum();
        int totalDurationMin = records.stream().mapToInt(RideRecord::getDurationMin).sum();
        return Map.of(
                "rideCount", records.size(),
                "totalDistanceKm", totalDistanceKm,
                "totalDurationMin", totalDurationMin
        );
    }
}
