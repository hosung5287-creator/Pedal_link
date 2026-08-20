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

        RideRecord saved = rideRecordRepository.save(record);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "주행 기록 저장 완료"));
    }

    // 내 주행 기록 목록 (최신순)
    @GetMapping
    public List<RideRecord> list(@RequestParam Long userId) {
        return rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
    }
}
