-- ============================================================
-- 015: 게시물 사진 — [게시물 올리기]에서 붙인 사진 한 장
--
-- 화면은 사진을 긴 변 1280px · 300KB 안팎 JPEG 로 줄여 data URL 로 보낸다(utils/image.js).
-- 예전에는 서버가 사진을 받지 않아 올려도 사라졌다.
-- 코스(routes)는 목록·피드·좋아요 처리 등에서 통째로 읽혀서 사진은 따로 둔다 — GET /api/routes/{id}/photo 로만 읽는다.
-- 코스가 지워지면 사진도 같이 지워진다.
-- VM(ddl-auto=validate)은 이 파일을 먼저 실행해야 백엔드가 뜬다. 여러 번 실행해도 안전하다.
-- ============================================================

CREATE TABLE IF NOT EXISTS route_photos (
    route_id     BIGINT      PRIMARY KEY REFERENCES routes (id) ON DELETE CASCADE,
    content_type VARCHAR(30) NOT NULL,
    data         BYTEA       NOT NULL,
    updated_at   TIMESTAMP   NOT NULL DEFAULT now()
);
