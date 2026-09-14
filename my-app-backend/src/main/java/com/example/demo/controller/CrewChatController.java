package com.example.demo.controller;

import com.example.demo.dto.ChatMessage;
import com.example.demo.entity.CrewChatMessageEntity;
import com.example.demo.repository.CrewChatMessageRepository;
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

// ChatController(파티 채팅)와 같은 구조지만 별도 테이블(crew_chat_messages)을 쓴다.
// chat_messages.room_id가 parties(id) FK라 크루 id를 그대로 못 쓰기 때문에 분리했다.
@Controller
@RequiredArgsConstructor
public class CrewChatController {

    private final SimpMessagingTemplate messaging;
    private final CrewChatMessageRepository crewChatRepo;

    // 클라이언트 → /app/crew-chat/{crewId}/send
    // 서버  → /topic/crew-chat/{crewId} 브로드캐스트
    @MessageMapping("/crew-chat/{crewId}/send")
    public void send(@DestinationVariable Long crewId, @Payload ChatMessage msg) {
        msg.setRoomId(crewId);
        msg.setSentAt(LocalDateTime.now().toString());

        CrewChatMessageEntity entity = new CrewChatMessageEntity();
        entity.setCrewId(crewId);
        entity.setSenderId(msg.getSenderId());
        entity.setSenderName(msg.getSenderName());
        entity.setContent(msg.getContent());
        entity.setType(msg.getType() != null ? msg.getType() : "TEXT");
        entity.setCreatedAt(LocalDateTime.now());
        crewChatRepo.save(entity);

        messaging.convertAndSend("/topic/crew-chat/" + crewId, msg);
    }

    @GetMapping("/api/crew-chat/{crewId}/history")
    @ResponseBody
    public List<CrewChatMessageEntity> history(@PathVariable Long crewId) {
        return crewChatRepo.findByCrewIdOrderByCreatedAtAsc(crewId);
    }
}
