package com.example.demo.service;

import com.example.demo.dto.FeedPageResponse;
import com.example.demo.dto.FeedResponse;
import com.example.demo.dto.FeedSummaryResponse;
import com.example.demo.dto.PointDto;
import com.example.demo.entity.Route;
import com.example.demo.entity.RouteBookmark;
import com.example.demo.entity.RouteLike;
import com.example.demo.entity.RoutePhoto;
import com.example.demo.entity.User;
import com.example.demo.repository.RouteBookmarkRepository;
import com.example.demo.repository.RouteLikeRepository;
import com.example.demo.repository.RoutePhotoRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.LineString;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private final RouteRepository routeRepository;
    private final RouteLikeRepository routeLikeRepository;
    private final RouteBookmarkRepository routeBookmarkRepository;
    private final RoutePhotoRepository routePhotoRepository;
    private final UserRepository userRepository;

    // 썸네일에 쓸 좌표 개수 상한 — 이보다 많으면 일정 간격으로 솎아낸다
    private static final int THUMBNAIL_POINTS = 60;
    private static final int MAX_PAGE_SIZE = 50;   // 피드 한 페이지 최대 개수
    private static final int SIDEBAR_LIMIT = 5;    // 사이드바 순위 개수
    // 게시물 사진 — 화면이 300KB 안팎으로 줄여 보내므로 1MB 면 넉넉하다
    private static final int MAX_PHOTO_BYTES = 1024 * 1024;
    private static final Set<String> PHOTO_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private record Photo(String contentType, byte[] data) {}

    /**
     * 둘러보기 피드. 최신 경로부터.
     * @param viewerId 보고 있는 사람(비로그인이면 null) — 좋아요 눌렀는지 표시에만 쓴다
     */
    public List<FeedResponse> getFeed(Long viewerId) {
        return toCards(routeRepository.findByPublishedAtIsNotNullOrderByPublishedAtDesc(), viewerId);
    }

    /**
     * 피드 한 페이지 — 최신순으로 size 개씩. [더 보기] 를 누를 때마다 page 를 하나씩 올려 부른다.
     * @param region 구 이름(예: "마포구"). 비어 있거나 "전체"면 모든 게시물
     */
    public FeedPageResponse getFeedPage(Long viewerId, int page, int size, String region) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        String gu = (region == null || region.isBlank() || "전체".equals(region.trim())) ? null : region.trim();

        // 한 개 더 읽어서 다음 페이지가 있는지 본다 (전체 개수를 세는 쿼리를 따로 돌리지 않으려고)
        List<Route> rows = routeRepository.findFeedPage(gu, safeSize + 1, (long) safePage * safeSize);
        boolean hasNext = rows.size() > safeSize;
        List<Route> routes = hasNext ? rows.subList(0, safeSize) : rows;
        return new FeedPageResponse(toCards(routes, viewerId), safePage, safeSize, hasNext);
    }

    /** 피드 사이드바 — 인기 코스(좋아요 순) 5개, 활발한 지역(게시물 수 순) 5개를 전체 게시물로 계산한다 */
    public FeedSummaryResponse getSummary(Long viewerId) {
        List<Long> topIds = routeRepository.findTopLikedRouteIds(SIDEBAR_LIMIT);
        Map<Long, Route> byId = routeRepository.findAllById(topIds).stream()
                .collect(Collectors.toMap(Route::getId, r -> r));
        List<Route> topRoutes = topIds.stream().map(byId::get).filter(Objects::nonNull).toList(); // 순위 순서 유지

        List<FeedSummaryResponse.RegionStat> regions = routeRepository.findTopRegions(SIDEBAR_LIMIT).stream()
                .map(row -> new FeedSummaryResponse.RegionStat(
                        (String) row[0], ((Number) row[1]).longValue(), ((Number) row[2]).longValue()))
                .toList();
        return new FeedSummaryResponse(toCards(topRoutes, viewerId), regions);
    }

    // 경로 여러 개 → 피드 카드. 작성자 이름·좋아요 수는 이 경로들 것만 한 번에 모아 읽는다(N+1 방지)
    private List<FeedResponse> toCards(List<Route> routes, Long viewerId) {
        if (routes.isEmpty()) return List.of();

        Set<Long> authorIds = routes.stream()
                .map(Route::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> authorNames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getName));

        List<Long> routeIds = routes.stream().map(Route::getId).toList();
        Map<Long, Long> likeCounts = new HashMap<>();
        for (Object[] row : routeLikeRepository.countGroupedByRouteIdIn(routeIds)) {
            likeCounts.put((Long) row[0], (Long) row[1]);
        }

        Set<Long> likedByViewer = viewerId == null
                ? Set.of()
                : new HashSet<>(routeLikeRepository.findRouteIdsByUserId(viewerId));
        Set<Long> bookmarkedByViewer = viewerId == null
                ? Set.of()
                : new HashSet<>(routeBookmarkRepository.findRouteIdsByUserIdAndRouteIdIn(viewerId, routeIds));
        Map<Long, LocalDateTime> photoUpdatedAt = new HashMap<>();
        for (Object[] row : routePhotoRepository.findUpdatedAtByRouteIdIn(routeIds)) {
            photoUpdatedAt.put((Long) row[0], (LocalDateTime) row[1]);
        }

        return routes.stream()
                .map(route -> {
                    FeedResponse card = toCard(route,
                            authorNames.getOrDefault(route.getUserId(), "익명 라이더"),
                            likeCounts.getOrDefault(route.getId(), 0L),
                            likedByViewer.contains(route.getId()));
                    card.setBookmarked(bookmarkedByViewer.contains(route.getId()));
                    card.setPhotoUrl(photoUrl(route.getId(), photoUpdatedAt.get(route.getId())));
                    return card;
                })
                .collect(Collectors.toList());
    }

    /**
     * 북마크(저장) 토글 — 다른 사람의 코스를 내 "저장된 경로 목록"에 담거나 뺀다. 코스는 복사하지 않는다.
     * 내 코스는 이미 목록에 있으므로 저장할 수 없다.
     */
    @Transactional
    public Map<String, Object> toggleBookmark(Long routeId, Long userId) {
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new IllegalArgumentException("경로를 찾을 수 없습니다"));
        if (userId.equals(route.getUserId())) {
            throw new IllegalArgumentException("내 코스는 이미 저장된 경로 목록에 있어요");
        }

        var existing = routeBookmarkRepository.findByUserIdAndRouteId(userId, routeId);
        if (existing.isPresent()) {
            routeBookmarkRepository.delete(existing.get());
            return Map.of("bookmarked", false);
        }
        // 피드에 올리지 않은(저장만 한) 코스는 남이 담을 수 없다
        if (route.getPublishedAt() == null) {
            throw new IllegalArgumentException("피드에 올라온 게시물만 저장할 수 있어요");
        }
        RouteBookmark bookmark = new RouteBookmark();
        bookmark.setUserId(userId);
        bookmark.setRouteId(routeId);
        routeBookmarkRepository.save(bookmark);
        return Map.of("bookmarked", true);
    }

    /** 경로 1건 → 피드 카드 1장 */
    private FeedResponse toCard(Route route, String authorName, long likeCount, boolean liked) {
        FeedResponse r = new FeedResponse();
        r.setId(route.getId());
        r.setRouteName(route.getRouteName());
        r.setFromLabel(route.getFromLabel());
        r.setToLabel(route.getToLabel());
        r.setRegion(route.getRegion());
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
        // 피드의 "n시간 전"은 코스를 만든 때가 아니라 게시물로 올린 때 기준
        r.setCreatedAt(route.getPublishedAt() != null ? route.getPublishedAt() : route.getCreatedAt());
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
     * 게시물 올리기 — 이미 저장된 내 경로에 문구·해시태그·사진을 붙이고 피드에 공개한다(published_at).
     * 이 프로젝트에서 "게시물"은 별도 테이블이 아니라 경로에 딸린 내용이다. 저장만 한 코스는 피드에 나오지 않는다.
     * @param photo 화면이 줄여 보낸 data URL("data:image/jpeg;base64,..."). 없으면 사진을 뺀다 —
     *              글쓰기 화면은 다시 올릴 때 예전 내용을 불러오지 않고 문구·태그처럼 새로 덮어쓴다.
     */
    @Transactional
    public FeedResponse publish(Long routeId, Long userId, String description, String rawTags, String region, String photo) {
        Route route = routeRepository.findById(routeId)
                .orElseThrow(() -> new IllegalArgumentException("경로를 찾을 수 없습니다"));

        if (route.getUserId() == null || !route.getUserId().equals(userId)) {
            throw new SecurityException("본인이 저장한 경로만 올릴 수 있습니다");
        }
        Photo picked = parsePhoto(photo);   // 잘못된 사진이면 아무것도 바꾸기 전에 멈춘다

        route.setDescription(trimToNull(description, 500));
        route.setTags(normalizeTags(rawTags));
        // 게시물 지역은 코스를 저장할 때 정해진 값(고른 지역 또는 출발점 기준)을 그대로 쓴다.
        // 글쓰기 화면은 지역을 보내지 않는다 — 값이 올 때만(예전 클라이언트 등) 덮어쓴다.
        // 여러 지역을 콤마로 이어 붙여 저장할 수 있어(tags 필드와 같은 방식) 여유 있게 잡는다.
        String pickedRegion = trimToNull(region, 300);
        if (pickedRegion != null) route.setRegion(pickedRegion);
        // 처음 올릴 때 공개 — 이 시각부터 피드에 나온다. 이미 올린 게시물을 고쳐 올리면 처음 올린 시각을 그대로 둔다.
        if (route.getPublishedAt() == null) route.setPublishedAt(LocalDateTime.now());
        routeRepository.save(route);

        LocalDateTime photoAt = null;
        if (picked == null) {
            routePhotoRepository.deleteById(routeId);
        } else {
            RoutePhoto p = routePhotoRepository.findById(routeId).orElseGet(RoutePhoto::new);
            p.setRouteId(routeId);
            p.setContentType(picked.contentType());
            p.setData(picked.data());
            p.setUpdatedAt(LocalDateTime.now());
            photoAt = routePhotoRepository.save(p).getUpdatedAt();
        }

        String authorName = userRepository.findById(userId).map(User::getName).orElse("익명 라이더");
        FeedResponse card = toCard(route, authorName,
                routeLikeRepository.countByRouteId(routeId),
                routeLikeRepository.findByRouteIdAndUserId(routeId, userId).isPresent());
        card.setPhotoUrl(photoUrl(routeId, photoAt));
        return card;
    }

    /** 게시물 사진 (피드 카드의 photoUrl 이 가리키는 곳) */
    @Transactional(readOnly = true)
    public Optional<RoutePhoto> getPhoto(Long routeId) {
        return routePhotoRepository.findById(routeId);
    }

    // "data:image/jpeg;base64,...." → 형식·바이트. 비어 있으면 null (사진 없음)
    private Photo parsePhoto(String photo) {
        if (photo == null || photo.isBlank()) return null;
        // base64 는 3바이트를 4글자로 쓴다 — 풀기 전에 길이로 먼저 거른다
        if (photo.length() > MAX_PHOTO_BYTES / 3 * 4 + 100) throw new IllegalArgumentException("사진이 너무 커요 (1MB 까지)");
        int comma = photo.indexOf(',');
        String head = comma > 0 ? photo.substring(0, comma) : "";
        String type = head.startsWith("data:") && head.endsWith(";base64") ? head.substring(5, head.length() - 7) : "";
        if (!PHOTO_TYPES.contains(type)) throw new IllegalArgumentException("사진은 JPEG·PNG·WebP 만 올릴 수 있어요");
        byte[] data;
        try {
            data = Base64.getDecoder().decode(photo.substring(comma + 1));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("사진을 읽지 못했어요");
        }
        if (data.length == 0) throw new IllegalArgumentException("사진을 읽지 못했어요");
        if (data.length > MAX_PHOTO_BYTES) throw new IllegalArgumentException("사진이 너무 커요 (1MB 까지)");
        return new Photo(type, data);
    }

    // 사진 주소 — 바꾼 시각(v)을 붙여 사진을 바꾸면 주소도 바뀐다. 사진이 없으면 null
    private String photoUrl(Long routeId, LocalDateTime updatedAt) {
        return updatedAt == null ? null : "/api/routes/" + routeId + "/photo?v=" + Timestamp.valueOf(updatedAt).getTime();
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

        // 올림 나눗셈 — 내림이면 119개짜리 선에서 step 이 1 이 되어 상한(60)의 두 배 가까이 남았다
        int step = Math.max(1, (coords.length + THUMBNAIL_POINTS - 1) / THUMBNAIL_POINTS);
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
