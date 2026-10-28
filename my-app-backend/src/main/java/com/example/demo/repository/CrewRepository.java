package com.example.demo.repository;

import com.example.demo.entity.Crew;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CrewRepository extends JpaRepository<Crew, Long> {
    List<Crew> findAllByOrderByCreatedAtDesc();

    // 시연 모드 — 발표자가 팀장인 크루 (최근에 만든 것부터)
    List<Crew> findByLeader_IdOrderByIdDesc(Long leaderId);
}
