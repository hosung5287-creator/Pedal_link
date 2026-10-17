package com.example.demo.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPOutputStream;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.RequestHeader;

@RestController
@RequiredArgsConstructor
public class CyclewayController {

    private final DataSource dataSource;

    // 자전거도로 데이터는 서버가 도는 동안 바뀌지 않는다(ogr2ogr 로 한 번 넣은 정적 데이터).
    // 지도를 열 때마다 2,673개 도로를 DB 에서 꺼내 1MB 문자열을 다시 만들던 것을 한 번만 만들어 재사용한다.
    // 데이터를 다시 넣었으면 서버를 재시작하면 된다.
    // 압축본도 한 번만 만든다 — 요청마다 1MB 를 gzip 하면 서버가 매번 약 60ms 를 쓴다 (1.06MB → 약 195KB)
    private volatile byte[] cachedJson;
    private volatile byte[] cachedGzip;

    @GetMapping("/api/cycleways")
    public ResponseEntity<?> getCycleways(@RequestHeader(value = HttpHeaders.ACCEPT_ENCODING, required = false) String acceptEncoding) {
        if (cachedJson == null) {
            synchronized (this) {
                if (cachedJson == null) {
                    try {
                        byte[] json = buildGeoJson().getBytes(StandardCharsets.UTF_8);
                        cachedGzip = gzip(json);
                        cachedJson = json;
                    } catch (Exception e) {
                        return ResponseEntity.status(500).body("DB 오류: " + e.getMessage());
                    }
                }
            }
        }
        boolean gzipOk = acceptEncoding != null && acceptEncoding.contains("gzip");
        // 브라우저도 1시간 동안 다시 받지 않게 한다. Content-Encoding 을 직접 붙이면 서버 자동 압축은 다시 하지 않는다.
        ResponseEntity.BodyBuilder res = ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING)
                .contentType(MediaType.APPLICATION_JSON);
        if (gzipOk) res.header(HttpHeaders.CONTENT_ENCODING, "gzip");
        return res.body(gzipOk ? cachedGzip : cachedJson);
    }

    private static byte[] gzip(byte[] data) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(data.length / 4);
        try (GZIPOutputStream gz = new GZIPOutputStream(out)) {
            gz.write(data);
        }
        return out.toByteArray();
    }

    private String buildGeoJson() throws Exception {
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

        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":\"FeatureCollection\",\"features\":[");
        for (int i = 0; i < features.size(); i++) {
            sb.append(features.get(i));
            if (i < features.size() - 1) sb.append(",");
        }
        sb.append("]}");
        return sb.toString();
    }

    private String jsonStr(String val) {
        if (val == null) return "null";
        return "\"" + val.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}