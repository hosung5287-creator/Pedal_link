package com.example.demo.repository;

import com.example.demo.entity.MatchRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MatchRequestRepository extends JpaRepository<MatchRequest, Long> {
    List<MatchRequest> findByToUser_IdAndStatusOrderByCreatedAtDesc(Long toUserId, String status);
    List<MatchRequest> findByFromUser_IdAndStatusOrderByCreatedAtDesc(Long fromUserId, String status);
    List<MatchRequest> findByFromUser_IdAndStatusInOrderByCreatedAtDesc(Long fromUserId, List<String> statuses);
    Optional<MatchRequest> findByFromUser_IdAndToUser_IdAndStatus(Long fromUserId, Long toUserId, String status);
    List<MatchRequest> findByStatusAndCreatedAtBefore(String status, LocalDateTime cutoff);
}
