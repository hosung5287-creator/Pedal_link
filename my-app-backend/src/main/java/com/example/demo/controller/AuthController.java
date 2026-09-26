package com.example.demo.controller;

import com.example.demo.dto.LoginRequest;
import com.example.demo.dto.SignupRequest;
import com.example.demo.dto.UserProfileResponse;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    // 회원가입
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequest req) {
        if (userRepository.findByEmail(req.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "이미 사용 중인 이메일입니다."));
        }

        User user = new User();
        user.setName(req.getName());
        user.setEmail(req.getEmail());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setProvider("local");
        
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "회원가입 완료"));
    }

    // 로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        Optional<User> found = userRepository.findByEmail(req.getEmail());

        if (found.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "이메일 또는 비밀번호가 틀렸습니다."));
        }

        User user = found.get();
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "이메일 또는 비밀번호가 틀렸습니다."));
        }

        return ResponseEntity.ok(UserProfileResponse.from(user));
    }

    // 위치 공유 허용 설정 — 프론트(api/auth.js)가 이 주소를 쓰고 있어 경로는 유지한다.
    // 현재 값은 GET /api/users/{id} 응답의 locationShareEnabled 로 확인한다.
    @PutMapping("/users/{id}/location-sharing")
    public ResponseEntity<?> updateLocationSharing(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }
        // enabled 가 빠지면 boolean 으로 풀 때 NullPointerException(500)이 나서 먼저 막는다
        Boolean enabled = body == null ? null : body.get("enabled");
        if (enabled == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "enabled(true/false) 값이 필요합니다."));
        }
        user.setLocationShareEnabled(enabled);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of(
            "id", user.getId(),
            "locationShareEnabled", user.isLocationShareEnabled()
        ));
    }
}
