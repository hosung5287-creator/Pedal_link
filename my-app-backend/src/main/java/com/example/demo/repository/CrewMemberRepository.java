package com.example.demo.repository;

import com.example.demo.entity.Crew;
import com.example.demo.entity.CrewMember;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CrewMemberRepository extends JpaRepository<CrewMember, Long> {
    Optional<CrewMember> findByCrewAndUser(Crew crew, User user);
    boolean existsByCrewAndUser(Crew crew, User user);
}
