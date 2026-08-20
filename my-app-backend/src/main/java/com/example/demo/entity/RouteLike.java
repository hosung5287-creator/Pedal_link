package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 둘러보기 피드의 좋아요.
 * 같은 사람이 같은 경로에 두 번 누를 수 없도록 (route_id, user_id) 를 유니크로 묶는다.
 */
@Entity
@Table(name = "route_likes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"route_id", "user_id"})
})
@Data
public class RouteLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "route_id", nullable = false)
    private Long routeId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    private LocalDateTime createdAt = LocalDateTime.now();
}
