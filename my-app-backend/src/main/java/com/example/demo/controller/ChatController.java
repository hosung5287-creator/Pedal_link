package com.example.demo.controller;

import com.example.demo.dto.ChatMessage;
import com.example.demo.entity.ChatMessageEntity;
import com.example.demo.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.List;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messaging;
    private final ChatMessageRepository chatRepo;

    // 클라이언트 → /app/chat/{roomId}/send
    // 서버  → /topic/chat/{roomId} 브로드캐스트
    @MessageMapping("/chat/{roomId}/send")
    public void send(@DestinationVariable Long roomId,
                     @Payload ChatMessage msg) {
        msg.setRoomId(roomId);
        msg.setSentAt(LocalDateTime.now().toString());

        ChatMessageEntity entity = new ChatMessageEntity();
        entity.setRoomId(roomId);
        entity.setSenderId(msg.getSenderId());
        entity.setSenderName(msg.getSenderName());
        entity.setContent(msg.getContent());
        entity.setType(msg.getType() != null ? msg.getType() : "TEXT");
        entity.setCreatedAt(LocalDateTime.now());
        chatRepo.save(entity);

        messaging.convertAndSend("/topic/chat/" + roomId, msg);
    }

    // 이전 채팅 내역 조회 — 프론트가 방 입장 시 REST 로 한 번 불러옴
    @GetMapping("/api/chat/{roomId}/history")
    @ResponseBody
    public List<ChatMessageEntity> history(@PathVariable Long roomId) {
        return chatRepo.findByRoomIdOrderByCreatedAtAsc(roomId);
    }
}
