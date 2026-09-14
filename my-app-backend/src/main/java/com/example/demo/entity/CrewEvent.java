package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

// 크루가 여는 정기 라이딩 한 건. 참석 신청 기능은 아직 없어 joined는 항상 0으로 내려간다.
@Entity
@Table(name = "crew_events")
@Data
public class CrewEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crew_id", nullable = false)
    private Crew crew;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private LocalDateTime startAt;

    @Column(nullable = false)
    private int maxMembers = 20;
}
