package com.example.demo.controller;

import com.example.demo.service.DemoService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// 시연 모드가 켜져 있는지 + 이 계정의 역할 — 화면이 시연 패널·가상 위치를 쓸지 여기서 정한다.
// 시연 모드가 꺼져 있어도(배포 서버) 늘 답한다 → { enabled: false }. 화면은 로그인할 때마다 한 번 묻는다.
@RestController
@RequiredArgsConstructor
public class DemoStatusController {

    private final ObjectProvider<DemoService> demo;

    // { enabled, role: presenter | rider | none }
    @GetMapping("/api/demo/status")
    public Map<String, Object> status(@RequestParam(required = false) Long userId) {
        DemoService d = demo.getIfAvailable();
        if (d == null) return Map.of("enabled", false);
        return Map.of("enabled", true, "role", d.roleOf(userId));
    }
}
