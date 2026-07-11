package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String email;

    // 로그인 제공자: google, naver
    private String provider;

    // 제공자별 고유 식별자
    private String providerId;

    private LocalDateTime createdAt = LocalDateTime.now();
}
