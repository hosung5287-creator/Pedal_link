package com.example.demo.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class CyclewayController {

    private final DataSource dataSource;

    @GetMapping("/api/cycleways")
    public ResponseEntity<?> getCycleways() {
        List<String> features = new ArrayList<>();

        String sql = "SELECT name, gu, highway, bicycle, surface, oneway, " +
                     "ST_AsGeoJSON(geom) AS geojson " +
                     "FROM cycleways";

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                StringBuilder feature = new StringBuilder();
                feature.append("{\"type\":\"Feature\",\"geometry\":");
                feature.append(rs.getString("geojson"));
                feature.append(",\"properties\":{");
                feature.append("\"name\":").append(jsonStr(rs.getString("name"))).append(",");
                feature.append("\"gu\":").append(jsonStr(rs.getString("gu"))).append(",");
                feature.append("\"highway\":").append(jsonStr(rs.getString("highway"))).append(",");
                feature.append("\"bicycle\":").append(jsonStr(rs.getString("bicycle"))).append(",");
                feature.append("\"surface\":").append(jsonStr(rs.getString("surface"))).append(",");
                feature.append("\"oneway\":").append(jsonStr(rs.getString("oneway")));
                feature.append("}}");
                features.add(feature.toString());
            }

        } catch (Exception e) {
            return ResponseEntity.status(500).body("DB 오류: " + e.getMessage());
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"FeatureCollection\",\"features\":[");
        for (int i = 0; i < features.size(); i++) {
            sb.append(features.get(i));
            if (i < features.size() - 1) sb.append(",");
        }
        sb.append("]}");

        return ResponseEntity.ok(sb.toString());
    }

    private String jsonStr(String val) {
        if (val == null) return "null";
        return "\"" + val.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}