package com.example.demo.entity;



import jakarta.persistence.*;
import lombok.Data;
import org.locationtech.jts.geom.LineString;
import java.time.LocalDateTime;

@Entity
@Table(name = "routes")
@Data
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private Long userId;

    private String routeName;

    private Double fromLat;
    private Double fromLng;
    private String fromLabel;

    private Double toLat;
    private Double toLng;
    private String toLabel;

    // 경로 분석값 — 저장 시점에 BRouter 결과를 함께 보관
    private Double distanceKm;   // 거리 (km)

    // 필드명이 ascendM 이면 자동 변환 결과가 ascendm 이 되어버려서 컬럼명을 명시한다
    @Column(name = "ascend_m")
    private Integer ascendM;     // 상승고도 (m)

    private Integer timeMin;     // 예상 소요 시간 (분)

    // 둘러보기 게시물 내용 — 작성 모달에서 채운다. 비어 있으면 피드가 자동 문구를 쓴다.
    @Column(length = 500)
    private String description;

    // 해시태그. 쉼표로 이어 붙여 한 컬럼에 담는다 (태그 검색이 필요해지면 별도 테이블로 분리)
    @Column(length = 300)
    private String tags;

    // PostGIS LineString 타입으로 저장
    @Column(columnDefinition = "geometry(LineString, 4326)")
    private LineString bikePath;

    @Column(columnDefinition = "geometry(LineString, 4326)")
    private LineString shortestPath;

    private LocalDateTime createdAt = LocalDateTime.now();
}