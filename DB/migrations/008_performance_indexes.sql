-- ============================================================
-- 008: 성능 — 자주 조회하는 컬럼 인덱스 · 중복 유니크 정리 · 통계 갱신
--
-- 데이터가 늘면 아래 조회들이 전체 테이블을 훑게 된다. 지금 쓰는 조회 기준으로만 건다.
-- 여러 번 실행해도 안전하다 (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- 1. 조회 인덱스
-- 내 코스 목록·피드 (user_id 로 거르고 최신순)
CREATE INDEX IF NOT EXISTS idx_routes_user_created        ON routes (user_id, created_at DESC);
-- 프로필 라이딩 통계·기록
CREATE INDEX IF NOT EXISTS idx_ride_records_user_rided    ON ride_records (user_id, rided_at DESC);
-- 파티 목록·내 파티 (멤버로 찾기, 호스트로 찾기, 끝나지 않은 파티)
CREATE INDEX IF NOT EXISTS idx_party_members_user         ON party_members (user_id);
CREATE INDEX IF NOT EXISTS idx_parties_host               ON parties (host_user_id);
CREATE INDEX IF NOT EXISTS idx_parties_status_created     ON parties (status, created_at DESC);
-- 채팅 기록 (방 번호로 거르고 시간순)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crew_chat_crew_created     ON crew_chat_messages (crew_id, created_at);
-- 크루 · 크루 라이딩 (5초마다 "라이딩 중인 크루 라이딩" 확인)
CREATE INDEX IF NOT EXISTS idx_crew_members_user          ON crew_members (user_id);
CREATE INDEX IF NOT EXISTS idx_crews_leader               ON crews (leader_user_id);
CREATE INDEX IF NOT EXISTS idx_crew_events_crew_status    ON crew_events (crew_id, status);
CREATE INDEX IF NOT EXISTS idx_crew_events_status         ON crew_events (status);
CREATE INDEX IF NOT EXISTS idx_crew_event_members_user    ON crew_event_members (user_id);
-- 매칭 신청 (5초마다 받은·보낸 신청 확인)
CREATE INDEX IF NOT EXISTS idx_match_requests_to_status   ON match_requests (to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_match_requests_from_status ON match_requests (from_user_id, status);
-- 피드 "내가 좋아요 누른 코스" (route_id 쪽은 유니크 인덱스가 이미 있다)
CREATE INDEX IF NOT EXISTS idx_route_likes_user           ON route_likes (user_id);
-- 자전거도로 공간 인덱스 (좌표로 찾는 조회가 생겨도 빠르게)
CREATE INDEX IF NOT EXISTS idx_cycleways_geom             ON cycleways USING GIST (geom);

-- 2. 같은 일을 하는 유니크 제약이 두 개씩 있어 쓸 때마다 인덱스를 두 번 갱신한다 → 하나만 남긴다
--    같은 컬럼 조합의 유니크 제약이 "하나 더 있을 때만" 지운다 — 하나뿐인 DB 에서 유일성 검사가 사라지지 않게.
--    party_members: Hibernate 이름(uk...)은 ddl-auto=update 가 다시 만들므로 예전 SQL 이름 쪽을 지운다.
--    likes · saved_posts: 지금 코드에서 쓰지 않는 테이블 — 이름이 읽히는 원래 제약을 남기고 uk... 쪽을 지운다.
DO $$
DECLARE
    target RECORD;
BEGIN
    FOR target IN
        SELECT * FROM (VALUES
            ('party_members', 'party_members_party_id_user_id_key'),
            ('likes',         'uk2jovqhqo324cubdomovkex03b'),
            ('saved_posts',   'ukrp4caf9aruyad4113wv29bowp')
        ) AS t(tbl, con)
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_constraint other
              ON other.conrelid = c.conrelid AND other.contype = 'u'
             AND other.conname <> c.conname AND other.conkey = c.conkey
            WHERE c.conrelid = to_regclass(target.tbl) AND c.conname = target.con
        ) THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target.tbl, target.con);
            RAISE NOTICE '중복 유니크 제거: %.%', target.tbl, target.con;
        END IF;
    END LOOP;
END $$;

-- 3. 통계 갱신 — cycleways 가 실제 2,673건인데 통계상 0건이라 쿼리 계획이 틀어질 수 있었다
ANALYZE;
