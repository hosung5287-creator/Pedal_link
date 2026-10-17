package com.example.demo.service;

import com.example.demo.dto.ChatMessage;
import com.example.demo.dto.CrewRideRequest;
import com.example.demo.dto.CrewRideResponse;
import com.example.demo.dto.PartyResponse;
import com.example.demo.entity.Crew;
import com.example.demo.entity.CrewChatMessageEntity;
import com.example.demo.entity.CrewEvent;
import com.example.demo.entity.CrewEventMember;
import com.example.demo.entity.CrewMember;
import com.example.demo.entity.User;
import com.example.demo.repository.CrewChatMessageRepository;
import com.example.demo.repository.CrewEventMemberRepository;
import com.example.demo.repository.CrewEventRepository;
import com.example.demo.repository.CrewRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.LiveLocationService.LiveLocation;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * 크루 라이딩 ("이번주 라이딩 열기").
 *  1) 팀장이 멤버·코스·날짜를 골라 연다 → 크루 채팅에 초대 카드(RIDE_INVITE)
 *  2) 초대된 멤버가 참여/불참 응답 (참여하면 라이딩 날짜 당일 23:59 까지 유효한 토큰 발급)
 *  3) 라이딩 당일 팀장이 인원 체크 시작 → 응답 안 한 사람은 불참 처리
 *  4) 팀장과 CHECK_RANGE_M 안 + 유효한 토큰이면 체크 (사람별·일괄)
 *  5) 라이딩 시작 → 팀장 + 체크된 인원으로 파티를 만들어 라이딩 화면으로 (체크 못 한 사람은 합류 불가)
 */
@Service
@RequiredArgsConstructor
public class CrewRideService {

    // 인원 체크 거리 (임시) — 파티 모집 범위(PartyService.PARTY_RANGE_M)와 같은 값으로 시작한다
    public static final int CHECK_RANGE_M = 220;
    public static final String INVITE_TYPE = "RIDE_INVITE";

    private final CrewRepository crewRepository;
    private final CrewEventRepository eventRepository;
    private final CrewEventMemberRepository eventMemberRepository;
    private final UserRepository userRepository;
    private final RouteRepository routeRepository;
    private final CrewChatMessageRepository crewChatRepository;
    private final SimpMessagingTemplate messaging;
    private final LiveLocationService liveLocations;
    private final PartyService partyService;

    // ───────── 조회 ─────────

    /** 크루의 진행 중인 라이딩 (없으면 empty) — 크루당 동시에 하나만 연다 */
    @Transactional(readOnly = true)
    public Optional<CrewRideResponse> getActive(Long crewId, Long viewerId) {
        return findActive(crewId).map(e -> toResponse(e, viewerId));
    }

    @Transactional(readOnly = true)
    public CrewRideResponse get(Long eventId, Long viewerId) {
        return toResponse(findEvent(eventId), viewerId);
    }

    /** 내가 체크되어 지금 라이딩 중인 크루 라이딩 — 앱이 라이딩 화면을 자동으로 띄울 때 쓴다 */
    @Transactional(readOnly = true)
    public Optional<Map<String, Long>> findMyRiding(Long userId) {
        for (CrewEvent e : eventRepository.findByStatus("riding")) {
            // 끝났거나 라이딩이 멈춘 파티는 자동으로 다시 열지 않는다
            if (!partyService.isRiding(e.getPartyId())) continue;
            boolean leader = e.getCrew().getLeader().getId().equals(userId);
            boolean checked = e.getMembers().stream()
                    .anyMatch(m -> m.getUser().getId().equals(userId) && "checked".equals(m.getStatus()));
            if (leader || checked) return Optional.of(Map.of("eventId", e.getId(), "partyId", e.getPartyId()));
        }
        return Optional.empty();
    }

    // ───────── 1) 열기 ─────────

