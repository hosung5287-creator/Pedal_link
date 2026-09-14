package com.example.demo.service;

import com.example.demo.dto.CrewRequest;
import com.example.demo.dto.CrewResponse;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CrewService {

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
        if (req.getJoinPolicy() != null) crew.setJoinPolicy(req.getJoinPolicy());

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
            throw new RuntimeException("리더는 크루를 나갈 수 없습니다. 크루 삭제를 이용하세요.");
        }

        CrewMember member = crewMemberRepository.findByCrewAndUser(crew, user)
                .orElseThrow(() -> new RuntimeException("가입 내역이 없습니다."));
        crewMemberRepository.delete(member);
        crew.getMembers().remove(member);

        return CrewResponse.from(crew);
    }

    @Transactional
    public CrewResponse approve(Long crewId, Long userId) {
        Crew crew = findCrew(crewId);
        User user = findUser(userId);

        CrewMember member = crewMemberRepository.findByCrewAndUser(crew, user)
                .orElseThrow(() -> new RuntimeException("신청 내역이 없습니다."));
        member.setStatus("joined");
        crewMemberRepository.save(member);

        return CrewResponse.from(crew);
    }

    @Transactional
    public CrewResponse reject(Long crewId, Long userId) {
        Crew crew = findCrew(crewId);
        User user = findUser(userId);

        CrewMember member = crewMemberRepository.findByCrewAndUser(crew, user)
                .orElseThrow(() -> new RuntimeException("신청 내역이 없습니다."));
        crewMemberRepository.delete(member);
        crew.getMembers().remove(member);

        return CrewResponse.from(crew);
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
