package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

// 피드 한 페이지 (GET /api/feed/page) — hasNext 가 true 면 화면에 [더 보기] 를 보여준다
@Data
@AllArgsConstructor
public class FeedPageResponse {
    private List<FeedResponse> items;
    private int page;
    private int size;
    private boolean hasNext;
}
