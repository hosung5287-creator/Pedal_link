package com.example.demo.repository;

import com.example.demo.entity.Crew;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CrewRepository extends JpaRepository<Crew, Long> {
    List<Crew> findAllByOrderByCreatedAtDesc();
}
