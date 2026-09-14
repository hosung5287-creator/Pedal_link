package com.example.demo.repository;

import com.example.demo.entity.CrewChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CrewChatMessageRepository extends JpaRepository<CrewChatMessageEntity, Long> {
    List<CrewChatMessageEntity> findByCrewIdOrderByCreatedAtAsc(Long crewId);
}
