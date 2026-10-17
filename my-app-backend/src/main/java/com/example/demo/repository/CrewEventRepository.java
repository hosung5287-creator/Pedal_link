package com.example.demo.repository;

import com.example.demo.entity.CrewEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CrewEventRepository extends JpaRepository<CrewEvent, Long> {
    List<CrewEvent> findByCrew_IdOrderByStartAtDesc(Long crewId);
    List<CrewEvent> findByStatus(String status);

    // 이 파티가 크루 라이딩으로 만들어진 파티인지
    boolean existsByPartyId(Long partyId);
}
