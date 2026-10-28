package com.example.demo.service;

import com.example.demo.dto.CrewRequest;
import com.example.demo.entity.Crew;
import com.example.demo.entity.CrewEvent;
import com.example.demo.entity.CrewEventMember;
import com.example.demo.entity.CrewMember;
import com.example.demo.entity.Party;
import com.example.demo.entity.Route;
import com.example.demo.entity.User;
import com.example.demo.repository.CrewEventMemberRepository;
import com.example.demo.repository.CrewEventRepository;
import com.example.demo.repository.CrewMemberRepository;
import com.example.demo.repository.CrewRepository;
import com.example.demo.repository.PartyRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.LineString;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 시연 모드 — 자전거를 실제로 타지 않고 크루 라이딩을 처음부터 끝까지 보여주기 위한 가상 라이더 3명.
 *  1) [시연 준비] → 라이더 계정(민수·지영·현우)을 만들어 발표자가 팀장인 크루(가장 최근 것)에 넣는다.
 *     이끄는 크루가 없으면 "시연 크루"를 새로 만든다.
 *  2) 발표자가 이번주 라이딩을 열면 초대받은 라이더가 한 명씩 참여하고 출발 지점 근처에 선다
 *     (현우는 코스 뒤쪽에서 오는 중 — 220m 안이라 인원 체크는 된다)
 *  3) 라이딩을 시작하면 발표자의 가상 위치가 코스를 따라 약 20km/h 로 가고, 라이더가 대열로 따라간다
 *  4) 시연 패널: 민수 이탈 → 민수 복귀, 현우 합류(늦게 출발해 뒤따라오던 현우가 따라붙는다), 도착 지점으로
 *     복귀·합류하는 동안은 그룹이 멈춰 기다린다 — 뒤에서 따라잡기만 하면 수십 초가 걸려서
 *
 * 라이더 위치는 서버가 LiveLocationService 에 바로 넣는다 (실제 기기가 보낸 위치와 같은 곳).
 * 라이더 계정으로 다른 기기에서 로그인해도 그 기기가 보낸 위치는 받지 않는다 — 위치는 서버 한 곳에서만 나온다.
 * 발표자 위치는 넣지 않는다 — 발표자 화면이 /api/demo/position 을 GPS 대신 읽어 평소처럼 보낸다.
 * 상태는 메모리에만 둔다. 서버를 다시 켜면 발표자 화면의 첫 요청 때 라이더가 들어 있는 크루로 다시 만든다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "demo", name = "enabled", havingValue = "true")
public class DemoService {

    public static final String DEMO_DOMAIN = "@pedallink.demo";
    public static final String DEMO_PASSWORD = "demo1234!";
    public static final String CREW_NAME = "시연 크루";

    private static final double CRUISE_MS = 5.65;      // 그룹 속도 약 20km/h
    private static final double STRAY_MS = 9.7;        // 이탈하며 반대쪽으로 갈 때 약 35km/h
    private static final double CATCH_UP_MS = 11.5;    // 복귀·합류하며 따라붙을 때 약 41km/h
    private static final double AWAY_HOLD_M = 262;     // 라이딩 화면의 이탈 기준(250m) 바깥 — 여기까지 가면 그 거리를 유지한다
    private static final double REGROUP_M = 30;        // 따라붙는 라이더가 자기 자리에서 이만큼 안으로 오면 그룹이 다시 출발한다
    private static final double LATE_GAP_M = 150;      // 늦게 출발한 현우가 선두 뒤로 떨어져 따라오는 거리
    private static final double SKIP_LEFT_M = 150;     // [도착 지점으로] — 도착까지 이만큼 남기고 옮긴다
    private static final double JUMP_M = 40;           // 한 번(1초)에 이보다 많이 움직이면 순간 이동으로 본다 (가장 빠른 라이더도 12m 안팎)
    private static final long HIDE_MS = 5000;          // 라이딩 중 순간 이동하면 그 사람 위치를 잠깐 내린다 — 다른 화면이 순간 속도를 엉뚱하게 계산하지 않게
    private static final long SYNC_MS = 2000;          // 라이딩 단계(DB)를 다시 읽는 간격
    private static final double M_PER_DEG = 111_320;

    // gap: 대열에서 선두 뒤 거리(m), side: 코스 중심선에서 옆으로 비킨 거리(m)
    private record RiderDef(String key, String name, String email, double gap, double side) {}

    private static final List<RiderDef> RIDERS = List.of(
            new RiderDef("minsu", "민수", "minsu" + DEMO_DOMAIN, 15, 1.5),
            new RiderDef("jiyoung", "지영", "jiyoung" + DEMO_DOMAIN, 28, -1.5),
            new RiderDef("hyunwoo", "현우", "hyunwoo" + DEMO_DOMAIN, 40, 1.0));

