package com.example.demo.controller;

import com.example.demo.dto.MatchRequestResponse;
import com.example.demo.service.CrewRideService;
import com.example.demo.service.MatchService;
import com.example.demo.service.PartyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

// 로그인한 화면이 몇 초마다 확인하는 "내 상태"를 한 번에 — 파티 도크가 받은·보낸 매칭 신청,
// 크루 라이딩 자동 이동을 따로따로 5초마다 요청하던 것(3개)을 하나로 합쳤다.
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final MatchService matchService;
    private final CrewRideService crewRideService;
    private final PartyService partyService;

    // { incomingMatches: [...], outgoingMatches: [...], crewRiding: { eventId, partyId } | null,
    //   kickedParties: [{ partyId, title }] — 방장이 나를 내보낸(아직 안 끝난) 파티 }
    @GetMapping("/status")
    public Map<String, Object> status(@RequestParam Long userId) {
        Map<String, Object> r = new HashMap<>();
        r.put("incomingMatches", matchService.listIncoming(userId).stream().map(MatchRequestResponse::from).toList());
        r.put("outgoingMatches", matchService.listOutgoing(userId).stream().map(MatchRequestResponse::from).toList());
        r.put("crewRiding", crewRideService.findMyRiding(userId).orElse(null));
        r.put("kickedParties", partyService.kickedParties(userId));
        return r;
    }
}
