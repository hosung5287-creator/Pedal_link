package com.example.demo.controller;

import com.example.demo.dto.ProfileUpdateRequest;
import com.example.demo.dto.UserProfileResponse;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

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
}
