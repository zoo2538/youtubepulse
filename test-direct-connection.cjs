const { Pool } = require('pg');

// Railway에서 제공한 DATABASE_URL을 여기에 붙여넣으세요
const DATABASE_URL = 'postgresql://postgres:BlGEBWGugDMYSVxHZXgXKOEoWpmXjyhy@shortline.proxy.rlwy.net:25302/railway';

console.log('🔍 Railway PostgreSQL 직접 연결 테스트...');

if (DATABASE_URL === 'YOUR_RAILWAY_DATABASE_URL_HERE') {
  console.log('❌ DATABASE_URL을 Railway 대시보드에서 복사해서 붙여넣어주세요.');
  console.log('📋 Railway 대시보드 → PostgreSQL 서비스 → Connect → Public Network');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
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
