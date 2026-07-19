package com.example.demo.repository;


import org.springframework.data.jpa.repository.JpaRepository;  // JpaRepository

import com.example.demo.entity.*;

import java.util.List;
import java.util.Optional; 


public interface RouteRepository extends JpaRepository<Route, Long> {

    // 가장 최근 경로 1개 조회
    //Optional<Route> findTopByOrderByCreatedAtDesc();
    
    List<Route> findAllByOrderByCreatedAtDesc();

    List<Route> findByUserIdOrderByCreatedAtDesc(Long userId);
}