    /** 화면이 GPS 대신 받는 가상 위치. t 는 측정 시각(ms), jumps 는 순간 이동 횟수 (바뀌면 화면이 그 이동을 거리로 세지 않는다) */
    public record Fix(double lat, double lng, double heading, long t, int jumps) {}

    private enum Phase { IDLE, WAITING, RIDING, DONE }
    private enum Mode { FORMATION, LATE, STRAY, AWAY, RETURNING, JOINING }

    private final UserRepository userRepository;
    private final CrewRepository crewRepository;
    private final CrewMemberRepository crewMemberRepository;
    private final CrewEventRepository eventRepository;
    private final CrewEventMemberRepository eventMemberRepository;
    private final PartyRepository partyRepository;
    private final RouteRepository routeRepository;
    private final CrewService crewService;
    private final CrewRideService crewRideService;
    private final LiveLocationService liveLocations;
    private final BCryptPasswordEncoder passwordEncoder;

    // 시연 패널을 띄울 발표자 계정 (콤마로 여러 개, 비우면 가상 라이더가 아닌 모든 계정)
    @Value("${demo.presenter-emails:}")
    private String presenterEmails;

    // 한 번에 한 발표자만 — 라이더 계정 3개를 같이 쓰기 때문
    private volatile Session current;
    private final Map<Long, Fix> fixes = new ConcurrentHashMap<>();
    private final Map<Long, Long> missUntil = new ConcurrentHashMap<>();

    public static boolean isDemoRider(String email) {
        return email != null && email.toLowerCase().endsWith(DEMO_DOMAIN);
    }

    /** 이 계정의 시연 역할 — presenter(시연 패널을 띄운다) | rider(가상 라이더) | none */
    public String roleOf(Long userId) {
        String email = userId == null ? null : userRepository.findById(userId).map(User::getEmail).orElse(null);
        if (email == null) return "none";
        if (isDemoRider(email)) return "rider";
        return isPresenter(email) ? "presenter" : "none";
    }

    private boolean isPresenter(String email) {
        if (presenterEmails == null || presenterEmails.isBlank()) return true;
        return Arrays.stream(presenterEmails.split(",")).map(String::trim).anyMatch(e -> e.equalsIgnoreCase(email));
    }

    // ───────── 준비 ─────────

    /** 라이더 계정 3개를 발표자가 팀장인 크루에 넣는다 (여러 번 눌러도 결과는 같다) */
    @Transactional
    public Map<String, Object> setup(Long leaderId) {
        User leader = (leaderId == null ? Optional.<User>empty() : userRepository.findById(leaderId))
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        if (isDemoRider(leader.getEmail())) {
            throw new RuntimeException("시연용 라이더 계정으로는 준비할 수 없어요. 발표자 계정으로 로그인해 주세요.");
        }
        if (!isPresenter(leader.getEmail())) {
            throw new RuntimeException("시연 발표자로 정한 계정이 아니에요. (.env 의 DEMO_PRESENTER_EMAILS)");
        }
        List<User> riders = RIDERS.stream().map(this::ensureRider).toList();

        // 이미 라이더가 들어 있는 크루 → 발표자가 가장 최근에 만든 크루 → 없으면 "시연 크루"를 새로
        List<Crew> led = crewRepository.findByLeader_IdOrderByIdDesc(leaderId);
        Crew crew = demoCrewOf(led, riders.get(0)).orElseGet(() -> led.isEmpty() ? null : led.get(0));
        if (crew == null) {
            CrewRequest req = new CrewRequest();
            req.setLeaderId(leaderId);
            req.setName(CREW_NAME);
            req.setRegion(routeRepository.findFirstByUserIdOrderByCreatedAtDesc(leaderId)
                    .map(Route::getRegion).filter(r -> !r.isBlank())
                    .map(r -> r.split(",")[0].trim()).orElse(null));
            req.setScheduleText("시연용");
            req.setDescription("시연용 크루예요. 민수·지영·현우는 가상 라이더입니다.");
            req.setJoinPolicy("open");
            crew = crewRepository.findById(crewService.createCrew(req).getId()).orElseThrow();
        }
        // 가입 방식이 승인제여도 라이더는 바로 가입된 상태로 둔다
        for (User u : riders) {
            CrewMember m = crewMemberRepository.findByCrewAndUser(crew, u).orElse(null);
            if (m == null) {
                m = new CrewMember();
                m.setCrew(crew);
                m.setUser(u);
            }
            m.setStatus("joined");
            crewMemberRepository.save(m);
        }

        List<Rider> sim = new ArrayList<>();
        for (int i = 0; i < RIDERS.size(); i++) sim.add(new Rider(RIDERS.get(i), riders.get(i).getId()));
        Session s = new Session(leaderId, crew.getId(), crew.getName(), sim);
        replaceSession(s);
        // 코스·가상 위치를 바로 만들어 둔다 — 다음 주기(1초)까지 기다리면 화면이 그 사이 "위치 없음"을 받아 진짜 GPS 로 돌아간다
        synchronized (s) {
            step(s, System.currentTimeMillis());
        }
        return state(leaderId);
    }

