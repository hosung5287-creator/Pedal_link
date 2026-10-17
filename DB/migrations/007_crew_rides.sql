-- ============================================================
-- 007: 크루 라이딩 ("이번주 라이딩 열기")
--
-- 흐름: 팀장이 멤버·코스·날짜로 연다 → 크루 채팅 초대 카드로 참여/불참 응답(참여 시 토큰)
--       → 라이딩 당일 팀장이 인원 체크(팀장 220m 안 + 유효 토큰) → 라이딩 시작(파티를 만들어 라이딩 화면)
--
-- 로컬은 ddl-auto=update 로 자동 반영되지만, VM(ddl-auto=validate)은 이 파일을 먼저 실행해야 백엔드가 뜬다.
-- 여러 번 실행해도 안전하다.
-- ============================================================

-- 1. crew_events — 코스·상태·생성된 파티
ALTER TABLE crew_events ADD COLUMN IF NOT EXISTS route_id BIGINT;
ALTER TABLE crew_events ADD COLUMN IF NOT EXISTS status   VARCHAR(20) DEFAULT 'recruiting';  -- recruiting | checking | riding | canceled
ALTER TABLE crew_events ADD COLUMN IF NOT EXISTS party_id BIGINT;

-- 2. 초대된 멤버 · 응답 · 토큰 · 체크
CREATE TABLE IF NOT EXISTS crew_event_members (
    id               BIGSERIAL PRIMARY KEY,
    event_id         BIGINT      NOT NULL REFERENCES crew_events(id) ON DELETE CASCADE,
    user_id          BIGINT      NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
    status           VARCHAR(20) NOT NULL DEFAULT 'invited',          -- invited | accepted | declined | checked
    token            VARCHAR(36),                                     -- 참여 확정 시 발급 (서버에서만 확인)
    token_expires_at TIMESTAMP(6),                                    -- 라이딩 날짜 당일 23:59:59
    responded_at     TIMESTAMP(6),
    checked_at       TIMESTAMP(6),
    CONSTRAINT uk_crew_event_members_event_user UNIQUE (event_id, user_id)
);
