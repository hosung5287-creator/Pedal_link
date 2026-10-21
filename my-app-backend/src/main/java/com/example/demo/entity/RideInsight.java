package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

// 프로필 AI 라이딩 리포트 — 사용자당 1건 (DB/migrations/009_ride_insights.sql).
// 라이딩 기록이 그대로면(rideCount · lastRideId 가 같으면) 이 결과를 다시 보여주고 AI 를 또 부르지 않는다.
@Entity
@Table(name = "ride_insights")
@Getter
@Setter
public class RideInsight {

    @Id
    @Column(name = "user_id")
    private Long userId;

    // 입문 | 초급 | 중급 | 상급
    @Column(nullable = false, length = 20)
    private String level;

    @Column(nullable = false, length = 300)
    private String summary;

    // 조언 목록 — JSON 문자열 배열로 저장한다
    @Column(nullable = false, columnDefinition = "text")
    private String advice;

    @Column(nullable = false)
    private Integer rideCount;

    private Long lastRideId;

    @Column(nullable = false, length = 60)
    private String model;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
