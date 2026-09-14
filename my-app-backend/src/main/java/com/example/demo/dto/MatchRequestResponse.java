package com.example.demo.dto;

import com.example.demo.entity.MatchRequest;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class MatchRequestResponse {
    private Long id;
    private Long fromUserId;
    private String fromName;
    private Long toUserId;
    private String toName;
    private String status;
    private Long partyId;
    private LocalDateTime createdAt;

    public static MatchRequestResponse from(MatchRequest r) {
        MatchRequestResponse res = new MatchRequestResponse();
        res.id = r.getId();
        res.fromUserId = r.getFromUser().getId();
        res.fromName = r.getFromUser().getName();
        res.toUserId = r.getToUser().getId();
        res.toName = r.getToUser().getName();
        res.status = r.getStatus();
        res.partyId = r.getPartyId();
        res.createdAt = r.getCreatedAt();
        return res;
    }
}
