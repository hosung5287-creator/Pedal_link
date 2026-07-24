package com.example.demo.dto;


import com.example.demo.entity.Route;
import com.example.demo.repository.RouteRepository;

import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;  
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class RouteService {

    private final RouteRepository routeRepository;

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
        route.setBikePath(toLineString(req.getBikeRoute()));
        route.setShortestPath(toLineString(req.getShortestRoute()));
        return routeRepository.save(route).getId();
    }

    public List<Map<String, Object>> getRouteList(Long userId) {
        List<Route> routes = (userId != null)
            ? routeRepository.findByUserIdOrderByCreatedAtDesc(userId)
            : routeRepository.findAllByOrderByCreatedAtDesc();
        return routes.stream()
            .map(r -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", r.getId());
                m.put("routeName", r.getRouteName() != null ? r.getRouteName() : "이름없음");
                m.put("fromLabel", r.getFromLabel());
                m.put("toLabel", r.getToLabel());
                m.put("createdAt", r.getCreatedAt().toString());
                return m;
            })
            .collect(Collectors.toList());
    }

    // 여러 경로 삭제
    public void deleteRoutes(java.util.List<Long> ids) {
        routeRepository.deleteAllById(ids);
    }

    // 특정 경로 1개 조회 (id로)
    public RouteResponse getRouteById(Long id) {
        Route route = routeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("경로를 찾을 수 없습니다"));
        
        System.out.println("bikePath: " + route.getBikePath());       // 콘솔 확인용
        System.out.println("shortestPath: " + route.getShortestPath()); // 콘솔 확인용

        return new RouteResponse(
            route.getId(),
            route.getRouteName(),
            route.getFromLat(), route.getFromLng(), route.getFromLabel(),
            route.getToLat(),   route.getToLng(),   route.getToLabel(),
            fromLineString(route.getBikePath()),
            fromLineString(route.getShortestPath()),
            route.getCreatedAt()
        );
    }
}