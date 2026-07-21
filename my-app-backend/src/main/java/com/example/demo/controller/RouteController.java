package com.example.demo.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.RouteRequest;
import com.example.demo.dto.RouteResponse;
import com.example.demo.dto.RouteService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class RouteController {

    private final RouteService routeService;

    // 저장
    @PostMapping("/routes")
    public ResponseEntity<?> saveRoute(@RequestBody RouteRequest request) {
        Long id = routeService.saveRoute(request);
        return ResponseEntity.ok(Map.of("id", id, "message", "경로 저장 완료"));
    }

    // 목록 조회 (userId 파라미터 있으면 해당 유저 것만)
    @GetMapping("/routes")
    public ResponseEntity<?> getRouteList(@RequestParam(required = false) Long userId) {
        return ResponseEntity.ok(routeService.getRouteList(userId));
    }

    // 특정 경로 1개 조회
    @GetMapping("/routes/{id}")
    public ResponseEntity<RouteResponse> getRoute(@PathVariable Long id) {
        return ResponseEntity.ok(routeService.getRouteById(id));
    }

    // 경로 삭제 (여러 개)
    @PostMapping("/routes/delete")
    public ResponseEntity<?> deleteRoutes(@RequestBody java.util.List<Long> ids) {
        routeService.deleteRoutes(ids);
        return ResponseEntity.ok(Map.of("message", "삭제 완료"));
    }
}