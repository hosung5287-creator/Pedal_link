package com.example.demo.dto;

import lombok.Data;
import java.util.List;

@Data
public class RouteRequest {
    private Long userId;
	private String routeName;
    private Double fromLat;
    private Double fromLng;
    private String fromLabel;
    private Double toLat;
    private Double toLng;
    private String toLabel;
    private String region;
    private Double distanceKm;
    private Integer ascendM;
    private Integer timeMin;
    private List<PointDto> bikeRoute;
    private List<PointDto> shortestRoute;
    private List<WaypointDto> waypoints;   // 경유지 (순서대로, 없으면 null/빈 목록)


}
