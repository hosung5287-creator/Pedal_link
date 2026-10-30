package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 게시물 사진 — 피드에 올린 코스에 붙인 사진 한 장 (DB/migrations/015_route_photos.sql).
 * 코스는 곳곳에서 통째로 읽히므로 사진은 따로 두고, 사진 주소(/api/routes/{id}/photo)로만 읽는다.
 */
@Entity
@Table(name = "route_photos")
@Data
public class RoutePhoto {

    @Id
    @Column(name = "route_id")
    private Long routeId;

    @Column(name = "content_type", nullable = false, length = 30)
    private String contentType;

    // 화면이 줄여 보낸 사진 바이트 (보통 300KB 안팎)
    @Column(nullable = false)
    private byte[] data;

    // 사진을 바꾼 때 — 사진 주소 뒤에 붙여 예전 사진이 캐시에 남지 않게 한다
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
