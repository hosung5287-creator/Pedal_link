package com.example.demo.controller;

import com.example.demo.dto.ChatMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messaging;

    // 클라이언트 → /app/chat/{roomId}/send
    // 서버  → /topic/chat/{roomId} 브로드캐스트
    @MessageMapping("/chat/{roomId}/send")
    public void send(@DestinationVariable Long roomId,
                     @Payload ChatMessage msg) {
        msg.setRoomId(roomId);
        msg.setSentAt(LocalDateTime.now().toString());
        messaging.convertAndSend("/topic/chat/" + roomId, msg);
    }
}