    // 발표자 크루 중 가상 라이더(민수)가 들어 있는 것
    private Optional<Crew> demoCrewOf(List<Crew> led, User minsu) {
        return led.stream().filter(c -> crewMemberRepository.existsByCrewAndUser(c, minsu)).findFirst();
    }

    private User ensureRider(RiderDef d) {
        User u = userRepository.findByEmail(d.email()).orElseGet(User::new);
        u.setName(d.name());
        u.setEmail(d.email());
        u.setProvider("local");
        // 다른 기기에서 이 계정으로 로그인해 함께 보여줄 수 있게 비밀번호를 고정값으로 맞춘다
        if (u.getPassword() == null || !passwordEncoder.matches(DEMO_PASSWORD, u.getPassword())) {
            u.setPassword(passwordEncoder.encode(DEMO_PASSWORD));
        }
        u.setLocationShareEnabled(true);
        return userRepository.save(u);
    }

    private synchronized void replaceSession(Session s) {
        Session old = current;
        if (old != null) old.riders.forEach(r -> liveLocations.remove(r.userId));
        fixes.clear();
        missUntil.clear();
        useSession(s);
    }

    // 가상 라이더 위치는 서버만 넣는다 — 그 계정으로 로그인한 다른 기기가 보낸 위치는 받지 않는다
    private void useSession(Session s) {
        liveLocations.setServerOwned(s.riders.stream().map(r -> r.userId).toList());
        current = s;
    }

    // 지금 시연 중인 세션 — 발표자나 라이더 본인만. 서버를 다시 켜 비어 있으면 발표자의 시연 크루로 다시 만든다.
    private Session sessionOf(Long userId) {
        if (userId == null) return null;
        Session s = current;
        if (s != null) return s.has(userId) ? s : null;
        long now = System.currentTimeMillis();
        if (missUntil.getOrDefault(userId, 0L) > now) return null;
        synchronized (this) {
            if (current == null) {
                Session built = rebuild(userId);
                if (built == null) {
                    missUntil.put(userId, now + 10_000);
                    return null;
                }
                // 진행 중이던 라이딩 단계·위치를 바로 이어 받는다 (이 요청부터 가상 위치가 나간다)
                synchronized (built) {
                    step(built, now);
                }
                useSession(built);
            }
            return current.has(userId) ? current : null;
        }
    }

    private Session rebuild(Long leaderId) {
        List<User> users = new ArrayList<>();
        for (RiderDef d : RIDERS) {
            Optional<User> u = userRepository.findByEmail(d.email());
            if (u.isEmpty()) return null;
            users.add(u.get());
        }
        Optional<Crew> crew = demoCrewOf(crewRepository.findByLeader_IdOrderByIdDesc(leaderId), users.get(0));
        if (crew.isEmpty()) return null;
        List<Rider> riders = new ArrayList<>();
        for (int i = 0; i < RIDERS.size(); i++) riders.add(new Rider(RIDERS.get(i), users.get(i).getId()));
        return new Session(leaderId, crew.get().getId(), crew.get().getName(), riders);
    }

    // ───────── 화면용 ─────────

