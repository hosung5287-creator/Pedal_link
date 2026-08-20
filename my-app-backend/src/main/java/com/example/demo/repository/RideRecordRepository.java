package com.example.demo.repository;

import com.example.demo.entity.RideRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RideRecordRepository extends JpaRepository<RideRecord, Long> {

    List<RideRecord> findByUserIdOrderByRidedAtDesc(Long userId);
}
