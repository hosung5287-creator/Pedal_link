package com.example.demo.entity;



import jakarta.persistence.*;
import lombok.Data;
import org.locationtech.jts.geom.LineString;
import java.time.LocalDateTime;

@Entity
@Table(name = "routes")
@Data
public class Route {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private Long userId;

    private String routeName;

    private Double fromLat;
    private Double fromLng;
    private String fromLabel;

    private Double toLat;
    private Double toLng;
    private String toLabel;

    // PostGIS LineString 타입으로 저장
    @Column(columnDefinition = "geometry(LineString, 4326)")
    private LineString bikePath;

    @Column(columnDefinition = "geometry(LineString, 4326)")
    private LineString shortestPath;

    private LocalDateTime createdAt = LocalDateTime.now();
}