package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "Rider_records")
@Data
@NoArgsConstructor
public class RideRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "Route_Distance")
    private Integer routeDistance; // 주행 거리

    @Column(name = "time")
    private Integer time; // 주행 시간

    private String startPoint;
    private String endPoint;

    private LocalDateTime createdAt = LocalDateTime.now();
}