package com.example.demo.dto;

import com.example.demo.entity.Crew;
import com.example.demo.entity.CrewEvent;
import com.example.demo.entity.CrewMember;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

// myState(가입 상태)는 여기 안 담는다 — 보는 사람마다 다른 값이라 GET 목록/상세는
// 개인화 없이 그대로 두고, 프론트(CrewPage)가 로그인 유저 id로 직접 계산한다.
// (파티도 PartyResponse엔 myState 없이 PartyDock이 계산하는 것과 같은 패턴)
@Data
public class CrewResponse {

    @Data
    public static class MemberDto {
        private Long userId;
        private String name;
        private String role;
        private String attend;
    }

    @Data
    public static class EventDto {
        private Long id;
        private String title;
        private LocalDateTime startAt;
        private int joined;
        private int maxMembers;
    }

    private Long id;
    private String name;
    private String region;
    private String scheduleText;
    private String description;
    private String tag;
    private int memberCount;
    private Long leaderId;
    private String leaderName;
    private String joinPolicy;
    private String coverPhoto;
    private List<MemberDto> members;
    private List<EventDto> upcoming;
    private List<MemberDto> pendingRequests;
    private LocalDateTime createdAt;

    public static CrewResponse from(Crew crew) {
        CrewResponse r = new CrewResponse();
        r.id = crew.getId();
        r.name = crew.getName();
        r.region = crew.getRegion();
        r.scheduleText = crew.getScheduleText();
        r.description = crew.getDescription();
        r.tag = crew.getTag();
        r.leaderId = crew.getLeader().getId();
        r.leaderName = crew.getLeader().getName();
        r.joinPolicy = crew.getJoinPolicy();
        r.coverPhoto = crew.getCoverPhoto();
        r.createdAt = crew.getCreatedAt();

        r.members = crew.getMembers().stream()
                .filter(m -> "joined".equals(m.getStatus()))
                .map(CrewResponse::toMemberDto)
                .collect(Collectors.toList());
        r.memberCount = r.members.size();

        r.pendingRequests = crew.getMembers().stream()
                .filter(m -> "pending".equals(m.getStatus()))
                .map(CrewResponse::toMemberDto)
                .collect(Collectors.toList());

        r.upcoming = crew.getEvents().stream()
                .map(CrewResponse::toEventDto)
                .collect(Collectors.toList());

        return r;
    }

    private static MemberDto toMemberDto(CrewMember m) {
        MemberDto d = new MemberDto();
        d.userId = m.getUser().getId();
        d.name = m.getUser().getName();
        d.role = m.getRole();
        d.attend = m.getAttend();
        return d;
    }

    private static EventDto toEventDto(CrewEvent e) {
        EventDto d = new EventDto();
        d.id = e.getId();
        d.title = e.getTitle();
        d.startAt = e.getStartAt();
        d.joined = 0;
        d.maxMembers = e.getMaxMembers();
        return d;
    }
}
