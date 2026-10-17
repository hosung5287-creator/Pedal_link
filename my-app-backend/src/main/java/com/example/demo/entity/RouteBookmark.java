package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 피드 북마크 — 다른 사람의 코스를 내 저장 목록에 담은 기록 (DB/migrations/012_route_bookmarks.sql).
 * 코스를 복사하지 않고 연결만 남긴다. 같은 코스는 한 번만 저장된다.
 */
@Entity
@Table(name = "route_bookmarks", uniqueConstraints = {
        @UniqueConstraint(name = "uk_route_bookmarks_user_route", columnNames = {"user_id", "route_id"})
})
@Data
public class RouteBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "route_id", nullable = false)
    private Long routeId;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
