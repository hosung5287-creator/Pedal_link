package com.example.demo.dto;

import lombok.Data;

// 이메일 변경 — 본인 확인용으로 현재 비밀번호를 함께 받는다
@Data
public class EmailChangeRequest {
    private String currentPassword;
    private String newEmail;
}
