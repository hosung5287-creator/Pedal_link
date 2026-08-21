package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "parties")
@Data
public class Party {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_user_id", nullable = false)
    private User host;

    private Long routeId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private LocalDateTime startAt;

    @Column(nullable = false)
    private int maxMembers = 6;

    @Column(nullable = false, length = 20)
    private String status = "open";

    @OneToMany(mappedBy = "party", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PartyMember> members = new ArrayList<>();

    // 호스트가 라이딩을 시작한 시각. 참가자 화면이 이 값을 보고 같이 출발한다.
    private LocalDateTime rideStartedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
