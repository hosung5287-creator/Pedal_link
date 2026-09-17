package com.example.demo.controller;

import com.example.demo.dto.RideRecordRequest;
import com.example.demo.entity.RideRecord;
import com.example.demo.repository.RideRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ride-records")
@RequiredArgsConstructor
public class RideRecordController {

    private final RideRecordRepository rideRecordRepository;

    // 이 상승고도(m) 이상이면 "산악 코스"로 친다. 나중에 조정하고 싶으면 이 값만 바꾸면 된다.
    private static final int MOUNTAIN_ASCEND_M = 300;

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
        record.setRouteId(req.getRouteId());
        record.setRouteName(req.getRouteName());
        record.setAscendM(req.getAscendM());
        if (req.getRidedAt() != null) record.setRidedAt(req.getRidedAt());

        RideRecord saved = rideRecordRepository.save(record);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "주행 기록 저장 완료"));
    }

    // 내 주행 기록 목록 (최신순) — 라이딩 기록 리스트 화면이 그대로 쓴다
    @GetMapping
    public List<RideRecord> list(@RequestParam Long userId) {
        return rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
    }

    // 프로필에 보여줄 누적 통계·성취감 지표 — 기록이 많지 않은 서비스 규모라 그냥 합산한다
    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam Long userId) {
        List<RideRecord> records = rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
        double totalDistanceKm = records.stream().mapToDouble(RideRecord::getDistanceKm).sum();
        int totalDurationMin = records.stream().mapToInt(RideRecord::getDurationMin).sum();
        int totalAscendM = records.stream().filter(r -> r.getAscendM() != null).mapToInt(RideRecord::getAscendM).sum();
        long mountainRideCount = records.stream()
                .filter(r -> r.getAscendM() != null && r.getAscendM() >= MOUNTAIN_ASCEND_M)
                .count();

        Map<String, Object> result = new HashMap<>();
        result.put("rideCount", records.size());
        result.put("totalDistanceKm", totalDistanceKm);
        result.put("totalDurationMin", totalDurationMin);
        result.put("totalAscendM", totalAscendM);
        result.put("mountainRideCount", mountainRideCount);
        result.put("mountainThresholdM", MOUNTAIN_ASCEND_M);
        return result;
    }
}
