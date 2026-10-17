-- ============================================================
-- 010: 프로필 "한마디 조언" — 라이딩 통계가 바뀔 때마다 Claude 가 새로 쓰는 한 문장을 사용자당 1건 저장
--
-- stats       : 조언을 만들 때의 통계(JSON). 지금 통계와 다르면 프로필을 열 때 새 조언을 만든다.
-- recent_tips : 최근 조언(JSON 배열, 최신순 최대 5개) — 같은 말을 반복하지 않게 Claude 에 같이 보낸다.
-- VM(ddl-auto=validate)은 이 파일을 먼저 실행해야 백엔드가 뜬다. 여러 번 실행해도 안전하다.
-- ============================================================

CREATE TABLE IF NOT EXISTS ride_tips (
    user_id     BIGINT       PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    tip         VARCHAR(300) NOT NULL,
    stats       TEXT         NOT NULL,
    recent_tips TEXT         NOT NULL,
    model       VARCHAR(60)  NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);
