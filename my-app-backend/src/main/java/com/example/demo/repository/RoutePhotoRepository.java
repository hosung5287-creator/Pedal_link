package com.example.demo.repository;

import com.example.demo.entity.RoutePhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface RoutePhotoRepository extends JpaRepository<RoutePhoto, Long> {

    // 피드 카드들 중 사진이 있는 것 — [routeId, updatedAt]. 사진 바이트는 읽지 않는다.
    @Query("SELECT p.routeId, p.updatedAt FROM RoutePhoto p WHERE p.routeId IN :routeIds")
    List<Object[]> findUpdatedAtByRouteIdIn(@Param("routeIds") Collection<Long> routeIds);

    // 코스를 지울 때 사진도 같이
    @Modifying
    @Query("DELETE FROM RoutePhoto p WHERE p.routeId IN :routeIds")
    int deleteByRouteIdIn(@Param("routeIds") Collection<Long> routeIds);
}
