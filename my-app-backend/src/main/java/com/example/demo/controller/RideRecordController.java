package com.example.demo.controller;

import com.example.demo.dto.RideRecordRequest;
import com.example.demo.entity.RideRecord;
import com.example.demo.entity.Route;
import com.example.demo.repository.RideRecordRepository;
import com.example.demo.repository.RouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ride-records")
@RequiredArgsConstructor
public class RideRecordController {

    private final RideRecordRepository rideRecordRepository;
    private final RouteRepository routeRepository;

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
        if (req.getRidedAt() != null) record.setRidedAt(req.getRidedAt());

        RideRecord saved = rideRecordRepository.save(record);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "message", "주행 기록 저장 완료"));
    }

    // routes.ascend_m 을 조인해서 각 기록의 ascendM(전이 필드) = "이번 라이딩에서 인정된 상승고도"를 채운다.
    // 코스가 지워졌거나, 자유주행(routeId 없음)이거나, 코스의 상승고도를 모르면 null로 남는다.
    private void fillAscendM(List<RideRecord> records) {
        List<Long> routeIds = records.stream()
                .map(RideRecord::getRouteId)
                .filter(id -> id != null)
                .distinct()
                .collect(Collectors.toList());
        if (routeIds.isEmpty()) return;

        // 값(ascendM)이 아니라 Route 를 담는다 — toMap 은 값이 null 이면 NPE 를 내서,
        // 상승고도 기능 이전에 저장된 코스(ascend_m = null)를 탄 사용자는 목록·통계가 500 이 났다.
        Map<Long, Route> routeById = routeRepository.findAllById(routeIds).stream()
                .collect(Collectors.toMap(Route::getId, route -> route));
        records.forEach(r -> {
            Route route = r.getRouteId() != null ? routeById.get(r.getRouteId()) : null;
            r.setAscendM(route == null ? null : creditedAscendM(route, r.getDistanceKm()));
        });
    }

    // 코스를 끝까지 안 타도 코스 전체 상승고도를 주면 과장되므로, 탄 거리 비율만큼만 인정한다(최대 100%).
    // 상승고도는 코스를 만들 때 BRouter 가 지형 고도로 계산한 예상값이다(GPS 로 잰 값이 아님).
    // 코스 거리를 모르면 비율을 낼 수 없어 코스 값을 그대로 쓴다.
    private static Integer creditedAscendM(Route route, Double rideDistanceKm) {
        Integer routeAscendM = route.getAscendM();
        if (routeAscendM == null) return null;
        Double routeDistanceKm = route.getDistanceKm();
        if (routeDistanceKm == null || routeDistanceKm <= 0 || rideDistanceKm == null) return routeAscendM;
        double ratio = Math.min(1.0, rideDistanceKm / routeDistanceKm);
        return (int) Math.round(routeAscendM * ratio);
    }

    // 내 주행 기록 목록 (최신순) — 라이딩 기록 리스트 화면이 그대로 쓴다
    @GetMapping
    public List<RideRecord> list(@RequestParam Long userId) {
        List<RideRecord> records = rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
        fillAscendM(records);
        return records;
    }

    // 프로필에 보여줄 누적 통계·성취감 지표 — 기록이 많지 않은 서비스 규모라 그냥 합산한다
    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam Long userId) {
        List<RideRecord> records = rideRecordRepository.findByUserIdOrderByRidedAtDesc(userId);
        fillAscendM(records);
        double totalDistanceKm = records.stream().mapToDouble(RideRecord::getDistanceKm).sum();
        int totalDurationMin = records.stream().mapToInt(RideRecord::getDurationMin).sum();
        int totalAscendM = records.stream().filter(r -> r.getAscendM() != null).mapToInt(RideRecord::getAscendM).sum();
        long mountainRideCount = records.stream()
                .filter(r -> r.getAscendM() != null && r.getAscendM() >= MOUNTAIN_ASCEND_M)
                .count();

        // km당 상승고도(m/km) — 얼마나 가파른 길을 타는지. 상승고도를 아는 기록(코스 라이딩)만 대상이다.
        // 자유주행은 오르막이 0이 아니라 "모름"이라 분모에 넣으면 평균이 부당하게 낮아진다.
        double ascendKnownKm = records.stream()
                .filter(r -> r.getAscendM() != null)
                .mapToDouble(RideRecord::getDistanceKm)
                .sum();
        Double ascendPerKm = ascendKnownKm > 0 ? Math.round(totalAscendM / ascendKnownKm * 10) / 10.0 : null;

        Map<String, Object> result = new HashMap<>();
        result.put("rideCount", records.size());
        result.put("totalDistanceKm", totalDistanceKm);
        result.put("totalDurationMin", totalDurationMin);
        result.put("totalAscendM", totalAscendM);
        result.put("mountainRideCount", mountainRideCount);
        result.put("mountainThresholdM", MOUNTAIN_ASCEND_M);
        result.put("ascendPerKm", ascendPerKm); // 코스 라이딩 기록이 없으면 null
        return result;
    }
}
