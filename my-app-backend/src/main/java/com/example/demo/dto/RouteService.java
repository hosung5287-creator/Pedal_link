package com.example.demo.dto;


import com.example.demo.entity.Route;
import com.example.demo.entity.RouteBookmark;
import com.example.demo.entity.User;
import com.example.demo.repository.RouteBookmarkRepository;
import com.example.demo.repository.RoutePhotoRepository;
import com.example.demo.repository.RouteRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.service.RegionService;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class RouteService {

    private final RouteRepository routeRepository;
    private final RouteBookmarkRepository routeBookmarkRepository;
    private final RoutePhotoRepository routePhotoRepository;
    private final UserRepository userRepository;
    private final RegionService regionService;

    // 경유지 최대 개수 — BRouter 요청 주소 길이·계산 시간 때문에 제한한다 (프론트 MAX_WAYPOINTS 와 같은 값)
    public static final int MAX_WAYPOINTS = 100;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static String toWaypointsJson(List<WaypointDto> waypoints) {
        if (waypoints == null || waypoints.isEmpty()) return null;
        return JSON.writeValueAsString(waypoints);
    }

    private static List<WaypointDto> fromWaypointsJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        return JSON.readValue(json, new TypeReference<List<WaypointDto>>() {});
    }

    private static int countWaypoints(String json) {
        return fromWaypointsJson(json).size();
    }

    // PointDto 리스트 → PostGIS LineString 변환
    private LineString toLineString(List<PointDto> points) {
        GeometryFactory gf = new GeometryFactory(new PrecisionModel(), 4326);
        Coordinate[] coords = points.stream()
            .map(p -> new Coordinate(p.getLng(), p.getLat())) // PostGIS는 (경도, 위도) 순서
            .toArray(Coordinate[]::new);
        return gf.createLineString(coords);
    }

    // PostGIS LineString → PointDto 리스트 변환
    private List<PointDto> fromLineString(LineString line) {
        if (line == null) return List.of(); // 최단경로 없이 자전거 경로만 저장된 코스도 있다
        return Arrays.stream(line.getCoordinates())
            .map(c -> {
                PointDto p = new PointDto();
                p.setLat(c.y); // y = 위도
                p.setLng(c.x); // x = 경도
                return p;
            })
            .collect(Collectors.toList());
    }

    // 저장
    public Long saveRoute(RouteRequest req) {
        Route route = new Route();
        route.setUserId(req.getUserId());
        route.setRouteName(req.getRouteName());
        route.setFromLat(req.getFromLat());
        route.setFromLng(req.getFromLng());
        route.setFromLabel(req.getFromLabel());
        route.setToLat(req.getToLat());
        route.setToLng(req.getToLng());
        route.setToLabel(req.getToLabel());
        // 지역 = 경로 만들기에서 고른 지역(프론트가 '전체'가 아닐 때만 보낸다), 없으면 출발점이 들어 있는 구
        String pickedRegion = req.getRegion() == null ? "" : req.getRegion().trim();
        route.setRegion(!pickedRegion.isEmpty() ? pickedRegion : regionService.findGu(req.getFromLat(), req.getFromLng()));
        route.setDistanceKm(req.getDistanceKm());
        route.setAscendM(req.getAscendM());
        route.setTimeMin(req.getTimeMin());
        route.setBikePath(toLineString(req.getBikeRoute()));
        route.setShortestPath(toLineString(req.getShortestRoute()));
        route.setWaypoints(toWaypointsJson(req.getWaypoints()));
        return routeRepository.save(route).getId();
    }

    /**
     * 저장된 경로 목록 — 내 코스, 그리고 includeSaved 면 피드에서 저장(북마크)한 다른 사람의 코스까지.
     * 최신순: 내 코스는 만든 때, 저장한 코스는 저장한 때 기준. 저장한 코스는 bookmarked=true · authorName 이 붙는다.
     * (글쓰기·파티·크루처럼 "내 코스"만 골라야 하는 화면은 includeSaved 없이 부른다)
     */
    public List<Map<String, Object>> getRouteList(Long userId, boolean includeSaved) {
        record Item(Route route, LocalDateTime listedAt, boolean bookmarked, String authorName) {}
        List<Item> items = new ArrayList<>();
        for (Route r : routeRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            items.add(new Item(r, r.getCreatedAt(), false, null));
        }
        if (includeSaved) {
            List<RouteBookmark> bookmarks = routeBookmarkRepository.findByUserIdOrderByCreatedAtDesc(userId);
            Map<Long, Route> routes = routeRepository.findAllById(bookmarks.stream().map(RouteBookmark::getRouteId).toList())
                .stream().collect(Collectors.toMap(Route::getId, r -> r));
            Set<Long> authorIds = routes.values().stream().map(Route::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
            Map<Long, String> authorNames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getName));
            for (RouteBookmark b : bookmarks) {
                Route r = routes.get(b.getRouteId());
                if (r == null) continue; // 원작자가 그사이 지운 코스
                items.add(new Item(r, b.getCreatedAt(), true, authorNames.getOrDefault(r.getUserId(), "익명 라이더")));
            }
            items.sort(Comparator.comparing(Item::listedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        }
        return items.stream()
            .map(it -> {
                Route r = it.route();
                Map<String, Object> m = new HashMap<>();
                m.put("id", r.getId());
                m.put("routeName", r.getRouteName() != null ? r.getRouteName() : "이름없음");
                m.put("fromLabel", r.getFromLabel());
                m.put("toLabel", r.getToLabel());
                m.put("region", r.getRegion());
                m.put("distanceKm", r.getDistanceKm());
                m.put("waypointCount", countWaypoints(r.getWaypoints())); // 저장 목록의 "경유 N곳"
                m.put("createdAt", it.listedAt() != null ? it.listedAt().toString() : null);
                m.put("bookmarked", it.bookmarked());
                if (it.bookmarked()) m.put("authorName", it.authorName());
                return m;
            })
            .collect(Collectors.toList());
    }

    /**
     * 저장된 경로 목록에서 지우기 — 내 코스는 삭제하고, 저장한 다른 사람의 코스는 저장만 취소한다(코스 자체는 그대로).
     * 남의 코스는 어떤 경우에도 지우지 않는다.
     */
    @Transactional
    public Map<String, Integer> deleteRoutes(Long userId, List<Long> ids) {
        List<Long> own = routeRepository.findAllById(ids).stream()
            .filter(r -> userId.equals(r.getUserId()))
            .map(Route::getId)
            .toList();
        if (!own.isEmpty()) routePhotoRepository.deleteByRouteIdIn(own);   // 게시물 사진도 같이
        routeRepository.deleteAllById(own);
        int unsaved = routeBookmarkRepository.deleteByUserIdAndRouteIdIn(userId, ids);
        return Map.of("deleted", own.size(), "unsaved", unsaved);
    }

    // 특정 경로 1개 조회 (id로)
    public RouteResponse getRouteById(Long id) {
        Route route = routeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("경로를 찾을 수 없습니다"));
        
        return new RouteResponse(
            route.getId(),
            route.getRouteName(),
            route.getFromLat(), route.getFromLng(), route.getFromLabel(),
            route.getToLat(),   route.getToLng(),   route.getToLabel(),
            route.getRegion(),
            route.getDistanceKm(),
            route.getAscendM(),
            fromLineString(route.getBikePath()),
            fromLineString(route.getShortestPath()),
            fromWaypointsJson(route.getWaypoints()),
            route.getCreatedAt()
        );
    }
}