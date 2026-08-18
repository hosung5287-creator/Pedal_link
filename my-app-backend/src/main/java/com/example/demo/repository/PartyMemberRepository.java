package com.example.demo.repository;

import com.example.demo.entity.Party;
import com.example.demo.entity.PartyMember;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PartyMemberRepository extends JpaRepository<PartyMember, Long> {
    Optional<PartyMember> findByPartyAndUser(Party party, User user);
    List<PartyMember> findByPartyAndStatus(Party party, String status);
    boolean existsByPartyAndUser(Party party, User user);
}
