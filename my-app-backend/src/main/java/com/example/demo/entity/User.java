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
<<<<<<< HEAD

    private String name;

    private String email;

    // 수정 후
@Column(name = "password_hash")
private String password;
=======
    private String name;
    private String email;
    private String password;

>>>>>>> 3af1c9094048a33754471530997cd084719dfbd3
    // 로그인 제공자: google, naver
    private String provider;

    // 제공자별 고유 식별자
    private String providerId;

<<<<<<< HEAD
=======
    private boolean locationShareEnabled = false;

>>>>>>> 3af1c9094048a33754471530997cd084719dfbd3
    private LocalDateTime createdAt = LocalDateTime.now();
}
