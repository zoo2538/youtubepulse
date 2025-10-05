
// Node.js로 유니크 제약 조건 적용
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function enforceUniqueConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 유니크 제약 조건 적용 중...');
    
    // SQL 스크립트 실행
    const sqlScript = fs.readFileSync('scripts/enforce-unique-constraints-final.sql', 'utf8');
    await client.query(sqlScript);
    
    console.log('✅ 유니크 제약 조건 적용 완료');
  } catch (error) {
    console.error('❌ 적용 실패:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

enforceUniqueConstraints().catch(console.error);
