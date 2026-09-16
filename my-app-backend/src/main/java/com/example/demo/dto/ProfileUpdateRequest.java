package com.example.demo.dto;

import lombok.Data;

// 프로필 수정 — 보낸 필드만 반영한다 (null 이면 그대로 둔다)
@Data
public class ProfileUpdateRequest {
    private String profileImageUrl;
    private String bio;
    private String bikeInfo;
    private String gender;
    private Integer age;
    private String region;
}
