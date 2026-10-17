package com.example.demo.dto;

import lombok.Data;

// 크루 설정 변경 — 리더만 바꿀 수 있어서 요청한 사람(userId)을 같이 받는다.
@Data
public class CrewSettingsRequest {
    private Long userId;
    private String joinPolicy; // approval | open | closed
}
