package com.example.demo.service;

import com.example.demo.dto.FeedResponse;
import com.example.demo.dto.PointDto;
import com.example.demo.entity.Route;
import com.example.demo.entity.RouteLike;
import com.example.demo.entity.User;
import com.example.demo.repository.RouteLikeRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.LineString;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private final RouteRepository routeRepository;
    private final RouteLikeRepository routeLikeRepository;
    private final UserRepository userRepository;

    // 썸네일에 쓸 좌표 개수 상한 — 이보다 많으면 일정 간격으로 솎아낸다
    private static final int THUMBNAIL_POINTS = 60;

    /**
     * 둘러보기 피드. 최신 경로부터.
     * @param viewerId 보고 있는 사람(비로그인이면 null) — 좋아요 눌렀는지 표시에만 쓴다
     */
    public List<FeedResponse> getFeed(Long viewerId) {
        List<Route> routes = routeRepository.findAllByOrderByCreatedAtDesc();
        if (routes.isEmpty()) return List.of();

        // 작성자 이름을 한 번에 조회 (경로마다 조회하면 N+1)
        Set<Long> authorIds = routes.stream()
                .map(Route::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> authorNames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getName));

        // 좋아요 수도 한 번에 집계
        Map<Long, Long> likeCounts = new HashMap<>();
        for (Object[] row : routeLikeRepository.countGroupedByRouteId()) {
            likeCounts.put((Long) row[0], (Long) row[1]);
        }

        Set<Long> likedByViewer = viewerId == null
                ? Set.of()
                : new HashSet<>(routeLikeRepository.findRouteIdsByUserId(viewerId));

        return routes.stream()
                .map(route -> toCard(route,
                        authorNames.getOrDefault(route.getUserId(), "익명 라이더"),
                        likeCounts.getOrDefault(route.getId(), 0L),
                        likedByViewer.contains(route.getId())))
                .collect(Collectors.toList());
    }

    /** 경로 1건 → 피드 카드 1장 */
    private FeedResponse toCard(Route route, String authorName, long likeCount, boolean liked) {
        FeedResponse r = new FeedResponse();
        r.setId(route.getId());
        r.setRouteName(route.getRouteName());
        r.setFromLabel(route.getFromLabel());
        r.setToLabel(route.getToLabel());
        r.setDistanceKm(route.getDistanceKm());
        r.setAscendM(route.getAscendM());
        r.setTimeMin(route.getTimeMin());
        r.setAuthorId(route.getUserId());
        r.setAuthorName(authorName);
        r.setDescription(route.getDescription());
        r.setTags(splitTags(route.getTags()));
        r.setPath(thumbnailPath(route.getBikePath()));
        r.setLikeCount(likeCount);
        r.setLiked(liked);
        r.setCreatedAt(route.getCreatedAt());
        return r;
    }

    /** "야경,초보코스" → ["야경", "초보코스"]. 비어 있으면 null (프론트가 자동 태그를 쓴다) */
    private List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) return null;
        List<String> list = Arrays.stream(tags.split(","))
                .map(String::trim).filter(t -> !t.isEmpty()).toList();
        return list.isEmpty() ? null : list;
    }

    /**
     * 게시물 올리기 — 이미 저장된 내 경로에 문구와 해시태그를 붙인다.
     * 이 프로젝트에서 "게시물"은 별도 테이블이 아니라 경로에 딸린 내용이다.
     */
    @Transactional
    public FeedResponse publish(Long routeId, Long userId, String description, String rawTags) {
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new IllegalArgumentException("경로를 찾을 수 없습니다"));

        if (route.getUserId() == null || !route.getUserId().equals(userId)) {
            throw new SecurityException("본인이 저장한 경로만 올릴 수 있습니다");
        }

        route.setDescription(trimToNull(description, 500));
        route.setTags(normalizeTags(rawTags));
        routeRepository.save(route);

        String authorName = userRepository.findById(userId).map(User::getName).orElse("익명 라이더");
        return toCard(route, authorName,
                routeLikeRepository.countByRouteId(routeId),
                routeLikeRepository.findByRouteIdAndUserId(routeId, userId).isPresent());
    }

    /** "#야경 #초보코스" / "야경, 초보코스" 무엇으로 써도 "야경,초보코스" 로 정리한다 */
    private String normalizeTags(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String joined = Arrays.stream(raw.split("[,\\s]+"))
                .map(t -> t.replaceAll("^#+", "").trim())
                .filter(t -> !t.isEmpty())
                .distinct()
                .limit(10)
                .collect(Collectors.joining(","));
        return joined.isEmpty() ? null : trimToNull(joined, 300);
    }

    private String trimToNull(String v, int max) {
        if (v == null) return null;
        String t = v.trim();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** 좋아요 토글. 눌려있으면 취소, 아니면 추가. */
    @Transactional
    public Map<String, Object> toggleLike(Long routeId, Long userId) {
        routeRepository.findById(routeId)
                .orElseThrow(() -> new IllegalArgumentException("경로를 찾을 수 없습니다"));

        boolean liked;
        var existing = routeLikeRepository.findByRouteIdAndUserId(routeId, userId);
        if (existing.isPresent()) {
            routeLikeRepository.delete(existing.get());
            liked = false;
        } else {
            RouteLike like = new RouteLike();
            like.setRouteId(routeId);
            like.setUserId(userId);
            routeLikeRepository.save(like);
            liked = true;
        }

        return Map.of("liked", liked, "likeCount", routeLikeRepository.countByRouteId(routeId));
    }

    /**
     * LineString 을 썸네일용 좌표 배열로 바꾼다.
     * 경로 하나가 수천 점이라 그대로 보내면 피드가 무거워지므로 일정 간격으로 솎아내고,
     * 마지막 점은 반드시 포함시켜 선이 도착지까지 이어지게 한다.
     */
    private List<PointDto> thumbnailPath(LineString line) {
        if (line == null) return List.of();

        Coordinate[] coords = line.getCoordinates();
        if (coords.length == 0) return List.of();

        int step = Math.max(1, coords.length / THUMBNAIL_POINTS);
        List<PointDto> points = new ArrayList<>();
        for (int i = 0; i < coords.length; i += step) {
            points.add(toPoint(coords[i]));
        }
        Coordinate last = coords[coords.length - 1];
        if (points.isEmpty() || points.get(points.size() - 1).getLat() != last.y
                || points.get(points.size() - 1).getLng() != last.x) {
            points.add(toPoint(last));
        }
        return points;
    }

    private PointDto toPoint(Coordinate c) {
        PointDto p = new PointDto();
        p.setLat(c.y);   // y = 위도
        p.setLng(c.x);   // x = 경도
        return p;
    }
}
