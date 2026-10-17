package com.example.demo.repository;


import org.springframework.data.jpa.repository.JpaRepository;  // JpaRepository

import com.example.demo.entity.*;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional; 


public interface RouteRepository extends JpaRepository<Route, Long> {

    // 가장 최근 경로 1개 조회
    //Optional<Route> findTopByOrderByCreatedAtDesc();
    
    // 피드에 올린 게시물 전체 (최근에 올린 것부터) — 저장만 한 코스는 빠진다
    List<Route> findByPublishedAtIsNotNullOrderByPublishedAtDesc();

    List<Route> findByUserIdOrderByCreatedAtDesc(Long userId);

    // 목록에 필요한 칸만 — 경로 좌표(bike_path·shortest_path)는 크기가 커서 읽지 않는다
    interface RouteSummary {
        Long getId();
        String getRouteName();
        String getFromLabel();
        String getToLabel();
        Double getDistanceKm();
    }

    @Query("select r.id as id, r.routeName as routeName, r.fromLabel as fromLabel, r.toLabel as toLabel, r.distanceKm as distanceKm "
            + "from Route r where r.id in :ids")
    List<RouteSummary> findSummariesByIdIn(@Param("ids") Collection<Long> ids);

    // 피드 한 페이지 — [게시물 올리기]로 올린 코스만, 최근에 올린 것부터.
    // region(구 이름)이 있으면 그 구가 들어간 게시물만 ("마포구,강동구" 처럼 여러 구를 콤마로 저장한다)
    // limit 은 한 페이지 + 1 을 넘겨 "다음 페이지가 있는지" 를 같이 알아낸다.
    @Query(value = """
            select * from routes r
            where r.published_at is not null
              and (cast(:region as text) is null
                   or (',' || replace(coalesce(r.region, ''), ' ', '') || ',') like ('%,' || cast(:region as text) || ',%'))
            order by r.published_at desc, r.id desc
            limit :limit offset :offset
            """, nativeQuery = true)
    List<Route> findFeedPage(@Param("region") String region, @Param("limit") int limit, @Param("offset") long offset);

    // 피드 사이드바 "인기 코스" — 올린 게시물 중 좋아요 많은 순 (같으면 최근에 올린 순)
    @Query(value = """
            select r.id from routes r left join route_likes l on l.route_id = r.id
            where r.published_at is not null
            group by r.id
            order by count(l.id) desc, r.published_at desc, r.id desc
            limit :limit
            """, nativeQuery = true)
    List<Long> findTopLikedRouteIds(@Param("limit") int limit);

    // 피드 사이드바 "활발한 지역" — 올린 게시물의 출발지 이름 앞 두 단어("서울 마포구")별 게시물 수·올린 사람 수
    @Query(value = """
            select array_to_string((regexp_split_to_array(btrim(r.from_label), '\\s+'))[1:2], ' ') as name,
                   count(*) as posts, count(distinct r.user_id) as riders
            from routes r
            where r.published_at is not null and r.from_label is not null and btrim(r.from_label) <> ''
            group by 1
            order by posts desc, name
            limit :limit
            """, nativeQuery = true)
    List<Object[]> findTopRegions(@Param("limit") int limit);
}
