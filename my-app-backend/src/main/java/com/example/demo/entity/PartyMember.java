package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "party_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"party_id", "user_id"})
})
@Data
public class PartyMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "party_id", nullable = false)
    private Party party;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // pending | joined | rejected
    @Column(nullable = false, length = 20)
    private String status = "pending";

    // 참가자가 라이딩 대기방에서 스스로 표시하는 준비 상태
    @Column(nullable = false)
    private boolean ready = false;

    private LocalDateTime joinedAt = LocalDateTime.now();
}