    @Transactional
    public CrewRideResponse open(Long crewId, CrewRideRequest req) {
        Crew crew = crewRepository.findById(crewId).orElseThrow(() -> new RuntimeException("크루를 찾을 수 없습니다."));
        requireLeader(crew, req.getLeaderId());
        if (findActive(crewId).isPresent()) {
            throw new RuntimeException("이미 진행 중인 라이딩이 있어요. 끝나거나 취소한 뒤에 열 수 있어요.");
        }
        if (req.getStartAt() == null || req.getStartAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("출발 시각은 지금 이후로 정해주세요.");
        }
        if (req.getRouteId() == null || !routeRepository.existsById(req.getRouteId())) {
            throw new RuntimeException("탈 코스를 선택해주세요.");
        }
        List<Long> memberIds = req.getMemberIds() == null ? List.of() : req.getMemberIds();
        if (memberIds.isEmpty()) {
            throw new RuntimeException("함께 탈 멤버를 한 명 이상 선택해주세요.");
        }

        // 크루에 가입된(joined) 멤버만, 팀장 제외
        Set<Long> joined = new HashSet<>();
        for (CrewMember m : crew.getMembers()) {
            if ("joined".equals(m.getStatus())) joined.add(m.getUser().getId());
        }
        String title = req.getTitle() == null || req.getTitle().isBlank() ? "이번주 라이딩" : req.getTitle().trim();

        CrewEvent event = new CrewEvent();
        event.setCrew(crew);
        event.setTitle(title.length() > 200 ? title.substring(0, 200) : title);
        event.setStartAt(req.getStartAt());
        event.setRouteId(req.getRouteId());
        event.setStatus("recruiting");
        for (Long uid : new HashSet<>(memberIds)) {
            if (uid.equals(req.getLeaderId())) continue;
            if (!joined.contains(uid)) throw new RuntimeException("크루에 가입된 멤버만 초대할 수 있어요.");
            CrewEventMember m = new CrewEventMember();
            m.setEvent(event);
            m.setUser(findUser(uid));
            event.getMembers().add(m);
        }
        event.setMaxMembers(event.getMembers().size() + 1);
        CrewEvent saved = eventRepository.save(event);
        crew.getEvents().add(saved);

        postInviteCard(crew, saved);
        return toResponse(saved, req.getLeaderId());
    }

    // 크루 채팅에 초대 카드 — content 에 이벤트 번호만 담고, 화면이 상세를 불러와 [참여][불참]을 그린다
    private void postInviteCard(Crew crew, CrewEvent event) {
        User leader = crew.getLeader();
        LocalDateTime now = LocalDateTime.now();

        CrewChatMessageEntity entity = new CrewChatMessageEntity();
        entity.setCrewId(crew.getId());
        entity.setSenderId(leader.getId());
        entity.setSenderName(leader.getName());
        entity.setContent(String.valueOf(event.getId()));
        entity.setType(INVITE_TYPE);
        entity.setCreatedAt(now);
        crewChatRepository.save(entity);

        ChatMessage msg = new ChatMessage();
        msg.setRoomId(crew.getId());
        msg.setSenderId(leader.getId());
        msg.setSenderName(leader.getName());
        msg.setContent(String.valueOf(event.getId()));
        msg.setType(INVITE_TYPE);
        msg.setSentAt(now.toString());
        messaging.convertAndSend("/topic/crew-chat/" + crew.getId(), msg);
    }

    // ───────── 2) 참여/불참 응답 ─────────

    @Transactional
    public CrewRideResponse respond(Long eventId, Long userId, boolean accept) {
        CrewEvent event = findEvent(eventId);
        if (!"recruiting".equals(event.getStatus())) {
            throw new RuntimeException("응답 기간이 끝났어요. (팀장이 인원 체크를 시작했어요)");
        }
        CrewEventMember m = eventMemberRepository.findByEvent_IdAndUser_Id(eventId, userId)
                .orElseThrow(() -> new RuntimeException("초대받지 않은 라이딩이에요."));
        m.setRespondedAt(LocalDateTime.now());
        if (accept) {
            m.setStatus("accepted");
            m.setToken(UUID.randomUUID().toString());
            // 토큰은 라이딩 날짜 당일 23:59:59 까지
            m.setTokenExpiresAt(event.getStartAt().toLocalDate().atTime(23, 59, 59));
        } else {
            m.setStatus("declined");
            m.setToken(null);
            m.setTokenExpiresAt(null);
        }
        eventMemberRepository.save(m);
        return toResponse(event, userId);
    }

