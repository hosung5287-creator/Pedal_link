package com.example.demo.dto;

import lombok.Data;
import java.util.List;

// 저장된 경로 목록에서 지우기 — userId 의 코스만 지우고, 저장한 다른 사람의 코스는 저장만 취소한다
@Data
public class RouteDeleteRequest {
    private Long userId;
    private List<Long> ids;
}
