package com.example.demo.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.RouteDeleteRequest;
import com.example.demo.dto.RouteRequest;
import com.example.demo.dto.RouteResponse;
import com.example.demo.dto.RouteService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RouteController {

    private final RouteService routeService;

    // 저장
    @PostMapping("/routes")
    public ResponseEntity<?> saveRoute(@RequestBody RouteRequest request) {
        if (request.getWaypoints() != null && request.getWaypoints().size() > RouteService.MAX_WAYPOINTS) {
            return ResponseEntity.badRequest().body(Map.of("message", "경유지는 최대 " + RouteService.MAX_WAYPOINTS + "곳까지 넣을 수 있어요."));
        }
        Long id = routeService.saveRoute(request);
        return ResponseEntity.ok(Map.of("id", id, "message", "경로 저장 완료"));
    }

    // 목록 조회 — 본인 경로만 돌려준다.
    // userId 를 선택 파라미터로 두면 생략했을 때 전체 경로가 나가서
    // 비로그인 사용자에게 남의 저장 경로가 노출된다. 그래서 필수로 받는다.
    // includeSaved=true 면 피드에서 저장(북마크)한 다른 사람의 코스도 함께 준다 (코스 만들기의 저장된 경로 목록)
    @GetMapping("/routes")
    public ResponseEntity<?> getRouteList(@RequestParam(required = false) Long userId,
                                          @RequestParam(defaultValue = "false") boolean includeSaved) {
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "userId는 필수입니다"));
        }
        return ResponseEntity.ok(routeService.getRouteList(userId, includeSaved));
    }

    // 특정 경로 1개 조회
    @GetMapping("/routes/{id}")
    public ResponseEntity<RouteResponse> getRoute(@PathVariable Long id) {
        return ResponseEntity.ok(routeService.getRouteById(id));
    }

    // 경로 삭제 (여러 개) — body { userId, ids }.
    // 내 코스만 지우고, 저장한 다른 사람의 코스는 저장만 취소한다. 남의 코스는 지우지 않는다.
    @PostMapping("/routes/delete")
    public ResponseEntity<?> deleteRoutes(@RequestBody RouteDeleteRequest req) {
        if (req.getUserId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "로그인이 필요합니다"));
        }
        if (req.getIds() == null || req.getIds().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "지울 경로를 골라 주세요"));
        }
        return ResponseEntity.ok(routeService.deleteRoutes(req.getUserId(), req.getIds()));
    }
}