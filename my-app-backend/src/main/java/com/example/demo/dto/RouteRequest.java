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
    private Double distanceKm;
    private Integer ascendM;
    private Integer timeMin;
    private List<PointDto> bikeRoute;
    private List<PointDto> shortestRoute;


}
