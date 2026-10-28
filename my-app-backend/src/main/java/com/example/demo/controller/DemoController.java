package com.example.demo.controller;

import com.example.demo.service.DemoService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.function.Supplier;

// 시연 모드 — 흐름은 DemoService 주석 참고. DEMO_ENABLED=true 일 때만 생기고, 꺼져 있으면 모두 404.
// 켜져 있는지·누가 발표자인지(/api/demo/status)는 꺼져 있어도 답해야 해서 DemoStatusController 에 따로 둔다.
@RestController
@RequestMapping("/api/demo")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "demo", name = "enabled", havingValue = "true")
public class DemoController {

    private final DemoService demo;

    // [시연 준비] { userId } — 라이더 계정·시연 크루를 만든다 (여러 번 눌러도 결과는 같다)
    @PostMapping("/setup")
    public ResponseEntity<?> setup(@RequestBody Map<String, Long> body) {
        return handle(() -> demo.setup(body.get("userId")));
    }

    // 시연 패널 상태 (발표자만, 준비 전이면 { ready: false })
    @GetMapping("/state")
    public ResponseEntity<?> state(@RequestParam Long userId) {
        return handle(() -> demo.state(userId));
    }

    // GPS 대신 쓰는 가상 위치 { lat, lng, heading, t, jumps } — 없으면 204 (화면은 실제 GPS 를 쓴다)
    @GetMapping("/position")
    public ResponseEntity<?> position(@RequestParam Long userId) {
        return demo.position(userId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    // 시연 패널 버튼 { userId, action: stray | return | join | finish }
    @PostMapping("/action")
    public ResponseEntity<?> action(@RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") instanceof Number n ? n.longValue() : null;
        String action = body.get("action") == null ? null : String.valueOf(body.get("action"));
        return handle(() -> demo.action(userId, action));
    }

    private ResponseEntity<?> handle(Supplier<Map<String, Object>> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (RuntimeException e) {
            String message = e.getMessage() == null ? "요청을 처리하지 못했어요." : e.getMessage();
            return ResponseEntity.badRequest().body(Map.of("message", message));
        }
    }
}
