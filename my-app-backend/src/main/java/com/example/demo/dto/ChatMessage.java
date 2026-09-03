package com.example.demo.dto;

import lombok.Data;

@Data
public class ChatMessage {
    private Long roomId;
    private Long senderId;
    private String senderName;
    private String content;
    private String type;     // TEXT | CODE | JOIN | LEAVE
    private String sentAt;   // ISO 문자열 — 프론트에서 채워서 보내거나 서버가 덮어씀
}
