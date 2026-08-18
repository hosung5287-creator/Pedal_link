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
