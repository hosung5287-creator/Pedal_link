package com.example.demo.repository;

import com.example.demo.entity.RouteBookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RouteBookmarkRepository extends JpaRepository<RouteBookmark, Long> {

    Optional<RouteBookmark> findByUserIdAndRouteId(Long userId, Long routeId);

    // 내 저장 목록 (최근에 저장한 것부터)
    List<RouteBookmark> findByUserIdOrderByCreatedAtDesc(Long userId);

    // 피드 카드들 중 내가 저장한 것 — "저장됨" 표시용
    @Query("SELECT b.routeId FROM RouteBookmark b WHERE b.userId = :userId AND b.routeId IN :routeIds")
    List<Long> findRouteIdsByUserIdAndRouteIdIn(@Param("userId") Long userId, @Param("routeIds") Collection<Long> routeIds);

    // 저장 목록에서 빼기 (저장 취소) — 코스 자체는 지우지 않는다
    @Modifying
    @Query("DELETE FROM RouteBookmark b WHERE b.userId = :userId AND b.routeId IN :routeIds")
    int deleteByUserIdAndRouteIdIn(@Param("userId") Long userId, @Param("routeIds") Collection<Long> routeIds);
}
