const express = require('express');
const cors = require('cors');
const pool = require('./db'); // PostgreSQL pool 연결 객체

const app = express();
app.use(cors());
app.use(express.json());

// 📍 1. 실시간 라이더 위치 업데이트 API (1인당 1행 유지 - UPSERT)
app.post('/api/rider/location', async (req, res) => {
  const { riderId, latitude, longitude } = req.body;

  if (!riderId || latitude == null || longitude == null) {
    return res.status(400).json({ error: 'riderId, latitude, longitude는 필수 입력사항입니다.' });
  }

  try {
    // rider_id가 이미 있으면 UPDATE, 없으면 INSERT (UPSERT)
    const query = `
      INSERT INTO rider_real_time_location (rider_id, latitude, longitude, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (rider_id)
      DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        updated_at = NOW();
    `;
    await pool.query(query, [riderId, latitude, longitude]);
    res.status(200).json({ success: true, message: '실시간 위치가 업데이트되었습니다.' });
  } catch (err) {
    console.error('실시간 위치 업데이트 에러:', err);
    res.status(500).json({ error: 'DB 업데이트 중 오류 발생' });
  }
});

// 🚴‍♂️ 2. 주행 완료 및 히스토리 기록 저장 API (누적 저장)
app.post('/api/rider/history', async (req, res) => {
  const {
    riderId,
    routeDistance,   // km 단위 (예: 12.5)
    startedAt,       // 시작 시간 (ISO String 또는 Date)
    endedAt,         // 종료 시간
    durationMinutes, // 주행 시간 (분)
    averageSpeed     // 평균 속도 (km/h)
  } = req.body;

  if (!riderId) {
    return res.status(400).json({ error: 'riderId가 필요합니다.' });
  }

  try {
    const query = `
      INSERT INTO rider_activity_history 
        (rider_id, route_distance, started_at, ended_at, duration_minutes, average_speed, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id;
    `;
    const values = [
      riderId,
      routeDistance || 0,
      startedAt || new Date(),
      endedAt || new Date(),
      durationMinutes || 0,
      averageSpeed || 0
    ];

    const result = await pool.query(query, values);
    res.status(201).json({
      success: true,
      historyId: result.rows[0].id,
      message: '주행 기록 히스토리가 성공적으로 저장되었습니다.'
    });
  } catch (err) {
    console.error('주행 기록 저장 에러:', err);
    res.status(500).json({ error: 'DB 저장 중 오류 발생' });
  }
});

// 서버 구동
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Node.js 서버가 ${PORT}번 포트에서 실행 중입니다.`);
});