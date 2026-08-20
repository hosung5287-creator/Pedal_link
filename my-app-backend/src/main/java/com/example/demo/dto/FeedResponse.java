package com.example.demo.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 둘러보기 피드 카드 1장에 필요한 데이터.
 * 저장된 경로(Route) + 작성자 이름 + 좋아요 정보를 한 덩어리로 합쳐 내려준다.
 */
@Data
public class FeedResponse {
    private Long id;                 // routeId
    private String routeName;
    private String fromLabel;
    private String toLabel;

    private Double distanceKm;
    private Integer ascendM;
    private Integer timeMin;

    private Long authorId;
    private String authorName;

    // 작성 모달로 쓴 내용 (없으면 null → 프론트가 자동 문구/태그를 만든다)
    private String description;
    private List<String> tags;

    // 썸네일용 경로 좌표 (원본을 그대로 주면 무거워서 서버에서 솎아낸다)
    private List<PointDto> path;

    private long likeCount;
    private boolean liked;           // 요청한 유저가 좋아요를 눌렀는지

    private LocalDateTime createdAt;
}
