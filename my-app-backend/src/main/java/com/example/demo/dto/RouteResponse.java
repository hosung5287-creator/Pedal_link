package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class RouteResponse {
    private Long id;
    private String routeName;
    private Double fromLat;
    private Double fromLng;
    private String fromLabel;
    private Double toLat;
    private Double toLng;
    private String toLabel;
    private List<PointDto> bikeRoute;
    private List<PointDto> shortestRoute;
    private LocalDateTime createdAt;
}