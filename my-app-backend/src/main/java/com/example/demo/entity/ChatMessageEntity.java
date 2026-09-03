package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

// DB/migrations/001_chat_messages.sql 의 chat_messages 테이블과 매핑됨.
// 이름을 ChatMessage 대신 ChatMessageEntity 로 둔 이유: dto.ChatMessage 가
// STOMP 페이로드용 DTO 로 이미 쓰이고 있어서, 같은 파일에서 둘 다 import 해도
// 헷갈리지 않게 구분함.
@Entity
@Table(name = "chat_messages")
@Data
public class ChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long roomId;
    private Long senderId;
    private String senderName;

    @Column(columnDefinition = "TEXT")
    private String content;

    private String type;       // TEXT | CODE | JOIN | LEAVE

    private LocalDateTime createdAt = LocalDateTime.now();
}
