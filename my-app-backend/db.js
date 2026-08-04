const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',          // DB 사용자 ID
  host: 'localhost',
  database: 'Pedal_link',    // DB 이름
  password: 'your_password', // DB 비밀번호 (본인 비밀번호로 수정!)
  port: 5432,
});

module.exports = pool;