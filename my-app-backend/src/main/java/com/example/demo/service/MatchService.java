package com.example.demo.service;

import com.example.demo.dto.PartyResponse;
import com.example.demo.entity.MatchRequest;
import com.example.demo.entity.User;
import com.example.demo.repository.MatchRequestRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MatchService {

    private static final long EXPIRE_MINUTES = 5;

    private final MatchRequestRepository matchRequestRepository;
    private final UserRepository userRepository;
    private final PartyService partyService;
    // 시연 모드일 때만 있다 — 크루 라이딩 중인 발표자에게 오는 가상 라이더의 매칭은 그 라이딩에 합류시킨다
    private final ObjectProvider<DemoService> demo;

    @Transactional
    public MatchRequest send(Long fromUserId, Long toUserId) {
        if (fromUserId == null || toUserId == null) {
            throw new RuntimeException("잘못된 요청입니다.");
        }
        if (fromUserId.equals(toUserId)) {
            throw new RuntimeException("자기 자신에게는 신청할 수 없습니다.");
        }
        expireOld();

        // 시연의 라이딩 합류 매칭은 받는 쪽(발표자)이 라이딩 파티 안에 있는 것이 정상이다
        boolean rideJoin = isDemoRideJoin(fromUserId, toUserId);
        if (!rideJoin && partyService.isInActiveParty(fromUserId)) {
            throw new RuntimeException("이미 파티에 속해 있어서 신청할 수 없어요.");
        }
        if (!rideJoin && partyService.isInActiveParty(toUserId)) {
            throw new RuntimeException("상대가 이미 다른 파티에 속해 있어요.");
        }
        matchRequestRepository.findByFromUser_IdAndToUser_IdAndStatus(fromUserId, toUserId, "pending")
                .ifPresent(r -> { throw new RuntimeException("이미 신청했어요. 상대의 응답을 기다려주세요."); });

        User from = findUser(fromUserId);
        User to = findUser(toUserId);

        MatchRequest req = new MatchRequest();
        req.setFromUser(from);
        req.setToUser(to);
        return matchRequestRepository.save(req);
    }

    @Transactional
    public PartyResponse accept(Long requestId, Long userId) {
        MatchRequest req = findRequest(requestId);
        if (!req.getToUser().getId().equals(userId)) {
            throw new SecurityException("본인에게 온 신청만 수락할 수 있어요.");
        }
        if (isExpired(req)) {
            req.setStatus("expired");
            matchRequestRepository.save(req);
            throw new RuntimeException("신청이 만료됐어요.");
        }
        if (!"pending".equals(req.getStatus())) {
            throw new RuntimeException("이미 처리된 신청이에요.");
        }

        Long fromId = req.getFromUser().getId();
        PartyResponse party = isDemoRideJoin(fromId, userId)
                // 시연 — 새 2인 파티 대신 발표자가 달리고 있는 크루 라이딩에 넣는다 (크루 가입까지)
                ? partyService.getParty(demo.getObject().joinRideByMatch(fromId, userId)).orElseThrow()
                : partyService.createMatchedParty(fromId, userId);
        req.setStatus("accepted");
        req.setPartyId(party.getId());
        matchRequestRepository.save(req);
        return party;
    }

    @Transactional
    public void reject(Long requestId, Long userId) {
        MatchRequest req = findRequest(requestId);
        if (!req.getToUser().getId().equals(userId)) {
            throw new SecurityException("본인에게 온 신청만 거절할 수 있어요.");
        }
        if (!"pending".equals(req.getStatus())) {
            throw new RuntimeException("이미 처리된 신청이에요.");
        }
        req.setStatus("rejected");
        matchRequestRepository.save(req);
        DemoService d = demo.getIfAvailable();
        if (d != null) d.matchRejected(req.getFromUser().getId(), userId);   // 거절당한 가상 라이더는 그냥 지나간다
    }

    private boolean isDemoRideJoin(Long fromUserId, Long toUserId) {
        DemoService d = demo.getIfAvailable();
        return d != null && d.isRideJoinMatch(fromUserId, toUserId);
    }

    @Transactional
    public List<MatchRequest> listIncoming(Long userId) {
        expireOld();
        return matchRequestRepository.findByToUser_IdAndStatusOrderByCreatedAtDesc(userId, "pending");
    }

    /**
     * 내가 보낸 신청 — pending(버튼 "신청 중" 표시용) + accepted(수락되면 프론트가 이걸 보고
     * 신청한 사람도 자동으로 파티 라이딩으로 전환한다. 수락자만 서버에서 알 수 있는 게 아니라
     * 신청자 쪽도 폴링으로 알아채야 하기 때문에 accepted 도 같이 내려준다).
     */
    @Transactional
    public List<MatchRequest> listOutgoing(Long userId) {
        expireOld();
        return matchRequestRepository.findByFromUser_IdAndStatusInOrderByCreatedAtDesc(userId, List.of("pending", "accepted"));
    }

    private boolean isExpired(MatchRequest req) {
        return req.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(EXPIRE_MINUTES));
    }

    // 5분 지난 pending 신청을 만료 처리 — 별도 스케줄러 없이 조회/신청 시점마다 훑는다
    private void expireOld() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(EXPIRE_MINUTES);
        List<MatchRequest> stale = matchRequestRepository.findByStatusAndCreatedAtBefore("pending", cutoff);
        if (stale.isEmpty()) return;
        stale.forEach(r -> r.setStatus("expired"));
        matchRequestRepository.saveAll(stale);
    }

    private MatchRequest findRequest(Long id) {
        return matchRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("신청을 찾을 수 없습니다."));
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    }
}
