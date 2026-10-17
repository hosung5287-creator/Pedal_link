package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

// 프로필 "한마디 조언" — 사용자당 1건 (DB/migrations/010_ride_tips.sql).
// 통계가 stats(JSON) 와 달라지면 프로필을 열 때 새 조언을 만든다.
@Entity
@Table(name = "ride_tips")
@Getter
@Setter
public class RideTip {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 300)
    private String tip;

    // 조언을 만들 때의 통계 {rideCount, totalDistanceKm, totalDurationMin, totalAscendM, mountainRideCount}
    @Column(nullable = false, columnDefinition = "text")
    private String stats;

    // 최근 조언 (최신순, 최대 5개) — JSON 문자열 배열
    @Column(nullable = false, columnDefinition = "text")
    private String recentTips;

    @Column(nullable = false, length = 60)
    private String model;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
