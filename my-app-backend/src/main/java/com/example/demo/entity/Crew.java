package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// 정기 모임(크루) — 파티와 달리 한 번 타고 끝나지 않고 계속 유지된다.
@Entity
@Table(name = "crews")
@Data
public class Crew {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leader_user_id", nullable = false)
    private User leader;

    @Column(nullable = false, length = 100)
    private String name;

    private String region;
    private String scheduleText;

    @Column(length = 1000)
    private String description;

    private String tag;
    private String coverPhoto;

    // approval(신청 → 리더 수락) | open(신청하면 바로 가입) | closed(신청 안 받음)
    @Column(nullable = false, length = 20)
    private String joinPolicy = "approval";

    @OneToMany(mappedBy = "crew", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CrewMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "crew", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CrewEvent> events = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
