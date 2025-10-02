const { Pool } = require('pg');

console.log('🔍 Railway PostgreSQL 연결 테스트 시작...');
console.log('📋 DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '설정되지 않음');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  },
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

console.log('🔗 PostgreSQL 연결 시도 중...');

pool.connect()
  .then(async (client) => {
    console.log('✅ PostgreSQL 연결 성공!');
    
    try {
      // 데이터베이스 버전 확인
      const versionResult = await client.query('SELECT version()');
      console.log('📊 PostgreSQL 버전:', versionResult.rows[0].version.split(' ')[0]);
      
      // 테이블 목록 확인
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      console.log('📋 사용 가능한 테이블들:');
      if (tablesResult.rows.length > 0) {
        tablesResult.rows.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
      } else {
        console.log('  (테이블이 없습니다)');
      }
      
      // 연결 테스트
      const testResult = await client.query('SELECT NOW() as current_time');
      console.log('⏰ 현재 시간:', testResult.rows[0].current_time);
      
      console.log('🎉 모든 테스트 통과! PostgreSQL이 정상적으로 작동합니다.');
      
    } catch (error) {
      console.error('❌ 쿼리 실행 중 오류:', error.message);
    } finally {
      client.release();
      await pool.end();
      console.log('🔚 연결 종료');
    }
  })
  .catch((error) => {
    console.error('❌ PostgreSQL 연결 실패:', error.message);
    console.error('🔍 오류 상세:', error);
    process.exit(1);
  });
