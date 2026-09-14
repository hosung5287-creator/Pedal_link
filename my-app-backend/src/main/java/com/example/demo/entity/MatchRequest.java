package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

// 지오펜스 안에서 만난 두 사람의 매칭 신청. 수락되면 2인 파티(partyId)가 생긴다.
@Entity
@Table(name = "match_requests")
@Data
public class MatchRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_user_id", nullable = false)
    private User fromUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_user_id", nullable = false)
    private User toUser;

    // pending | accepted | rejected | expired
    @Column(nullable = false, length = 20)
    private String status = "pending";

    // 수락되어 만들어진 파티 id
    private Long partyId;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
