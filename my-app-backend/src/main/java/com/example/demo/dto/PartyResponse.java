package com.example.demo.dto;

import com.example.demo.entity.Party;
import com.example.demo.entity.PartyMember;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
public class PartyResponse {

    @Data
    public static class MemberDto {
        private Long userId;
        private String name;
    }

    private Long id;
    private String title;
    private Long routeId;
    private String routeName;
    private String fromLabel;
    private String toLabel;
    private Double distanceKm;
    private LocalDateTime startAt;
    private int maxMembers;
    private Long hostId;
    private String hostName;
    private String status;
    private List<MemberDto> participants;
    private List<MemberDto> pendingRequests;
    private LocalDateTime rideStartedAt;
    private LocalDateTime createdAt;

    public static PartyResponse from(Party party) {
        PartyResponse r = new PartyResponse();
        r.id = party.getId();
        r.title = party.getTitle();
        r.routeId = party.getRouteId();
        r.startAt = party.getStartAt();
        r.maxMembers = party.getMaxMembers();
        r.hostId = party.getHost().getId();
        r.hostName = party.getHost().getName();
        r.status = party.getStatus();
        r.rideStartedAt = party.getRideStartedAt();
        r.createdAt = party.getCreatedAt();

        r.participants = party.getMembers().stream()
                .filter(m -> "joined".equals(m.getStatus()))
                .map(PartyResponse::toDto)
                .collect(Collectors.toList());

        r.pendingRequests = party.getMembers().stream()
                .filter(m -> "pending".equals(m.getStatus()))
                .map(PartyResponse::toDto)
                .collect(Collectors.toList());

        return r;
    }

    private static MemberDto toDto(PartyMember m) {
        MemberDto d = new MemberDto();
        d.userId = m.getUser().getId();
        d.name = m.getUser().getName();
        return d;
    }
}