    /** 시연 패널이 보여줄 상태 — 발표자만 */
    public Map<String, Object> state(Long userId) {
        Session s = sessionOf(userId);
        if (s == null || !s.leaderId.equals(userId)) return Map.of("ready", false);
        synchronized (s) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ready", true);
            m.put("crewId", s.crewId);
            m.put("crewName", s.crewName);
            m.put("phase", s.phase.name().toLowerCase());
            m.put("eventStatus", s.eventStatus);
            m.put("hasRoute", s.path != null);
            m.put("progressKm", Math.round(s.progress) / 1000.0);
            m.put("lengthKm", s.path == null ? 0 : Math.round(s.path.length) / 1000.0);
            m.put("canSkip", s.phase == Phase.RIDING && s.path != null && s.path.length - s.progress > SKIP_LEFT_M + 50);
            List<Map<String, Object>> riders = new ArrayList<>();
            for (Rider r : s.riders) {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("key", r.def.key());
                d.put("name", r.def.name());
                d.put("email", r.def.email());
                d.put("active", r.active);
                d.put("mode", r.mode.name().toLowerCase());
                d.put("distanceM", r.placed && s.placed ? Math.round(distanceM(s.lat, s.lng, r.lat, r.lng)) : null);
                riders.add(d);
            }
            m.put("riders", riders);
            m.put("password", DEMO_PASSWORD);
            return m;
        }
    }

    /** GPS 대신 쓸 가상 위치 — 발표자·라이더 본인 것만, 아직 없으면 empty */
    public Optional<Fix> position(Long userId) {
        if (userId == null) return Optional.empty();
        Session s = sessionOf(userId);   // 서버를 다시 켠 뒤 첫 요청이면 여기서 세션을 다시 만든다 (위치는 다음 틱부터)
        return s == null ? Optional.empty() : Optional.ofNullable(fixes.get(userId));
    }

    /** 시연 패널 버튼 — stray(민수 이탈) | return(민수 복귀) | join(현우 합류) | finish(도착 지점으로) */
    public Map<String, Object> action(Long userId, String action) {
        Session s = current;
        if (s == null || !s.leaderId.equals(userId)) throw new RuntimeException("먼저 [시연 준비]를 눌러 주세요.");
        synchronized (s) {
            if (s.phase != Phase.RIDING || s.path == null) throw new RuntimeException("크루 라이딩을 시작한 뒤에 쓸 수 있어요.");
            Rider minsu = s.rider("minsu");
            Rider hyunwoo = s.rider("hyunwoo");
            switch (action == null ? "" : action) {
                case "stray" -> {
                    require(minsu.active, "민수가 이번 라이딩에 없어요.");
                    require(minsu.mode == Mode.FORMATION, "민수가 대열에 있을 때만 이탈시킬 수 있어요.");
                    minsu.mode = Mode.STRAY;
                    minsu.strayBearing = (s.heading + 145) % 360;   // 뒤쪽 비스듬히 — 그룹과 반대로 가서 빨리 멀어진다
                    minsu.strayT = 0;
                }
                case "return" -> {
                    require(minsu.mode == Mode.STRAY || minsu.mode == Mode.AWAY, "민수가 이탈했을 때만 복귀시킬 수 있어요.");
                    minsu.mode = Mode.RETURNING;
                }
                case "join" -> {
                    require(hyunwoo.active, "현우가 이번 라이딩에 없어요.");
                    require(hyunwoo.mode == Mode.LATE, "현우는 이미 합류했어요.");
                    hyunwoo.mode = Mode.JOINING;
                }
                case "finish" -> {
                    require(s.path.length - s.progress > SKIP_LEFT_M + 50, "이미 도착 지점 가까이 왔어요.");
                    skipToFinish(s, System.currentTimeMillis());
                }
                default -> throw new RuntimeException("알 수 없는 동작이에요.");
            }
        }
        return state(userId);
    }

    private static void require(boolean ok, String message) {
        if (!ok) throw new RuntimeException(message);
    }

    // ───────── 1초마다 ─────────

    @Scheduled(fixedDelay = 1000)
    public void tick() {
        Session s = current;
        if (s == null) return;
        try {
            synchronized (s) {
                step(s, System.currentTimeMillis());
            }
        } catch (RuntimeException e) {
            log.warn("시연 시뮬레이션 한 번을 건너뜁니다: {}", e.toString());
        }
    }

    private void step(Session s, long now) {
        double dt = s.lastTick == 0 ? 1 : Math.min(3, (now - s.lastTick) / 1000.0);
        s.lastTick = now;
        if (now - s.lastSync >= SYNC_MS) {
            s.lastSync = now;
            sync(s, now);
        }
        switch (s.phase) {
            case IDLE -> placeAtStart(s, now, false);
            case WAITING -> placeAtStart(s, now, true);
            case RIDING -> ride(s, dt, now);
            case DONE -> { }   // 도착한 자리에 그대로 둔다
        }
    }

    // 라이딩 단계를 DB 에서 다시 읽는다 — 발표자가 화면에서 열기·체크·시작·종료한 것을 따라간다
    private void sync(Session s, long now) {
        LocalDate today = LocalDate.now();
        CrewEvent active = null;
        Party party = null;
        List<CrewEvent> events = eventRepository.findByCrew_IdOrderByStartAtDesc(s.crewId);
        for (CrewEvent e : events.subList(0, Math.min(5, events.size()))) {
            String st = e.getStatus();
            if (("recruiting".equals(st) || "checking".equals(st)) && !e.getStartAt().toLocalDate().isBefore(today)) {
                active = e;
                break;
            }
            if ("riding".equals(st) && e.getPartyId() != null) {
                Party p = partyRepository.findById(e.getPartyId()).orElse(null);
                if (p != null && !"ended".equals(p.getStatus()) && p.getRideStartedAt() != null) {
                    active = e;
                    party = p;
                    break;
                }
            }
        }

        if (active == null) {
            if (s.phase == Phase.WAITING || s.phase == Phase.RIDING) {
                // 취소했거나 라이딩을 끝냈다 — 라이더는 다른 사람 지도에서 내린다
                s.phase = s.phase == Phase.RIDING ? Phase.DONE : Phase.IDLE;
                s.riders.forEach(r -> liveLocations.remove(r.userId));
            }
            if (s.phase == Phase.IDLE && now - s.lastRouteLoad >= 10_000) {
                s.lastRouteLoad = now;
                usePath(s, routeRepository.findFirstByUserIdOrderByCreatedAtDesc(s.leaderId).orElse(null));
            }
            return;
        }

        if (!active.getId().equals(s.eventId)) openEvent(s, active);
        s.eventStatus = active.getStatus();
        if (party == null) {
            s.phase = Phase.WAITING;
            if ("recruiting".equals(active.getStatus())) acceptNext(s);
        } else if (s.phase != Phase.RIDING) {
            beginRide(s, active, party);
        }
    }

    // 새 라이딩이 열렸다 — 그 코스 출발 지점으로 모인다
    private void openEvent(Session s, CrewEvent e) {
        s.eventId = e.getId();
        s.phase = Phase.WAITING;
        s.progress = 0;
        s.speed = 0;
        s.simT = 0;
        usePath(s, e.getRouteId() == null ? null : routeRepository.findById(e.getRouteId()).orElse(null));
        for (Rider r : s.riders) {
            String st = memberStatus(e.getId(), r.userId);
            r.active = st != null && !"declined".equals(st);
            r.answered = !"invited".equals(st);
            r.mode = isLateRider(r) ? Mode.LATE : Mode.FORMATION;
            r.catchingUp = false;
        }
    }

    // 초대받은 라이더가 한 명씩 [참여] — 채팅 초대 카드의 참여 표시가 차례로 바뀐다
    private void acceptNext(Session s) {
        for (Rider r : s.riders) {
            if (!r.active || r.answered) continue;
            r.answered = true;
            if (!"invited".equals(memberStatus(s.eventId, r.userId))) continue;
            try {
                crewRideService.respond(s.eventId, r.userId, true);
            } catch (RuntimeException e) {
                log.info("시연 라이더 {} 참여 응답 실패: {}", r.def.name(), e.getMessage());
            }
            return;
        }
    }

    // 라이딩 시작 — 체크된 라이더만 함께 간다
    private void beginRide(Session s, CrewEvent e, Party p) {
        s.phase = Phase.RIDING;
        if (!Objects.equals(s.pathRouteId, e.getRouteId())) {
            usePath(s, e.getRouteId() == null ? null : routeRepository.findById(e.getRouteId()).orElse(null));
        }
        // 서버를 다시 켰을 때처럼 이미 한참 달린 라이딩이면 그만큼 간 자리에서 이어간다
        double elapsed = Duration.between(p.getRideStartedAt(), LocalDateTime.now()).toMillis() / 1000.0;
        s.progress = elapsed > 10 && s.path != null ? Math.min(s.path.length, elapsed * CRUISE_MS) : 0;
        s.speed = s.progress > 0 ? CRUISE_MS : 0;
        s.simT = Math.max(0, elapsed);
        for (Rider r : s.riders) {
            r.active = "checked".equals(memberStatus(e.getId(), r.userId));
            r.mode = isLateRider(r) && s.progress == 0 ? Mode.LATE : Mode.FORMATION;
            r.catchingUp = false;
        }
    }

    private static boolean isLateRider(Rider r) {
        return "hyunwoo".equals(r.def.key());
    }

    private String memberStatus(Long eventId, Long userId) {
        return eventMemberRepository.findByEvent_IdAndUser_Id(eventId, userId).map(CrewEventMember::getStatus).orElse(null);
    }

    private void usePath(Session s, Route route) {
        Long id = route == null ? null : route.getId();
        if (s.path != null && Objects.equals(id, s.pathRouteId)) return;
        s.pathRouteId = id;
        s.path = route == null ? null : Path.of(route);
        if (s.path == null) {
            // 위치를 정할 코스가 없다 — 화면은 실제 GPS 를 쓴다
            fixes.remove(s.leaderId);
            s.riders.forEach(r -> fixes.remove(r.userId));
        }
    }

    // 출발 지점 — 발표자는 코스 시작점, 민수·지영은 바로 옆, 현우는 코스 뒤쪽 140m 에서 오는 중
    private void placeAtStart(Session s, long now, boolean report) {
        if (s.path == null) return;
        double h = s.path.bearingAt(0);
        double[] start = s.path.pointAt(0);
        setLeader(s, start, h, now);
        for (Rider r : s.riders) {
            double[] p = switch (r.def.key()) {
                case "minsu" -> offset(start[0], start[1], h + 100, 8);
                case "jiyoung" -> offset(start[0], start[1], h - 120, 12);
                default -> side(s.path, -140, 12);
            };
            r.lat = p[0];
            r.lng = p[1];
            r.heading = h;
            r.placed = true;
            publish(s, r, now, report && r.active);
        }
    }

    private void ride(Session s, double dt, long now) {
        if (s.path == null) return;
        s.simT += dt;
        // 복귀·합류하는 라이더가 있으면 그룹이 멈춰 기다린다. 도착이 가까우면 천천히 멈춘다.
        boolean waitForSomeone = s.riders.stream().anyMatch(r -> r.active && r.catchingUp);
        double left = s.path.length - s.progress;
        double target = waitForSomeone ? 0 : Math.min(cruise(s.simT), Math.sqrt(2 * 1.2 * left));
        double maxDelta = (target > s.speed ? 1.0 : 1.6) * dt;
        s.speed = Math.max(0, s.speed + Math.max(-maxDelta, Math.min(maxDelta, target - s.speed)));
        s.progress = Math.min(s.path.length, s.progress + s.speed * dt);
        setLeader(s, s.path.pointAt(s.progress), headingAt(s.path, s.progress, s.heading), now);

        for (Rider r : s.riders) {
            if (!r.active) continue;
            double[] slot = slotOf(s, r);
            switch (r.mode) {
                case FORMATION -> moveToward(r, slot, s.speed + 2.5, dt);
                case LATE -> moveToward(r, side(s.path, s.progress - LATE_GAP_M, r.def.side()), s.speed + 1, dt);
                case STRAY -> {
                    double[] p = offset(r.lat, r.lng, r.strayBearing, STRAY_MS * dt);
                    r.lat = p[0];
                    r.lng = p[1];
                    r.heading = r.strayBearing;
                    r.strayT += dt;
                    // 충분히 멀어지면 그 거리를 유지하며 따라온다 (코스가 휘어 잘 안 멀어져도 45초면 멈춘다)
                    if (nearestOther(s, r) >= AWAY_HOLD_M || r.strayT > 45) {
                        r.mode = Mode.AWAY;
                        r.offN = (r.lat - slot[0]) * M_PER_DEG;
                        r.offE = (r.lng - slot[1]) * M_PER_DEG * Math.cos(Math.toRadians(slot[0]));
                    }
                }
                case AWAY -> moveToward(r, shift(slot, r.offN, r.offE), s.speed + 2.5, dt);
                case RETURNING, JOINING -> {
                    moveToward(r, slot, CATCH_UP_MS, dt);
                    if (distanceM(r.lat, r.lng, slot[0], slot[1]) < 3) r.mode = Mode.FORMATION;
                }
            }
            r.catchingUp = (r.mode == Mode.RETURNING || r.mode == Mode.JOINING)
                    && distanceM(r.lat, r.lng, slot[0], slot[1]) > REGROUP_M;
            publish(s, r, now, true);
        }
    }

    // [도착 지점으로] — 도착 150m 앞으로 옮기고 모두 대열로. 남은 길은 평소처럼 달려 도착한다.
    private void skipToFinish(Session s, long now) {
        s.progress = s.path.length - SKIP_LEFT_M;
        setLeader(s, s.path.pointAt(s.progress), headingAt(s.path, s.progress, s.heading), now);
        for (Rider r : s.riders) {
            if (!r.active) continue;
            r.mode = Mode.FORMATION;
            r.catchingUp = false;
            double[] slot = slotOf(s, r);
            r.lat = slot[0];
            r.lng = slot[1];
            publish(s, r, now, true);
        }
    }

    // 그룹 속도 — 20km/h 근처에서 조금씩 오르내린다
    private static double cruise(double t) {
        return CRUISE_MS + 0.22 * Math.sin(t / 9) + 0.08 * Math.sin(t / 2.3);
    }

    private void setLeader(Session s, double[] p, double heading, long now) {
        if (s.placed && distanceM(s.lat, s.lng, p[0], p[1]) > JUMP_M) {
            s.jumps++;
            // 발표자 기기가 보내는 위치도 잠깐 받지 않는다 (다른 기기 라이딩 화면에서 발표자 속도가 튀지 않게)
            if (s.phase == Phase.RIDING) liveLocations.pause(s.leaderId, HIDE_MS);
        }
        s.lat = p[0];
        s.lng = p[1];
        s.heading = heading;
        s.placed = true;
        s.t = Math.max(now, s.t + 1);
        fixes.put(s.leaderId, new Fix(s.lat, s.lng, s.heading, s.t, s.jumps));
    }

    // 라이더 위치를 내준다 — 화면용 가상 위치는 늘, 다른 사람 지도(LiveLocation)에는 report 일 때만
    private void publish(Session s, Rider r, long now, boolean report) {
        if (r.published && distanceM(r.pubLat, r.pubLng, r.lat, r.lng) > JUMP_M) {
            r.jumps++;
            if (s.phase == Phase.RIDING) {
                r.hiddenUntil = now + HIDE_MS;
                liveLocations.pause(r.userId, HIDE_MS);
            }
        }
        r.published = true;
        r.pubLat = r.lat;
        r.pubLng = r.lng;
        r.t = Math.max(now, r.t + 1);
        fixes.put(r.userId, new Fix(r.lat, r.lng, r.heading, r.t, r.jumps));
        if (report && now >= r.hiddenUntil) liveLocations.put(r.userId, r.def.name(), r.lat, r.lng);
    }

    // 대열 자리 — 선두 뒤 gap 만큼, 코스 옆으로 조금 비켜서 (달리는 동안 살짝 흔들리게)
    private static double[] slotOf(Session s, Rider r) {
        double sway = Math.sin(s.simT / 4 + r.def.gap()) * 0.8 * Math.min(1, s.speed / CRUISE_MS);
        return side(s.path, s.progress - r.def.gap(), r.def.side() + sway);
    }

    // 이 라이더와 가장 가까운 사람(발표자 + 대열에 있는 라이더)까지 거리 — 모든 화면에서 이탈 기준을 넘었는지 본다
    private static double nearestOther(Session s, Rider me) {
        double best = distanceM(me.lat, me.lng, s.lat, s.lng);
        for (Rider r : s.riders) {
            if (r == me || !r.active || !r.placed || r.mode != Mode.FORMATION) continue;
            best = Math.min(best, distanceM(me.lat, me.lng, r.lat, r.lng));
        }
        return best;
    }

    private static void moveToward(Rider r, double[] target, double maxSpeed, double dt) {
        double d = r.placed ? distanceM(r.lat, r.lng, target[0], target[1]) : 0;
        if (d > 0.3) r.heading = bearing(r.lat, r.lng, target[0], target[1]);
        double step = maxSpeed * dt;
        if (!r.placed || d <= step) {
            r.lat = target[0];
            r.lng = target[1];
        } else {
            double f = step / d;
            r.lat += (target[0] - r.lat) * f;
            r.lng += (target[1] - r.lng) * f;
        }
        r.placed = true;
    }

    // ───────── 상태 ─────────

    private static final class Rider {
        final RiderDef def;
        final Long userId;
        boolean active;          // 이번 라이딩에 함께하는지 (초대받고 불참하지 않음 → 출발 뒤에는 체크된 사람만)
        boolean answered;        // 참여 응답을 처리했는지
        Mode mode = Mode.FORMATION;
        boolean placed;
        double lat, lng, heading;
        double offN, offE;       // AWAY — 자기 대열 자리에서 떨어진 거리(m, 북·동)
        double strayBearing, strayT;
        boolean catchingUp;      // 복귀·합류 중 — 그룹이 기다린다
        boolean published;
        double pubLat, pubLng;
        int jumps;
        long t, hiddenUntil;

        Rider(RiderDef def, Long userId) {
            this.def = def;
            this.userId = userId;
        }
    }

    private static final class Session {
        final Long leaderId;
        final Long crewId;
        final String crewName;
        final List<Rider> riders;
        Phase phase = Phase.IDLE;
        String eventStatus;
        Long eventId;
        Path path;
        Long pathRouteId;
        double progress, speed, simT;   // 선두(발표자)가 코스를 따라 간 거리(m) · 속도(m/s) · 라이딩 경과(초)
        boolean placed;
        double lat, lng, heading;
        int jumps;
        long t, lastTick, lastSync, lastRouteLoad;

        Session(Long leaderId, Long crewId, String crewName, List<Rider> riders) {
            this.leaderId = leaderId;
            this.crewId = crewId;
            this.crewName = crewName;
            this.riders = riders;
        }

        Rider rider(String key) {
            return riders.stream().filter(r -> r.def.key().equals(key)).findFirst().orElseThrow();
        }

        boolean has(Long userId) {
            return leaderId.equals(userId) || riders.stream().anyMatch(r -> r.userId.equals(userId));
        }
    }

    // 코스 경로 — 출발점에서 잰 거리(m)로 위치·방향을 구한다. 0보다 작으면 출발점 뒤쪽으로 늘여서 구한다.
    private static final class Path {
        final double[] lat, lng, cum;
        final double length;

        private Path(List<double[]> pts) {
            int n = pts.size();
            lat = new double[n];
            lng = new double[n];
            cum = new double[n];
            for (int i = 0; i < n; i++) {
                lat[i] = pts.get(i)[0];
                lng[i] = pts.get(i)[1];
                if (i > 0) cum[i] = cum[i - 1] + distanceM(lat[i - 1], lng[i - 1], lat[i], lng[i]);
            }
            length = cum[n - 1];
        }

        // 자전거 경로 → 최단 경로 → 출발·도착 직선 순서로 쓴다 (라이딩 화면이 그리는 선과 같게)
        static Path of(Route r) {
            List<double[]> pts = new ArrayList<>();
            LineString line = r.getBikePath() != null && r.getBikePath().getNumPoints() >= 2 ? r.getBikePath() : r.getShortestPath();
            if (line != null) {
                for (Coordinate c : line.getCoordinates()) {
                    double[] p = {c.y, c.x};   // JTS 는 x = 경도, y = 위도
                    if (pts.isEmpty() || distanceM(pts.getLast()[0], pts.getLast()[1], p[0], p[1]) > 0.05) pts.add(p);
                }
            }
            if (pts.size() < 2 && r.getFromLat() != null && r.getFromLng() != null && r.getToLat() != null && r.getToLng() != null) {
                pts = List.of(new double[]{r.getFromLat(), r.getFromLng()}, new double[]{r.getToLat(), r.getToLng()});
            }
            if (pts.size() < 2) return null;
            Path p = new Path(pts);
            return p.length < 20 ? null : p;
        }

        double[] pointAt(double s) {
            if (s <= 0) return offset(lat[0], lng[0], bearing(lat[0], lng[0], lat[1], lng[1]) + 180, -s);
            if (s >= length) return new double[]{lat[lat.length - 1], lng[lng.length - 1]};
            int i = segmentAt(s);
            double f = (s - cum[i]) / (cum[i + 1] - cum[i]);
            return new double[]{lat[i] + (lat[i + 1] - lat[i]) * f, lng[i] + (lng[i + 1] - lng[i]) * f};
        }

        double bearingAt(double s) {
            int i = s <= 0 ? 0 : segmentAt(Math.min(s, length - 0.01));
            return bearing(lat[i], lng[i], lat[i + 1], lng[i + 1]);
        }

        // cum[i] <= s 인 가장 큰 i (마지막 점 제외)
        private int segmentAt(double s) {
            int lo = 0, hi = cum.length - 2;
            while (lo < hi) {
                int mid = (lo + hi + 1) >>> 1;
                if (cum[mid] <= s) lo = mid;
                else hi = mid - 1;
            }
            return lo;
        }
    }

    // ───────── 좌표 계산 (몇 km 범위라 평면 근사로 충분하다) ─────────

    private static double[] side(Path path, double dist, double meters) {
        double[] p = path.pointAt(dist);
        return offset(p[0], p[1], path.bearingAt(dist) + 90, meters);
    }

    // 모퉁이에서 방향이 튀지 않게 앞뒤 4m 사이 방향을 쓴다
    private static double headingAt(Path path, double s, double prev) {
        double[] a = path.pointAt(s - 4);
        double[] b = path.pointAt(Math.min(path.length, s + 4));
        return distanceM(a[0], a[1], b[0], b[1]) < 0.5 ? prev : bearing(a[0], a[1], b[0], b[1]);
    }

    static double distanceM(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
    }

    static double bearing(double lat1, double lng1, double lat2, double lng2) {
        double f1 = Math.toRadians(lat1);
        double f2 = Math.toRadians(lat2);
        double dl = Math.toRadians(lng2 - lng1);
        double y = Math.sin(dl) * Math.cos(f2);
        double x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
        return (Math.toDegrees(Math.atan2(y, x)) + 360) % 360;
    }

    static double[] offset(double lat, double lng, double bearingDeg, double meters) {
        double b = Math.toRadians(bearingDeg);
        return shift(new double[]{lat, lng}, meters * Math.cos(b), meters * Math.sin(b));
    }

    static double[] shift(double[] p, double northM, double eastM) {
        return new double[]{p[0] + northM / M_PER_DEG, p[1] + eastM / (M_PER_DEG * Math.cos(Math.toRadians(p[0])))};
    }
}
