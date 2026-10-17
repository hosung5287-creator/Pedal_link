package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// 크루가 여는 라이딩 한 건 ("이번주 라이딩 열기").
// 흐름: recruiting(초대·참여 응답) → checking(당일 팀장이 220m·토큰으로 인원 체크) → riding(파티를 만들어 라이딩 시작)
// 팀장이 취소하면 canceled. 라이딩이 끝났는지는 연결된 파티(partyId)의 상태로 판단한다.
@Entity
@Table(name = "crew_events")
@Data
public class CrewEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "crew_id", nullable = false)
    private Crew crew;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private LocalDateTime startAt;

    @Column(nullable = false)
    private int maxMembers = 20;

    // 탈 코스 (routes.id)
    @Column(name = "route_id")
    private Long routeId;

    // recruiting | checking | riding | canceled — 예전 행이 있을 수 있어 nullable (null 은 끝난 것으로 본다)
    @Column(length = 20)
    private String status = "recruiting";

    // 라이딩을 시작하면 만들어지는 파티 — 라이딩 화면·위치·기록은 파티 기능을 그대로 쓴다
    @Column(name = "party_id")
    private Long partyId;

    // 초대한 멤버들 (팀장은 들어가지 않는다 — 팀장은 항상 참여·체크하는 쪽)
    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<CrewEventMember> members = new ArrayList<>();
}
