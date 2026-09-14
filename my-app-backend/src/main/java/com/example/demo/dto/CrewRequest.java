package com.example.demo.dto;

import lombok.Data;

@Data
public class CrewRequest {
    private Long leaderId;
    private String name;
    private String region;
    private String scheduleText;
    private String description;
    private String tag;
    private String joinPolicy; // open | approval
    private String coverPhoto;
}
