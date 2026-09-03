-- ============================================================
-- 채팅 기능 DB 마이그레이션
--
-- 실행 방법 (DBeaver)
--   1. Pedal_link DB 커넥션 열기
--   2. 이 파일 전체를 SQL Editor에 붙여넣고 전체 실행 (Alt+X / Execute Script)
--   3. 아래 "확인용 쿼리"로 정상 반영됐는지 확인
--
-- 사전 조사 결과
--   users, parties 테이블에 PRIMARY KEY 제약조건이 없는 상태였음(id 컬럼은 있으나 PK 미설정).
--   기존 백엔드 부팅 로그에 뜨던
--   "참조되는 users/parties 테이블에는 기본키가 없습니다" FK 생성 경고가 바로 이 때문.
--   채팅 메시지의 room_id -> parties(id), sender_id -> users(id) FK를 걸려면
--   먼저 두 테이블에 PK를 보강해야 해서 0번 스텝으로 같이 처리함.
--   (참고: routes / ride_records / rider_records / route_likes / party_members / cycleways 도
--    같은 이유로 PK가 없는데, 채팅 기능과 무관해서 이 스크립트에서는 건드리지 않음.
--    필요하면 별도로 정리하는 게 좋음.)
-- ============================================================

BEGIN;

-- 0) 선행 조건: users / parties PK 보강 (이미 있으면 건너뜀 -> 여러 번 실행해도 안전)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE users ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'parties'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE parties ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 1) 채팅 메시지 테이블
--    컬럼명은 ChatMessage 엔티티(camelCase)를 Hibernate 기본 네이밍 전략으로 변환한
--    snake_case와 동일하게 맞춰서, 나중에 spring.jpa.hibernate.ddl-auto=update 로 백엔드가
--    다시 떠도 컬럼명이 어긋나 충돌하는 일이 없도록 함.
CREATE TABLE IF NOT EXISTS chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    room_id     BIGINT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    sender_id   BIGINT NOT NULL REFERENCES users(id),
    sender_name VARCHAR(255) NOT NULL,
    content     TEXT NOT NULL,
    type        VARCHAR(20) NOT NULL DEFAULT 'TEXT'
                CHECK (type IN ('TEXT', 'CODE', 'JOIN', 'LEAVE')),
    created_at  TIMESTAMP(6) NOT NULL DEFAULT now()
);

-- 2) 방(room)별 시간순 조회가 기본 쿼리 패턴이라 복합 인덱스로 커버
--    (ChatMessageRepository.findByRoomIdOrderByCreatedAtAsc 가 쓰는 패턴)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
    ON chat_messages (room_id, created_at);

COMMIT;

-- ============================================================
-- 확인용 쿼리 (실행 후 아래로 검증)
-- ============================================================
-- \d chat_messages
-- SELECT conrelid::regclass AS tbl, conname, contype
--   FROM pg_constraint
--  WHERE conrelid::regclass::text IN ('users','parties','chat_messages')
--  ORDER BY tbl;
