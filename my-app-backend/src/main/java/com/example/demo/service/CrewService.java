package com.example.demo.service;

import com.example.demo.dto.CrewRequest;
import com.example.demo.dto.CrewResponse;
import com.example.demo.dto.CrewSettingsRequest;
import com.example.demo.entity.Crew;
import com.example.demo.entity.CrewMember;
import com.example.demo.entity.User;
import com.example.demo.repository.CrewMemberRepository;
import com.example.demo.repository.CrewRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CrewService {

    // approval(신청 → 리더 수락) | open(바로 가입) | closed(신청 안 받음)
    private static final Set<String> JOIN_POLICIES = Set.of("approval", "open", "closed");

    private final CrewRepository crewRepository;
    private final CrewMemberRepository crewMemberRepository;
    private final UserRepository userRepository;

    public List<CrewResponse> getCrews() {
        return crewRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(CrewResponse::from).collect(Collectors.toList());
    }

    public CrewResponse getCrew(Long id) {
        return CrewResponse.from(findCrew(id));
    }

    @Transactional
    public CrewResponse createCrew(CrewRequest req) {
        User leader = findUser(req.getLeaderId());

        Crew crew = new Crew();
        crew.setLeader(leader);
        crew.setName(req.getName());
        crew.setRegion(req.getRegion());
        crew.setScheduleText(req.getScheduleText());
        crew.setDescription(req.getDescription());
        crew.setTag(req.getTag());
        crew.setCoverPhoto(req.getCoverPhoto());
        if (req.getJoinPolicy() != null) crew.setJoinPolicy(checkJoinPolicy(req.getJoinPolicy()));

        Crew saved = crewRepository.save(crew);

        // 리더는 자동으로 joined 상태로 참여
        CrewMember leaderMember = new CrewMember();
        leaderMember.setCrew(saved);
        leaderMember.setUser(leader);
        leaderMember.setRole("leader");
        leaderMember.setStatus("joined");
        leaderMember.setAttend("yes");
        crewMemberRepository.save(leaderMember);
        saved.getMembers().add(leaderMember);

        return CrewResponse.from(saved);
    }

    @Transactional
    public CrewResponse join(Long crewId, Long userId) {
        Crew crew = findCrew(crewId);
        User user = findUser(userId);

        if (crewMemberRepository.existsByCrewAndUser(crew, user)) {
            throw new RuntimeException("이미 신청했거나 가입한 크루입니다.");
        }
        if ("closed".equals(crew.getJoinPolicy())) {
            throw new RuntimeException("지금은 가입 신청을 받지 않는 크루입니다.");
        }

        CrewMember member = new CrewMember();
        member.setCrew(crew);
        member.setUser(user);
        member.setRole("member");
        member.setStatus("open".equals(crew.getJoinPolicy()) ? "joined" : "pending");
        crewMemberRepository.save(member);
        crew.getMembers().add(member);

        return CrewResponse.from(crew);
    }

    @Transactional
    public CrewResponse leave(Long crewId, Long userId) {
        Crew crew = findCrew(crewId);
        User user = findUser(userId);

        if (crew.getLeader().getId().equals(userId)) {
            throw new RuntimeException("리더는 크루를 나갈 수 없습니다.");
        }

        CrewMember member = crewMemberRepository.findByCrewAndUser(crew, user)
                .orElseThrow(() -> new RuntimeException("가입 내역이 없습니다."));
        crewMemberRepository.delete(member);
        crew.getMembers().remove(member);

        // 아직 출발 전인 크루 라이딩의 초대·토큰도 같이 지운다 — 나간 사람이 인원 체크 목록에 남지 않게.
        // 이미 출발한(riding) 라이딩은 파티로 넘어갔으므로 건드리지 않는다.
        crew.getEvents().stream()
                .filter(e -> "recruiting".equals(e.getStatus()) || "checking".equals(e.getStatus()))
                .forEach(e -> e.getMembers().removeIf(m -> m.getUser().getId().equals(userId)));

        return CrewResponse.from(crew);
    }

    // 크루 설정 — 지금은 가입 방식(신청 받기)만. 이미 들어온 대기 신청은 그대로 두고 리더가 따로 처리한다.
    @Transactional
    public CrewResponse updateSettings(Long crewId, CrewSettingsRequest req) {
        Crew crew = findCrew(crewId);
        if (req.getUserId() == null || !crew.getLeader().getId().equals(req.getUserId())) {
            throw new RuntimeException("리더만 크루 설정을 바꿀 수 있습니다.");
        }
        if (req.getJoinPolicy() != null) crew.setJoinPolicy(checkJoinPolicy(req.getJoinPolicy()));

        return CrewResponse.from(crewRepository.save(crew));
    }

    // 가입 요청 수락 — 리더만, 대기 중(pending)인 신청만
    @Transactional
    public CrewResponse approve(Long crewId, Long userId, Long leaderId) {
        Crew crew = findCrew(crewId);
        CrewMember member = pendingRequest(crew, userId, leaderId);
        member.setStatus("joined");
        crewMemberRepository.save(member);

        return CrewResponse.from(crew);
    }

    // 가입 요청 거절 — 리더만, 대기 중(pending)인 신청만 (이미 가입한 멤버를 내보내는 데 쓰이지 않게)
    @Transactional
    public CrewResponse reject(Long crewId, Long userId, Long leaderId) {
        Crew crew = findCrew(crewId);
        CrewMember member = pendingRequest(crew, userId, leaderId);
        crewMemberRepository.delete(member);
        crew.getMembers().remove(member);

        return CrewResponse.from(crew);
    }

    private CrewMember pendingRequest(Crew crew, Long userId, Long leaderId) {
        if (leaderId == null || !crew.getLeader().getId().equals(leaderId)) {
            throw new RuntimeException("리더만 가입 요청을 처리할 수 있습니다.");
        }
        CrewMember member = crewMemberRepository.findByCrewAndUser(crew, findUser(userId))
                .orElseThrow(() -> new RuntimeException("신청 내역이 없습니다."));
        if (!"pending".equals(member.getStatus())) {
            throw new RuntimeException("대기 중인 신청이 아닙니다.");
        }
        return member;
    }

    private static String checkJoinPolicy(String policy) {
        if (!JOIN_POLICIES.contains(policy)) {
            throw new RuntimeException("가입 방식이 올바르지 않습니다.");
        }
        return policy;
    }

    private Crew findCrew(Long id) {
        return crewRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("크루를 찾을 수 없습니다."));
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    }
}
