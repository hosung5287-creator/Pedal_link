package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "ride_records")
@Data
public class RideRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    // 주행 거리 (km)
    private Double distanceKm;

    // 소요 시간 (분)
    private Integer durationMin;

    // 파티 라이딩이면 그 파티 id. 혼자 탄 기록이면 null.
    // 거리·시간은 각자 기기의 GPS 로 측정한 본인 값이다 (서버가 남의 거리를 알 수 없으므로).
    private Long partyId;

    private LocalDateTime ridedAt = LocalDateTime.now();
}
