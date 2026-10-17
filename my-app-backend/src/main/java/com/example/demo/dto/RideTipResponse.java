package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;

// 프로필 "한마디 조언" 응답.
// available: 서버에 Claude API 키가 있는지 / stale: 저장된 조언 뒤로 통계가 바뀌어 새로 만들 차례인지
@Data
@AllArgsConstructor
public class RideTipResponse {
    private boolean available;
    private boolean stale;
    private String tip; // 아직 없으면 null
    private LocalDateTime createdAt;
}