    // ───────── 3) 인원 체크 시작 ─────────

    @Transactional
    public CrewRideResponse startCheck(Long eventId, Long leaderId) {
        CrewEvent event = findEvent(eventId);
        requireLeader(event.getCrew(), leaderId);
        if (!"recruiting".equals(event.getStatus())) {
            throw new RuntimeException("이미 인원 체크를 시작했거나 끝난 라이딩이에요.");
        }
        if (!LocalDate.now().equals(event.getStartAt().toLocalDate())) {
            throw new RuntimeException("인원 체크는 라이딩 당일에만 시작할 수 있어요.");
        }
        // 응답하지 않은 사람은 불참 처리
        for (CrewEventMember m : event.getMembers()) {
            if ("invited".equals(m.getStatus())) {
                m.setStatus("declined");
                m.setRespondedAt(LocalDateTime.now());
            }
        }
        event.setStatus("checking");
        eventRepository.save(event);
        return toResponse(event, leaderId);
    }

    // ───────── 4) 인원 체크 (targetUserId 가 null 이면 일괄) ─────────

    @Transactional
    public CrewRideResponse check(Long eventId, Long leaderId, Long targetUserId) {
        CrewEvent event = findEvent(eventId);
        requireLeader(event.getCrew(), leaderId);
        if (!"checking".equals(event.getStatus())) {
            throw new RuntimeException("인원 체크 중인 라이딩이 아니에요.");
        }
        LiveLocation leaderLoc = liveLocations.find(leaderId)
                .orElseThrow(() -> new RuntimeException("팀장이 위치 공유를 켜야 인원 체크를 할 수 있어요."));

        List<CrewRideResponse.CheckResult> results = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        for (CrewEventMember m : event.getMembers()) {
            Long uid = m.getUser().getId();
            if (targetUserId != null && !targetUserId.equals(uid)) continue;
            if (!"accepted".equals(m.getStatus()) && !"checked".equals(m.getStatus())) {
                if (targetUserId != null) results.add(result(m, false, "참여를 확정하지 않은 멤버예요."));
                continue;
            }
            if ("checked".equals(m.getStatus())) {
                results.add(result(m, true, null));
                continue;
            }
            if (m.getToken() == null || m.getTokenExpiresAt() == null || !m.getTokenExpiresAt().isAfter(now)) {
                results.add(result(m, false, "토큰이 없거나 만료됐어요."));
                continue;
            }
            Optional<LiveLocation> loc = liveLocations.find(uid);
            if (loc.isEmpty()) {
                results.add(result(m, false, "위치 공유가 꺼져 있어요."));
                continue;
            }
            long dist = Math.round(LiveLocationService.distanceM(leaderLoc, loc.get()));
            if (dist > CHECK_RANGE_M) {
                results.add(result(m, false, "팀장과 약 " + dist + "m 떨어져 있어요. (" + CHECK_RANGE_M + "m 안이어야 해요)"));
                continue;
            }
            m.setStatus("checked");
            m.setCheckedAt(now);
            results.add(result(m, true, null));
        }
        eventRepository.save(event);

        CrewRideResponse r = toResponse(event, leaderId);
        r.setCheckResults(results);
        return r;
    }

    private static CrewRideResponse.CheckResult result(CrewEventMember m, boolean ok, String reason) {
        CrewRideResponse.CheckResult c = new CrewRideResponse.CheckResult();
        c.setUserId(m.getUser().getId());
        c.setName(m.getUser().getName());
        c.setOk(ok);
        c.setReason(reason);
        return c;
    }

    // ───────── 5) 라이딩 시작 ─────────

