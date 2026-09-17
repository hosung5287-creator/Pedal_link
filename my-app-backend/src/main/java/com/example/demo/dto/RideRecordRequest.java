package com.example.demo.dto;

import lombok.Data;
import java.time.LocalDateTime;

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
    private Long routeId;      // 어떤 코스를 탔는지 (선택, 자유주행이면 없음)
    private String routeName;
    private Integer ascendM;   // 그 코스의 상승고도 스냅샷
    private LocalDateTime ridedAt; // 보통은 서버가 now()로 채움 — 목업 데이터 넣을 때만 지정
}
