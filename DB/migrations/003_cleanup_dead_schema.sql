-- ============================================================
-- 003: 죽은 스키마 정리
--
-- 제거 대상
--   1. users.login_id     — 전 사용자 NULL, 현행 인증에서 미사용
--   2. users.password_hash — 전 사용자 NULL, 현행 인증은 users.password (BCrypt)
--   3. routes 중 user_id IS NULL 행 — 소유자 없는 테스트 데이터
-- ============================================================

-- 1. 죽은 unique 인덱스 제거 (컬럼 삭제 전에 명시적으로 제거)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_login_id_key;

-- 2. 죽은 컬럼 제거
ALTER TABLE users DROP COLUMN IF EXISTS login_id;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- 3. 소유자 없는 경로 삭제
DELETE FROM routes WHERE user_id IS NULL;
