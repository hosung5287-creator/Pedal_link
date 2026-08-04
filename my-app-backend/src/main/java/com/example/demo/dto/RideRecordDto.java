package com.example.demo.dto;

import lombok.Data;

@Data
public class RideRecordDto {
    private Long userId;
    private String startPoint;
    private String endPoint;
    private Double distance;
    private Integer duration;
}