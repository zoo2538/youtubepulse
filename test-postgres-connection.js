// PostgreSQL 연결 테스트 스크립트
import { Pool } from 'pg';

console.log('🔍 PostgreSQL 연결 테스트 시작...');
console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('🔄 PostgreSQL 연결 시도 중...');
    const client = await pool.connect();
    console.log('✅ PostgreSQL 연결 성공!');
    
    // 테스트 쿼리 실행
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL 버전:', result.rows[0].version);
    
    // 테이블 목록 확인
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 테이블 목록:', tables.rows.map(row => row.table_name));
    
    client.release();
    console.log('🎉 PostgreSQL 연결 테스트 완료!');
    
  } catch (error) {
    console.error('❌ PostgreSQL 연결 실패:', error.message);
    console.error('❌ 에러 상세:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
