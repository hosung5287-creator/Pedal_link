package com.example.demo.controller;

import com.example.demo.dto.EmailChangeRequest;
import com.example.demo.dto.PasswordChangeRequest;
import com.example.demo.dto.ProfileUpdateRequest;
import com.example.demo.dto.UserProfileResponse;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    // 프론트 회원가입(SignupPage)과 같은 규칙 — 한쪽만 바뀌지 않도록 같이 맞춰야 한다
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @GetMapping("/{id}")
    public ResponseEntity<?> getProfile(@PathVariable Long id) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }
        return ResponseEntity.ok(UserProfileResponse.from(user));
    }

    // 보낸 필드만 반영한다 — null 로 온 필드는 기존 값을 그대로 둔다
    @PutMapping("/{id}/profile")
    public ResponseEntity<?> updateProfile(@PathVariable Long id, @RequestBody ProfileUpdateRequest req) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }

        if (req.getProfileImageUrl() != null) user.setProfileImageUrl(req.getProfileImageUrl());
        if (req.getBio() != null) user.setBio(req.getBio());
        if (req.getBikeInfo() != null) user.setBikeInfo(req.getBikeInfo());
        if (req.getGender() != null) user.setGender(req.getGender());
        if (req.getAge() != null) user.setAge(req.getAge());
        if (req.getRegion() != null) user.setRegion(req.getRegion());

        userRepository.save(user);
        return ResponseEntity.ok(UserProfileResponse.from(user));
    }

    // 이메일 변경 — 이메일이 곧 로그인 아이디라서 현재 비밀번호로 본인 확인을 한다
    @PutMapping("/{id}/email")
    public ResponseEntity<?> changeEmail(@PathVariable Long id, @RequestBody EmailChangeRequest req) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }
        if (user.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "소셜 로그인 계정은 이메일을 변경할 수 없습니다."));
        }

        String newEmail = req.getNewEmail() == null ? "" : req.getNewEmail().trim();
        if (!EMAIL_PATTERN.matcher(newEmail).matches()) {
            return ResponseEntity.badRequest().body(Map.of("message", "올바른 이메일 형식이 아닙니다."));
        }
        if (newEmail.equals(user.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("message", "현재 사용 중인 이메일과 같습니다."));
        }
        if (req.getCurrentPassword() == null || !passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "현재 비밀번호가 틀렸습니다."));
        }
        if (userRepository.findByEmail(newEmail).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("message", "이미 사용 중인 이메일입니다."));
        }

        user.setEmail(newEmail);
        userRepository.save(user);
        return ResponseEntity.ok(UserProfileResponse.from(user));
    }

    // 비밀번호 변경 — 응답에 비밀번호 관련 값은 싣지 않는다
    @PutMapping("/{id}/password")
    public ResponseEntity<?> changePassword(@PathVariable Long id, @RequestBody PasswordChangeRequest req) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }
        if (user.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다."));
        }

        String newPassword = req.getNewPassword();
        if (newPassword == null || newPassword.length() < MIN_PASSWORD_LENGTH) {
            return ResponseEntity.badRequest().body(Map.of("message", "새 비밀번호는 " + MIN_PASSWORD_LENGTH + "자 이상이어야 합니다."));
        }
        if (req.getCurrentPassword() == null || !passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("message", "현재 비밀번호가 틀렸습니다."));
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "현재 비밀번호와 다른 비밀번호를 입력하세요."));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 변경되었습니다."));
    }
}
