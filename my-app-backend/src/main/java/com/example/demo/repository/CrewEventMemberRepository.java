package com.example.demo.repository;

import com.example.demo.entity.CrewEventMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CrewEventMemberRepository extends JpaRepository<CrewEventMember, Long> {
    Optional<CrewEventMember> findByEvent_IdAndUser_Id(Long eventId, Long userId);
}
