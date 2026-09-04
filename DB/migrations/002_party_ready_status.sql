-- ============================================================
-- 파티 대기방 "준비 완료 / 준비 중" 상태
--
-- 실행 방법 (DBeaver): Pedal_link DB에 연결 후 SQL Editor에서 전체 실행
--
-- 참고: PartyMember 엔티티에 ready 필드를 추가했기 때문에, 이 스크립트를
--   실행하지 않아도 spring.jpa.hibernate.ddl-auto=update 가 백엔드 부팅 시
--   컬럼을 알아서 추가해준다(기본값 false). 다만 팀 공용 마이그레이션 이력을
--   남기기 위해 명시적으로도 기록해둠 — 여러 번 실행해도 안전(IF NOT EXISTS).
-- ============================================================

ALTER TABLE party_members
    ADD COLUMN IF NOT EXISTS ready BOOLEAN NOT NULL DEFAULT FALSE;
