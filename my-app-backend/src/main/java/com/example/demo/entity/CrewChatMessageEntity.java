package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

// 크루 채팅 메시지 — chat_messages(파티 전용, room_id가 parties(id) FK로 못박혀 있음)와는
// 별도 테이블로 둔다. crewId는 party.chat_messages처럼 FK를 걸지 않는다
// (MatchRequest.partyId, RideRecord.partyId도 같은 방식 — 이 프로젝트에서 이미 쓰는 패턴).
@Entity
@Table(name = "crew_chat_messages")
@Data
public class CrewChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long crewId;
    private Long senderId;
    private String senderName;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String type; // TEXT | CODE | JOIN | LEAVE

    private LocalDateTime createdAt = LocalDateTime.now();
}
