package com.example.demo.service;

import com.example.demo.dto.PartyRequest;
import com.example.demo.dto.PartyResponse;
import com.example.demo.entity.Party;
import com.example.demo.entity.PartyMember;
import com.example.demo.entity.Route;
import com.example.demo.entity.User;
import com.example.demo.repository.CrewEventRepository;
import com.example.demo.repository.PartyMemberRepository;
import com.example.demo.repository.PartyRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.LiveLocationService.LiveLocation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PartyService {

    // 모집 중인 파티는 호스트와 이 거리 안에 있는 사람에게만 보이고, 이 안에서만 신청할 수 있다.
    // 프론트 파티 도크의 '접근 중' 기준(PartyDock NEAR_M)과 같은 값 — 한쪽을 바꾸면 같이 바꾼다.
    public static final int PARTY_RANGE_M = 220;

    private final PartyRepository partyRepository;
    private final PartyMemberRepository partyMemberRepository;
    private final UserRepository userRepository;
    private final RouteRepository routeRepository;
    private final LiveLocationService liveLocations;
    private final CrewEventRepository crewEventRepository;

    /**
     * viewerId 가 보는 파티 목록.
     *  - 내가 호스트이거나 멤버·신청 중인 파티: 거리와 상관없이 항상 (내 파티·채팅이 끊기지 않게)
     *  - 남의 파티: 모집 중(open)이고, 나와 호스트가 둘 다 위치 공유 중이며 PARTY_RANGE_M 안일 때만
     * viewerId 가 없으면(비로그인) 위치를 알 수 없어 남의 파티는 보이지 않는다.
     */
    @Transactional(readOnly = true) // host·members 가 LAZY 라 트랜잭션 안에서 읽는다
    public List<PartyResponse> getParties(Long viewerId) {
        Optional<LiveLocation> viewerLoc = liveLocations.find(viewerId);
        List<PartyResponse> result = new ArrayList<>();
        // 끝난 파티는 어느 화면도 쓰지 않아 DB 에서부터 뺀다. 코스 정보는 한 번에 모아 읽는다.
        List<Party> parties = partyRepository.findNotEndedWithMembers();
        Map<Long, RouteRepository.RouteSummary> routes = routeSummaries(parties);
        for (Party party : parties) {
            if (isKicked(party, viewerId)) continue; // 방장이 내보낸 파티는 근처에 있어도 다시 보이지 않는다
            Integer hostDist = hostDistanceM(viewerLoc, party);
            boolean nearbyOpen = "open".equals(party.getStatus()) && hostDist != null && hostDist <= PARTY_RANGE_M;
            if (!isMine(party, viewerId) && !nearbyOpen) continue;

            PartyResponse r = toResponse(party, routes);
            r.setHostDistanceM(hostDist);
            result.add(r);
        }
        return result;
    }

    /** 호스트이거나 참여 확정·신청 중인 파티 (거절된 신청은 내 파티가 아니다) */
    private boolean isMine(Party party, Long viewerId) {
        if (viewerId == null) return false;
        if (party.getHost().getId().equals(viewerId)) return true;
        return party.getMembers().stream().anyMatch(m ->
                m.getUser().getId().equals(viewerId)
                        && ("joined".equals(m.getStatus()) || "pending".equals(m.getStatus())));
    }

    private boolean isKicked(Party party, Long viewerId) {
        if (viewerId == null) return false;
        return party.getMembers().stream().anyMatch(m ->
                m.getUser().getId().equals(viewerId) && "kicked".equals(m.getStatus()));
    }

    /** 파티 1건 — 이미 id 를 아는 내 파티(지도·라이딩 화면)에서 쓴다. 거리 조건 없음 */
    @Transactional(readOnly = true)
    public Optional<PartyResponse> getParty(Long partyId) {
        return partyRepository.findById(partyId).map(this::toResponse);
    }

    /** 보는 사람 ↔ 호스트 거리(m). 둘 중 한 명이라도 위치 공유 중이 아니면 null */
    private Integer hostDistanceM(Optional<LiveLocation> viewerLoc, Party party) {
        if (viewerLoc.isEmpty()) return null;
        return liveLocations.find(party.getHost().getId())
                .map(hostLoc -> (int) Math.round(LiveLocationService.distanceM(viewerLoc.get(), hostLoc)))
                .orElse(null);
    }

    private PartyResponse toResponse(Party party) {
        return toResponse(party, routeSummaries(List.of(party)));
    }

    private PartyResponse toResponse(Party party, Map<Long, RouteRepository.RouteSummary> routes) {
        PartyResponse r = PartyResponse.from(party);
        RouteRepository.RouteSummary route = party.getRouteId() == null ? null : routes.get(party.getRouteId());
        if (route != null) {
            r.setRouteName(route.getRouteName());
            r.setFromLabel(route.getFromLabel());
            r.setToLabel(route.getToLabel());
            r.setDistanceKm(route.getDistanceKm());
        }
        return r;
    }

    // 파티들의 코스 요약을 한 번의 조회로 (경로 좌표는 읽지 않는다)
    private Map<Long, RouteRepository.RouteSummary> routeSummaries(List<Party> parties) {
        Set<Long> ids = parties.stream().map(Party::getRouteId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return routeRepository.findSummariesByIdIn(ids).stream()
                .collect(Collectors.toMap(RouteRepository.RouteSummary::getId, s -> s));
    }

    @Transactional
    public PartyResponse createParty(PartyRequest req) {
        User host = findUser(req.getHostId());

        Party party = new Party();
        party.setHost(host);
        party.setRouteId(req.getRouteId());
        party.setTitle(req.getTitle());
        party.setStartAt(req.getStartAt());
        party.setMaxMembers(req.getMaxMembers());

        Party saved = partyRepository.save(party);

        // 호스트는 자동으로 joined 상태로 참여
        PartyMember hostMember = new PartyMember();
        hostMember.setParty(saved);
        hostMember.setUser(host);
        hostMember.setStatus("joined");
        partyMemberRepository.save(hostMember);

        return toResponse(partyRepository.findById(saved.getId()).get());
    }

    /**
     * 매칭 신청이 수락됐을 때 호출 — 두 사람을 곧바로 joined 상태로 묶은 2인 파티를 만든다.
     * 일반 파티 생성(createParty)과 달리 신청/승인 과정 없이 둘 다 즉시 확정된다.
     */
    @Transactional
    public PartyResponse createMatchedParty(Long userAId, Long userBId) {
        User a = findUser(userAId);
        User b = findUser(userBId);

        Party party = new Party();
        party.setHost(a);
        party.setTitle(a.getName() + " & " + b.getName());
        party.setStartAt(java.time.LocalDateTime.now());
        party.setMaxMembers(2);
        party.setStatus("full");
        Party saved = partyRepository.save(party);

        PartyMember hostMember = new PartyMember();
        hostMember.setParty(saved);
        hostMember.setUser(a);
        hostMember.setStatus("joined");
        partyMemberRepository.save(hostMember);
        saved.getMembers().add(hostMember);

        PartyMember guestMember = new PartyMember();
        guestMember.setParty(saved);
        guestMember.setUser(b);
        guestMember.setStatus("joined");
        partyMemberRepository.save(guestMember);
        saved.getMembers().add(guestMember);

        // saved.getMembers() 를 직접 채워둔다 — findById 로 다시 읽어도 같은 영속성 컨텍스트라
        // 방금 저장한 멤버가 자동으로 안 보인다(1차 캐시가 기존 빈 컬렉션을 그대로 들고 있음).
        return toResponse(saved);
    }

    /**
     * 크루 라이딩 시작 — 팀장(호스트)과 인원 체크된 멤버로 바로 라이딩 중인 파티를 만든다.
     * 신청·승인 없이 전원 joined, 모집 끝(full), 라이딩 시작 시각까지 채워서 라이딩 화면이 바로 뜬다.
     */
    @Transactional
    public PartyResponse createCrewRideParty(Long leaderId, List<Long> memberIds, Long routeId, String title) {
        User leader = findUser(leaderId);

        Party party = new Party();
        party.setHost(leader);
        party.setRouteId(routeId);
        party.setTitle(title);
        party.setStartAt(java.time.LocalDateTime.now());
        party.setMaxMembers(memberIds.size() + 1);
        party.setStatus("full");
        party.setRideStartedAt(java.time.LocalDateTime.now());
        Party saved = partyRepository.save(party);

        List<Long> all = new ArrayList<>();
        all.add(leaderId);
        memberIds.stream().filter(id -> !id.equals(leaderId)).forEach(all::add);
        for (Long uid : all) {
            PartyMember m = new PartyMember();
            m.setParty(saved);
            m.setUser(findUser(uid));
            m.setStatus("joined");
            partyMemberRepository.save(m);
            saved.getMembers().add(m);
        }
        return toResponse(saved);
    }

    /** 파티가 끝났는지 (없는 파티도 끝난 것으로 본다) — 크루 라이딩 진행 여부 판단용 */
    public boolean isPartyEnded(Long partyId) {
        if (partyId == null) return true;
        return partyRepository.findById(partyId).map(p -> "ended".equals(p.getStatus())).orElse(true);
    }

    /** 지금 라이딩 중인 파티인지 (끝나지 않았고 라이딩 시작 시각이 있다) — 크루 라이딩 화면 자동 열기 판단용 */
    public boolean isRiding(Long partyId) {
        if (partyId == null) return false;
        return partyRepository.findById(partyId)
                .map(p -> !"ended".equals(p.getStatus()) && p.getRideStartedAt() != null)
                .orElse(false);
    }

    /** 종료되지 않은 파티에 이미 참여 중인지 — 매칭 신청 가능 여부 검증에 쓴다 */
    public boolean isInActiveParty(Long userId) {
        return partyMemberRepository.existsByUser_IdAndStatusAndParty_StatusNot(userId, "joined", "ended");
    }

    @Transactional
    public PartyResponse apply(Long partyId, Long userId) {
        Party party = findParty(partyId);
        User user = findUser(userId);

        Optional<PartyMember> existing = partyMemberRepository.findByPartyAndUser(party, user);
        if (existing.isPresent()) {
            throw new RuntimeException("kicked".equals(existing.get().getStatus())
                    ? "방장이 내보낸 파티라 다시 신청할 수 없어요."
                    : "이미 신청했습니다.");
        }
        if (!"open".equals(party.getStatus())) {
            throw new RuntimeException("신청할 수 없는 파티입니다.");
        }
        // 근처(호스트와 PARTY_RANGE_M 안)에서만 신청할 수 있다 — 목록에서 숨기는 것만으로는
        // API 를 직접 부르는 경우를 막지 못해서 여기서 한 번 더 확인한다.
        LiveLocation myLoc = liveLocations.find(userId)
                .orElseThrow(() -> new RuntimeException("위치 공유를 켜야 신청할 수 있어요."));
        LiveLocation hostLoc = liveLocations.find(party.getHost().getId())
                .orElseThrow(() -> new RuntimeException("호스트가 지금 위치 공유 중이 아니라 신청할 수 없어요."));
        long dist = Math.round(LiveLocationService.distanceM(myLoc, hostLoc));
        if (dist > PARTY_RANGE_M) {
            throw new RuntimeException("호스트와 " + PARTY_RANGE_M + "m 안에 있어야 신청할 수 있어요. (지금 약 " + dist + "m)");
        }

        PartyMember member = new PartyMember();
        member.setParty(party);
        member.setUser(user);
        member.setStatus("pending");
        partyMemberRepository.save(member);

        return toResponse(partyRepository.findById(partyId).get());
    }

    // 참가 요청 수락 — 방장만, 대기 중(pending)인 신청만
    @Transactional
    public PartyResponse approve(Long partyId, Long userId, Long hostId) {
        Party party = findParty(partyId);
        requireHost(party, hostId, "방장만 참가 요청을 처리할 수 있습니다");
        User user = findUser(userId);

        PartyMember member = partyMemberRepository.findByPartyAndUser(party, user)
                .orElseThrow(() -> new RuntimeException("신청 내역 없음"));
        if (!"pending".equals(member.getStatus())) {
            throw new RuntimeException("대기 중인 신청이 아닙니다.");
        }

        long joinedCount = party.getMembers().stream()
                .filter(m -> "joined".equals(m.getStatus())).count();

        if (joinedCount >= party.getMaxMembers()) {
            throw new RuntimeException("정원이 초과되었습니다.");
        }

        member.setStatus("joined");
        partyMemberRepository.save(member);

        // 정원 차면 status → full
        if (joinedCount + 1 >= party.getMaxMembers()) {
            party.setStatus("full");
            partyRepository.save(party);
        }

        return toResponse(partyRepository.findById(partyId).get());
    }

    /**
     * 파티 삭제 — 호스트만.
     * Party.members 가 cascade=ALL + orphanRemoval 이라 참가 기록(party_members)도 함께 지워진다.
     * 이미 저장된 주행 기록(ride_records.party_id)은 실제로 있었던 일이므로 남긴다.
     */
    @Transactional
    public void delete(Long partyId, Long userId) {
        Party party = findParty(partyId);
        if (!party.getHost().getId().equals(userId)) {
            throw new SecurityException("호스트만 삭제할 수 있습니다");
        }
        partyRepository.delete(party);
    }

    /**
     * 호스트가 라이딩을 시작했다고 표시한다.
     * 참가자 지도가 이 값을 감지해 같이 출발한다(각자 기기가 자기 거리를 측정).
     */
    @Transactional
    public PartyResponse startRide(Long partyId, Long userId) {
        Party party = findParty(partyId);
        if (!party.getHost().getId().equals(userId)) {
            throw new SecurityException("호스트만 라이딩을 시작할 수 있습니다");
        }
        party.setRideStartedAt(java.time.LocalDateTime.now());
        partyRepository.save(party);
        return toResponse(party);
    }

    /**
     * 라이딩만 종료한다 — 파티(대기방)는 그대로 열어둔 채 rideStartedAt 만 지운다.
     * 단, 크루 라이딩 파티는 파티까지 끝낸다(ended).
     * 호스트만 할 수 있다. 일반 파티 자체를 끝내려면 end()/delete() 를 쓴다.
     */
    @Transactional
    public PartyResponse stopRide(Long partyId, Long userId) {
        Party party = findParty(partyId);
        if (!party.getHost().getId().equals(userId)) {
            throw new SecurityException("호스트만 라이딩을 종료할 수 있습니다");
        }
        party.setRideStartedAt(null);
        // 크루 라이딩 파티는 대기방으로 돌아가지 않는다 — 라이딩 종료가 곧 그 크루 라이딩의 끝이다.
        // (대기방을 남겨 두면 크루 라이딩이 아직 진행 중으로 보여 새로고침할 때 라이딩 화면이 다시 뜬다)
        if (crewEventRepository.existsByPartyId(partyId)) {
            party.setStatus("ended");
        }
        partyRepository.save(party);
        return toResponse(party);
    }

    /**
     * 라이딩 종료 → 파티를 끝낸 것으로 표시한다.
     * 호스트만 할 수 있다. 종료된 파티는 목록에 남지만 신청을 받지 않는다.
     */
    @Transactional
    public PartyResponse end(Long partyId, Long userId) {
        Party party = findParty(partyId);

        if (!party.getHost().getId().equals(userId)) {
            throw new SecurityException("호스트만 파티를 종료할 수 있습니다");
        }
        party.setStatus("ended");
        partyRepository.save(party);
        return toResponse(party);
    }

    /**
     * 참가자가 스스로 준비 상태를 표시한다(대기방 화면용). 호스트도 자기 준비 상태를 켤 수 있다.
     */
    @Transactional
    public PartyResponse setReady(Long partyId, Long userId, boolean ready) {
        Party party = findParty(partyId);
        User user = findUser(userId);

        PartyMember member = partyMemberRepository.findByPartyAndUser(party, user)
                .orElseThrow(() -> new RuntimeException("참가 내역 없음"));

        member.setReady(ready);
        partyMemberRepository.save(member);

        return toResponse(partyRepository.findById(partyId).get());
    }

    /**
     * 참가자가 스스로 파티를 나간다. 호스트는 나갈 수 없다(대신 파티 삭제).
     * 정원이 차서 'full'이었다면, 자리가 났으니 다시 신청 받을 수 있게 'open'으로 되돌린다.
     */
    @Transactional
    public PartyResponse leave(Long partyId, Long userId) {
        Party party = findParty(partyId);
        User user = findUser(userId);

        if (party.getHost().getId().equals(userId)) {
            throw new RuntimeException("호스트는 파티를 나갈 수 없습니다. 파티 삭제를 이용하세요.");
        }

        PartyMember member = partyMemberRepository.findByPartyAndUser(party, user)
                .orElseThrow(() -> new RuntimeException("참가 내역 없음"));

        boolean wasJoined = "joined".equals(member.getStatus());
        partyMemberRepository.delete(member);

        if (wasJoined && "full".equals(party.getStatus())) {
            party.setStatus("open");
            partyRepository.save(party);
        }

        return toResponse(partyRepository.findById(partyId).get());
    }

    // 참가 요청 거절 — 방장만, 대기 중(pending)인 신청만 (참가 중인 팀원은 kick 으로 내보낸다)
    @Transactional
    public PartyResponse reject(Long partyId, Long userId, Long hostId) {
        Party party = findParty(partyId);
        requireHost(party, hostId, "방장만 참가 요청을 처리할 수 있습니다");
        User user = findUser(userId);

        PartyMember member = partyMemberRepository.findByPartyAndUser(party, user)
                .orElseThrow(() -> new RuntimeException("신청 내역 없음"));
        if (!"pending".equals(member.getStatus())) {
            throw new RuntimeException("대기 중인 신청이 아닙니다.");
        }

        member.setStatus("rejected");
        partyMemberRepository.save(member);

        return toResponse(partyRepository.findById(partyId).get());
    }

    /**
     * 팀원 내보내기(강퇴) — 방장만. 기록은 kicked 로 남겨 같은 파티에 다시 신청하지 못하게 한다.
     * 정원이 차서 'full' 이었다면 자리가 났으니 다시 'open' 으로 되돌린다.
     */
    @Transactional
    public PartyResponse kick(Long partyId, Long targetUserId, Long hostId) {
        Party party = findParty(partyId);
        requireHost(party, hostId, "방장만 팀원을 내보낼 수 있습니다");
        if (party.getHost().getId().equals(targetUserId)) {
            throw new RuntimeException("방장은 내보낼 수 없습니다.");
        }
        PartyMember member = partyMemberRepository.findByPartyAndUser(party, findUser(targetUserId))
                .orElseThrow(() -> new RuntimeException("참가 내역 없음"));
        if (!"joined".equals(member.getStatus())) {
            throw new RuntimeException("참가 중인 팀원만 내보낼 수 있습니다.");
        }

        member.setStatus("kicked");
        member.setReady(false);
        partyMemberRepository.save(member);
        if ("full".equals(party.getStatus())) {
            party.setStatus("open");
            partyRepository.save(party);
        }
        return toResponse(partyRepository.findById(partyId).get());
    }

    /**
     * 파티 코스 바꾸기 — 방장만, 방장이 직접 만든 코스 중에서만, 라이딩 시작 전에만.
     * (달리는 도중에 코스가 바뀌면 팀원 화면이 혼란스러워진다)
     */
    @Transactional
    public PartyResponse changeRoute(Long partyId, Long routeId, Long hostId) {
        Party party = findParty(partyId);
        requireHost(party, hostId, "방장만 코스를 바꿀 수 있습니다");
        if ("ended".equals(party.getStatus())) {
            throw new RuntimeException("끝난 파티의 코스는 바꿀 수 없어요.");
        }
        if (party.getRideStartedAt() != null) {
            throw new RuntimeException("라이딩 중에는 코스를 바꿀 수 없어요. 라이딩을 마친 뒤 바꿔 주세요.");
        }
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new RuntimeException("코스를 찾을 수 없습니다."));
        if (!hostId.equals(route.getUserId())) {
            throw new RuntimeException("방장이 만든 코스만 고를 수 있어요.");
        }

        party.setRouteId(routeId);
        partyRepository.save(party);
        return toResponse(party);
    }

    /** 방장이 나를 내보낸 아직 안 끝난 파티들 — 도크가 "내보내졌어요" 안내를 띄우는 데 쓴다 */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> kickedParties(Long userId) {
        return partyMemberRepository.findKickedParties(userId).stream()
                .map(row -> Map.<String, Object>of("partyId", row[0], "title", row[1] == null ? "" : row[1]))
                .toList();
    }

    private void requireHost(Party party, Long userId, String message) {
        if (userId == null || !party.getHost().getId().equals(userId)) {
            throw new SecurityException(message);
        }
    }

    private Party findParty(Long id) {
        return partyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("파티를 찾을 수 없습니다."));
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    }
}
