package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

// 좌표 → 지역(구) 이름.
// 좌표가 들어 있는 서울 구 경계(seoul_gu, DB/migrations/005)로 찾는다 — 외부 API 키가 필요 없다.
// 자전거도로(cycleways)의 구 표기는 부정확해서(잠실 → 강남구 등) 쓰지 않는다.
// 005 마이그레이션의 기존 코스 채우기도 같은 규칙이라 한쪽을 바꾸면 같이 바꾼다.
@Slf4j
@Service
@RequiredArgsConstructor
public class RegionService {

    private static final String GU_AT_POINT_SQL =
            "SELECT name FROM seoul_gu WHERE ST_Covers(geom, ST_SetSRID(ST_MakePoint(?, ?), 4326)) LIMIT 1";

    private final JdbcTemplate jdbcTemplate;

    // 서울 밖이면 null. 경계 테이블이 없으면(005 미적용 DB) 경고만 남기고 null — 코스 저장은 막지 않는다.
    public String findGu(Double lat, Double lng) {
        if (lat == null || lng == null) return null;
        try {
            List<String> names = jdbcTemplate.queryForList(GU_AT_POINT_SQL, String.class, lng, lat);
            return names.isEmpty() ? null : names.get(0);
        } catch (DataAccessException e) {
            log.warn("지역(구) 조회 실패 — DB/migrations/005_backfill_route_region.sql 을 적용했는지 확인: {}", e.getMessage());
            return null;
        }
    }
}
