package com.example.demo.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

// 팀장이 "이번주 라이딩 열기"로 보내는 값
@Data
public class CrewRideRequest {
    private Long leaderId;
    private String title;
    private LocalDateTime startAt;
    private Long routeId;
    private List<Long> memberIds;   // 초대할 멤버 (팀장 제외)
}
