package com.example.demo.dto;

import lombok.Data;

// 경로 만들기의 경유지 1곳 — 출발 → 경유지(순서대로) → 도착.
// routes.waypoints 컬럼에 이 목록을 JSON 텍스트로 저장한다.
@Data
public class WaypointDto {
    private Double lat;
    private Double lng;
    private String label;
}
