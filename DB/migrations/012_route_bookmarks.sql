-- ============================================================
-- 012: 피드 북마크 — 다른 사람의 코스를 내 "저장된 경로 목록"에 담는다
--
-- 코스를 복사하지 않고 "누가 어떤 코스를 저장했는지"만 남긴다(복사하면 피드에 같은 코스가 또 올라간다).
-- 원작자가 코스를 지우면 저장 기록도 같이 지워지고, 탈퇴한 사용자의 저장 기록도 지워진다.
-- VM(ddl-auto=validate)은 이 파일을 먼저 실행해야 백엔드가 뜬다. 여러 번 실행해도 안전하다.
-- ============================================================

CREATE TABLE IF NOT EXISTS route_bookmarks (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    route_id   BIGINT    NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uk_route_bookmarks_user_route UNIQUE (user_id, route_id)
);

-- 코스가 지워질 때 저장 기록을 찾는 쪽 (user_id 쪽은 위 유니크 인덱스가 맡는다)
CREATE INDEX IF NOT EXISTS idx_route_bookmarks_route ON route_bookmarks (route_id);
