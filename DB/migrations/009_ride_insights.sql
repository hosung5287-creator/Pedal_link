-- ============================================================
-- 009: 프로필 AI 라이딩 리포트 — Claude 가 만든 한줄 요약·조언을 사용자당 1건 저장
--
-- 라이딩 기록이 그대로면 저장된 결과를 다시 보여주고 Claude 를 또 부르지 않는다(비용 절약).
-- 기록이 바뀌었는지는 ride_count · last_ride_id 로 판단한다.
-- VM(ddl-auto=validate)은 이 파일을 먼저 실행해야 백엔드가 뜬다. 여러 번 실행해도 안전하다.
-- ============================================================

CREATE TABLE IF NOT EXISTS ride_insights (
    user_id      BIGINT       PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    level        VARCHAR(20)  NOT NULL,          -- 입문 | 초급 | 중급 | 상급
    summary      VARCHAR(300) NOT NULL,          -- 한줄 요약
    advice       TEXT         NOT NULL,          -- 조언 목록 (JSON 문자열 배열)
    ride_count   INTEGER      NOT NULL,          -- 분석할 때의 라이딩 기록 수
    last_ride_id BIGINT,                         -- 분석할 때의 가장 최근 기록 id
    model        VARCHAR(60)  NOT NULL,          -- 분석에 쓴 Claude 모델
    created_at   TIMESTAMP    NOT NULL DEFAULT now()
);
