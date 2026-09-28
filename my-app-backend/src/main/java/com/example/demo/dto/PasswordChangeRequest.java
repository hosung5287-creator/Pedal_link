package com.example.demo.dto;

import lombok.Data;

// 비밀번호 변경 — 현재 비밀번호가 맞아야 새 비밀번호로 바꾼다
@Data
public class PasswordChangeRequest {
    private String currentPassword;
    private String newPassword;
}
