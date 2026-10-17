-- ============================================================
-- 013: 게시물 공개 시각 — [게시물 올리기]를 눌러야 피드에 나온다
--
-- 예전에는 코스를 저장만 해도 곧바로 피드에 공개됐다(게시물 여부를 구분하는 칸이 없었다).
-- 이제 published_at 이 있는 코스만 피드·사이드바 순위·북마크 대상이 된다.
-- 이미 글이나 태그가 붙은 코스는 "올린 것"으로 본다(올린 시각을 따로 몰라서 만든 시각을 넣는다).
-- VM(ddl-auto=validate)은 이 파일을 먼저 실행해야 백엔드가 뜬다. 여러 번 실행해도 안전하다.
-- ============================================================

ALTER TABLE routes ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

UPDATE routes
SET published_at = coalesce(created_at, now())
WHERE published_at IS NULL
  AND (nullif(btrim(description), '') IS NOT NULL OR nullif(btrim(tags), '') IS NOT NULL);

-- 피드는 올린 게시물만 최신순으로 읽는다
CREATE INDEX IF NOT EXISTS idx_routes_published ON routes (published_at DESC, id DESC) WHERE published_at IS NOT NULL;
