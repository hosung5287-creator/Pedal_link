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

    private LocalDateTime ridedAt = LocalDateTime.now();
}
