package com.example.demo.service;

import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// 위치 공유 중인 사용자의 실시간 위치 (메모리 보관 — 서버를 재시작하면 비어 있다).
// 위치 API(LocationController)와 "근처 모집 중 파티"(PartyService)가 같은 값을 봐야 해서 한곳에 둔다.
// 위치 공유를 끈 사용자는 위치를 보내지 않고, 끄는 순간 remove 로 지워지므로 여기 없다.
@Service
public class LiveLocationService {

    // 이 시간 안에 위치를 보낸 사람만 "지금 공유 중"으로 본다 (프론트는 3~5초마다 보낸다)
    private static final long STALE_MS = 15_000;
    private static final double EARTH_RADIUS_M = 6_371_000;

    public record LiveLocation(Long userId, String name, double lat, double lng, long updatedAt) {}

    private final Map<Long, LiveLocation> locations = new ConcurrentHashMap<>();

    // 시연 모드(DemoService) 전용 — 평소에는 비어 있다.
    // serverOwned: 가상 라이더. 위치는 서버만 넣고, 그 계정으로 로그인한 기기가 보낸 위치는 받지 않는다.
    // pausedUntil: 순간 이동 직후 잠깐 기기 위치를 받지 않는다 (다른 화면이 순간 속도를 엉뚱하게 계산하지 않게).
    private final Set<Long> serverOwned = ConcurrentHashMap.newKeySet();
    private final Map<Long, Long> pausedUntil = new ConcurrentHashMap<>();

    /** 기기가 보낸 위치 (LocationController) */
    public void report(Long userId, String name, double lat, double lng) {
        if (serverOwned.contains(userId)) return;
        Long until = pausedUntil.get(userId);
        if (until != null) {
            if (until > System.currentTimeMillis()) return;
            pausedUntil.remove(userId, until);
        }
        put(userId, name, lat, lng);
    }

    /** 서버가 직접 넣는 위치 — 시연 모드 가상 라이더 */
    public void put(Long userId, String name, double lat, double lng) {
        locations.put(userId, new LiveLocation(userId, name, lat, lng, System.currentTimeMillis()));
    }

    public void setServerOwned(Collection<Long> userIds) {
        serverOwned.clear();
        serverOwned.addAll(userIds);
    }

    /** ms 동안 이 사용자의 위치를 내리고, 기기에서 오는 위치도 받지 않는다 */
    public void pause(Long userId, long ms) {
        pausedUntil.put(userId, System.currentTimeMillis() + ms);
        locations.remove(userId);
    }

    public void remove(Long userId) {
        locations.remove(userId);
    }

    /** 오래된 위치를 정리하고 지금 공유 중인 위치 전부 */
    public List<LiveLocation> fresh() {
        long now = System.currentTimeMillis();
        locations.values().removeIf(l -> now - l.updatedAt() > STALE_MS);
        return List.copyOf(locations.values());
    }

    /** 그 사용자가 지금 위치를 공유 중이면 위치, 아니면 empty */
    public Optional<LiveLocation> find(Long userId) {
        if (userId == null) return Optional.empty();
        LiveLocation l = locations.get(userId);
        if (l == null || System.currentTimeMillis() - l.updatedAt() > STALE_MS) return Optional.empty();
        return Optional.of(l);
    }

    /** 두 위치 사이 거리(m) — 하버사인 공식. 몇 백 m 범위라 이 정도 정밀도면 충분하다 */
    public static double distanceM(LiveLocation a, LiveLocation b) {
        double dLat = Math.toRadians(b.lat() - a.lat());
        double dLng = Math.toRadians(b.lng() - a.lng());
        double h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(a.lat())) * Math.cos(Math.toRadians(b.lat()))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
    }
}
