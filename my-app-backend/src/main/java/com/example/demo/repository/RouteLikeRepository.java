package com.example.demo.repository;

import com.example.demo.entity.RouteLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RouteLikeRepository extends JpaRepository<RouteLike, Long> {

    Optional<RouteLike> findByRouteIdAndUserId(Long routeId, Long userId);

    long countByRouteId(Long routeId);

    // 내가 좋아요한 경로 id 목록 — 피드 한 번에 "내가 눌렀는지" 표시용
    @Query("SELECT l.routeId FROM RouteLike l WHERE l.userId = :userId")
    List<Long> findRouteIdsByUserId(Long userId);

    // 경로별 좋아요 수를 한 방에 집계 (경로마다 count 쿼리를 날리지 않기 위해)
    @Query("SELECT l.routeId, COUNT(l) FROM RouteLike l GROUP BY l.routeId")
    List<Object[]> countGroupedByRouteId();
}
