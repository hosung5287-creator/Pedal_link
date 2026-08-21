package com.example.demo.dto;

import lombok.Data;

/**
 * 라이딩 종료 시 프론트(MapPage)가 보내는 주행 기록.
 * 프론트는 distance(km) / duration(분) 이라는 이름으로 보내므로
 * 엔티티 필드명(distanceKm / durationMin)과 다르다. 그 차이를 이 DTO가 흡수한다.
 */
@Data
public class RideRecordRequest {
    private Long userId;
    private Double distance;   // km
    private Integer duration;  // 분
    private Long partyId;      // 파티 라이딩이면 파티 id (선택)
}
