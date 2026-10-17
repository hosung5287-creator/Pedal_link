package com.example.demo.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

// 크루 라이딩 상세 — 크루 관리 칸·채팅 초대 카드가 쓴다. 토큰 값 자체는 내려주지 않는다(서버에서만 확인).
@Data
public class CrewRideResponse {

    @Data
    public static class MemberDto {
        private Long userId;
        private String name;
        private String status;          // invited | accepted | declined | checked
        private LocalDateTime checkedAt;
    }

    @Data
    public static class CheckResult {
        private Long userId;
        private String name;
        private boolean ok;
        private String reason;          // 체크 실패 사유 (ok 면 null)
    }

    private Long eventId;
    private Long crewId;
    private String title;
    private LocalDateTime startAt;
    private String status;              // recruiting | checking | riding | ended | canceled
    private Long routeId;
    private String routeName;
    private Long partyId;
    private Long leaderId;
    private String leaderName;
    private int checkRangeM;            // 인원 체크 거리 (팀장 ↔ 멤버)
    private List<MemberDto> members;

    // 요청한 사람 기준
    private String myStatus;            // leader | invited | accepted | declined | checked | none
    private LocalDateTime myTokenExpiresAt;

    // 인원 체크를 했을 때만 채운다
    private List<CheckResult> checkResults;
}
