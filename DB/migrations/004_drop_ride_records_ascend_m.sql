-- ============================================================
-- 004: ride_records.ascend_m 중복 컬럼 제거
--
-- routes.ascend_m 과 별개로 ride_records 에도 스냅샷용 ascend_m 을
-- 추가했었는데, 같은 값이 두 테이블에 나뉘어 저장되어 용량이 늘어난다.
-- routeId 로 routes 를 조인해서 상승고도를 구하도록 바꾸고
-- ride_records 쪽 컬럼은 제거한다.
-- ============================================================

-- 주의: RideRecord.ascendM 필드에 @Column(name="ascend_m") 지정이 없어서
-- Hibernate 기본 네이밍으로 실제 컬럼명은 "ascendm" (언더스코어 없음) 이다.
ALTER TABLE ride_records DROP COLUMN IF EXISTS ascendm;
