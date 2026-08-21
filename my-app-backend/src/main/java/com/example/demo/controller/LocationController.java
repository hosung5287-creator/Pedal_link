package com.example.demo.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.entity.Party;
import com.example.demo.entity.PartyMember;
import com.example.demo.repository.PartyRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LocationController {

    private final PartyRepository partyRepository;

    private final Map<Long, LiveLocation> locations = new ConcurrentHashMap<>();
    private static final long STALE_MS = 15_000;

    public record LiveLocation(Long userId, String name, double lat, double lng, long updatedAt) {}
    public record LocationReport(Long userId, String name, Double lat, Double lng) {}

    @PostMapping("/locations")
    public ResponseEntity<?> report(@RequestBody LocationReport req) {
        if (req.userId() == null || req.lat() == null || req.lng() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "userId, lat, lng는 필수입니다"));
        }
        String name = (req.name() == null || req.name().isBlank()) ? "익명" : req.name();
        locations.put(req.userId(),
                new LiveLocation(req.userId(), name, req.lat(), req.lng(), System.currentTimeMillis()));
        return ResponseEntity.ok(Map.of("message", "ok"));
    }

    /**
     * 나를 뺀 접속자 위치.
     *
     * partyId 를 주면 그 파티의 참여 확정(joined) 멤버로만 좁힌다.
     * 같이 타기로 한 사람만 지도에 뜨고, 무관한 접속자에게 내 위치가 섞이지 않는다.
     */
    // members 가 LAZY 라서 트랜잭션 안에서 읽어야 한다 (open-in-view 에 기대지 않도록 명시)
    @Transactional(readOnly = true)
    @GetMapping("/locations")
    public ResponseEntity<List<LiveLocation>> others(@RequestParam Long userId,
                                                     @RequestParam(required = false) Long partyId) {
        long now = System.currentTimeMillis();
        locations.values().removeIf(l -> now - l.updatedAt() > STALE_MS);

        Set<Long> allowed = (partyId == null) ? null : joinedMemberIds(partyId);

        List<LiveLocation> result = locations.values().stream()
                .filter(l -> !l.userId().equals(userId))
                .filter(l -> allowed == null || allowed.contains(l.userId()))
                .toList();
        return ResponseEntity.ok(result);
    }

    /** 파티의 참여 확정 멤버 userId 목록. 없는 파티면 빈 집합(= 아무도 안 보임). */
    private Set<Long> joinedMemberIds(Long partyId) {
        return partyRepository.findById(partyId)
                .map(Party::getMembers)
                .map(members -> members.stream()
                        .filter(m -> "joined".equals(m.getStatus()))
                        .map(m -> m.getUser().getId())
                        .collect(Collectors.toSet()))
                .orElse(Set.of());
    }
}
