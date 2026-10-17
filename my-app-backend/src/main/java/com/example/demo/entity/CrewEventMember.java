package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

// 크루 라이딩에 초대된 멤버 한 명.
// invited(응답 전) → accepted(참여, 토큰 발급) / declined(불참) → checked(당일 팀장이 인원 체크 완료)
// 토큰은 라이딩 날짜 당일 23:59 까지 유효하고, 인원 체크 때 서버가 확인한다.
@Entity
@Table(name = "crew_event_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"event_id", "user_id"})
})
@Getter
@Setter
public class CrewEventMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private CrewEvent event;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String status = "invited";

    @Column(length = 36)
    private String token;

    private LocalDateTime tokenExpiresAt;
    private LocalDateTime respondedAt;
    private LocalDateTime checkedAt;
}