    @Transactional
    public CrewRideResponse start(Long eventId, Long leaderId) {
        CrewEvent event = findEvent(eventId);
        requireLeader(event.getCrew(), leaderId);
        if (!"checking".equals(event.getStatus())) {
            throw new RuntimeException("인원 체크를 마친 뒤에 라이딩을 시작할 수 있어요.");
        }
        List<Long> checked = event.getMembers().stream()
                .filter(m -> "checked".equals(m.getStatus()))
                .map(m -> m.getUser().getId())
                .toList();
        if (checked.isEmpty()) {
            throw new RuntimeException("체크된 인원이 없어요. 한 명 이상 체크한 뒤에 시작해주세요.");
        }
        PartyResponse party = partyService.createCrewRideParty(leaderId, checked, event.getRouteId(), event.getTitle());
        event.setPartyId(party.getId());
        event.setStatus("riding");
        eventRepository.save(event);
        return toResponse(event, leaderId);
    }

    /** 팀장이 라이딩 시작 전에 취소 */
    @Transactional
    public CrewRideResponse cancel(Long eventId, Long leaderId) {
        CrewEvent event = findEvent(eventId);
        requireLeader(event.getCrew(), leaderId);
        if (!"recruiting".equals(event.getStatus()) && !"checking".equals(event.getStatus())) {
            throw new RuntimeException("시작했거나 끝난 라이딩은 취소할 수 없어요.");
        }
        event.setStatus("canceled");
        eventRepository.save(event);
        return toResponse(event, leaderId);
    }

    // ───────── 내부 ─────────

    private Optional<CrewEvent> findActive(Long crewId) {
        LocalDate today = LocalDate.now();
        return eventRepository.findByCrew_IdOrderByStartAtDesc(crewId).stream()
                .filter(e -> {
                    String s = e.getStatus();
                    if ("recruiting".equals(s) || "checking".equals(s)) {
                        return !e.getStartAt().toLocalDate().isBefore(today);   // 날짜가 지나면 끝난 것으로 본다
                    }
                    return "riding".equals(s) && !partyService.isPartyEnded(e.getPartyId());
                })
                .findFirst();
    }

    private CrewRideResponse toResponse(CrewEvent e, Long viewerId) {
        CrewRideResponse r = new CrewRideResponse();
        r.setEventId(e.getId());
        r.setCrewId(e.getCrew().getId());
        r.setTitle(e.getTitle());
        r.setStartAt(e.getStartAt());
        String status = e.getStatus() == null ? "ended" : e.getStatus();
        if ("riding".equals(status) && partyService.isPartyEnded(e.getPartyId())) status = "ended";
        r.setStatus(status);
        r.setRouteId(e.getRouteId());
        if (e.getRouteId() != null) routeRepository.findById(e.getRouteId()).ifPresent(rt -> r.setRouteName(rt.getRouteName()));
        r.setPartyId(e.getPartyId());
        User leader = e.getCrew().getLeader();
        r.setLeaderId(leader.getId());
        r.setLeaderName(leader.getName());
        r.setCheckRangeM(CHECK_RANGE_M);

        List<CrewRideResponse.MemberDto> members = new ArrayList<>();
        String myStatus = leader.getId().equals(viewerId) ? "leader" : "none";
        for (CrewEventMember m : e.getMembers()) {
            CrewRideResponse.MemberDto d = new CrewRideResponse.MemberDto();
            d.setUserId(m.getUser().getId());
            d.setName(m.getUser().getName());
            d.setStatus(m.getStatus());
            d.setCheckedAt(m.getCheckedAt());
            members.add(d);
            if (m.getUser().getId().equals(viewerId)) {
                myStatus = m.getStatus();
                r.setMyTokenExpiresAt(m.getTokenExpiresAt());
            }
        }
        r.setMembers(members);
        r.setMyStatus(myStatus);
        return r;
    }

    private void requireLeader(Crew crew, Long userId) {
        if (userId == null || !crew.getLeader().getId().equals(userId)) {
            throw new SecurityException("팀장만 할 수 있어요.");
        }
    }

    private CrewEvent findEvent(Long id) {
        return eventRepository.findById(id).orElseThrow(() -> new RuntimeException("라이딩을 찾을 수 없습니다."));
    }

    private User findUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    }
}
