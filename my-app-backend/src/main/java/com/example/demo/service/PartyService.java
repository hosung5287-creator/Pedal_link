package com.example.demo.service;

import com.example.demo.dto.PartyRequest;
import com.example.demo.dto.PartyResponse;
import com.example.demo.entity.Party;
import com.example.demo.entity.PartyMember;
import com.example.demo.entity.User;
import com.example.demo.repository.PartyMemberRepository;
import com.example.demo.repository.PartyRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PartyService {

    private final PartyRepository partyRepository;
    private final PartyMemberRepository partyMemberRepository;
    private final UserRepository userRepository;
    private final RouteRepository routeRepository;

    public List<PartyResponse> getParties() {
        return partyRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private PartyResponse toResponse(Party party) {
        PartyResponse r = PartyResponse.from(party);
        if (party.getRouteId() != null) {
            routeRepository.findById(party.getRouteId()).ifPresent(route -> {
                r.setRouteName(route.getRouteName());
                r.setFromLabel(route.getFromLabel());
                r.setToLabel(route.getToLabel());
                r.setDistanceKm(route.getDistanceKm());
            });
        }
        return r;
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

    @Transactional
    public PartyResponse apply(Long partyId, Long userId) {
        Party party = findParty(partyId);
        User user = findUser(userId);

        if (partyMemberRepository.existsByPartyAndUser(party, user)) {
            throw new RuntimeException("이미 신청했습니다.");
        }
        if (!"open".equals(party.getStatus())) {
            throw new RuntimeException("신청할 수 없는 파티입니다.");
        }

        PartyMember member = new PartyMember();
        member.setParty(party);
        member.setUser(user);
        member.setStatus("pending");
        partyMemberRepository.save(member);

        return toResponse(partyRepository.findById(partyId).get());
    }

    @Transactional
    public PartyResponse approve(Long partyId, Long userId) {
        Party party = findParty(partyId);
        User user = findUser(userId);

        PartyMember member = partyMemberRepository.findByPartyAndUser(party, user)
                .orElseThrow(() -> new RuntimeException("신청 내역 없음"));

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

    @Transactional
    public PartyResponse reject(Long partyId, Long userId) {
        Party party = findParty(partyId);
        User user = findUser(userId);

        PartyMember member = partyMemberRepository.findByPartyAndUser(party, user)
                .orElseThrow(() -> new RuntimeException("신청 내역 없음"));

        member.setStatus("rejected");
        partyMemberRepository.save(member);

        return toResponse(partyRepository.findById(partyId).get());
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
