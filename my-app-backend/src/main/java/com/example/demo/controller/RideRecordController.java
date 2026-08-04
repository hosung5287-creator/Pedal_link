package com.example.demo.controller;

import com.example.demo.dto.RideRecordDto;
import com.example.demo.entity.RideRecord;
import com.example.demo.entity.User;
import com.example.demo.repository.RideRecordRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ride-records")
@RequiredArgsConstructor
public class RideRecordController {

    private final RideRecordRepository rideRecordRepository;
    private final UserRepository userRepository;

    // 주행 기록 저장 API
    @PostMapping
    public ResponseEntity<?> saveRecord(@RequestBody RideRecordDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다."));

        RideRecord record = new RideRecord();
        record.setUser(user);
        record.setStartPoint(dto.getStartPoint());
        record.setEndPoint(dto.getEndPoint());
        // 변경된 컬럼 필드 적용
        record.setRouteDistance(dto.getDistance() != null ? dto.getDistance().intValue() : 0);
        record.setTime(dto.getDuration());

        RideRecord saved = rideRecordRepository.save(record);
        return ResponseEntity.ok(saved.getId());
    }

    // 유저별 주행 기록 조회 API
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<RideRecord>> getUserRecords(@PathVariable Long userId) {
        List<RideRecord> records = rideRecordRepository.findByUserId(userId);
        return ResponseEntity.ok(records);
    }
}