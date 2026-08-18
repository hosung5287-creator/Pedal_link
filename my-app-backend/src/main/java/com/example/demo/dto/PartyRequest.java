package com.example.demo.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PartyRequest {
    private Long hostId;
    private Long routeId;
    private String title;
    private LocalDateTime startAt;
    private int maxMembers;
}
