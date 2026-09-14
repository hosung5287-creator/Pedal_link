package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "crew_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"crew_id", "user_id"})
})
@Data
public class CrewMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crew_id", nullable = false)
    private Crew crew;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // leader | member
    @Column(nullable = false, length = 20)
    private String role = "member";

    // pending | joined
    @Column(nullable = false, length = 20)
    private String status = "pending";

    // yes | no | unknown — 가장 가까운 정기 라이딩 참석 여부(단순화 버전, 이벤트별 이력은 아직 안 남김)
    @Column(nullable = false, length = 10)
    private String attend = "unknown";

    private LocalDateTime joinedAt = LocalDateTime.now();
}
