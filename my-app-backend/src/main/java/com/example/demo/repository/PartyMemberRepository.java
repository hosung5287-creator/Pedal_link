package com.example.demo.repository;

import com.example.demo.entity.Party;
import com.example.demo.entity.PartyMember;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PartyMemberRepository extends JpaRepository<PartyMember, Long> {
    Optional<PartyMember> findByPartyAndUser(Party party, User user);

    // 매칭 신청 가능 여부 확인용 — 종료되지 않은 파티에 이미 참여(joined) 중인지
    boolean existsByUser_IdAndStatusAndParty_StatusNot(Long userId, String status, String partyStatus);

    // 방장이 나를 내보낸(kicked) 아직 안 끝난 파티들 — [파티 id, 파티 이름]. 도크가 "내보내졌어요" 안내에 쓴다.
    @Query("SELECT m.party.id, m.party.title FROM PartyMember m "
            + "WHERE m.user.id = :userId AND m.status = 'kicked' AND m.party.status <> 'ended'")
    List<Object[]> findKickedParties(@Param("userId") Long userId);
}
