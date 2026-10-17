package com.example.demo.repository;

import org.springframework.data.jpa.repository.Query;
import com.example.demo.entity.Party;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PartyRepository extends JpaRepository<Party, Long> {
    List<Party> findAllByOrderByCreatedAtDesc();

    // 끝나지 않은 파티 + 호스트 + 멤버(+사용자)를 한 번에 — 파티마다 호스트·멤버를 따로 읽던 것(N+1)을 없앤다
    @Query("select distinct p from Party p join fetch p.host "
            + "left join fetch p.members m left join fetch m.user "
            + "where p.status <> 'ended' order by p.createdAt desc")
    List<Party> findNotEndedWithMembers();
}
