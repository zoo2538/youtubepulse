/**
 * PostgreSQL Pool 안정화 설정
 * Railway 환경에 최적화된 연결 풀 설정
 */

const { Pool } = require('pg');

// Railway 환경 감지
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME;

// 기본 설정
const defaultConfig = {
  // 연결 풀 크기 (Railway 메모리 제한 고려)
  max: isRailway ? 3 : 5,
  min: 1,
  
  // 타임아웃 설정
  connectionTimeoutMillis: 5000,  // 연결 타임아웃 5초
  idleTimeoutMillis: 10000,       // 유휴 연결 타임아웃 10초
  query_timeout: 15000,           // 쿼리 타임아웃 15초
  
  // SSL 설정 (Railway 필수)
  ssl: isRailway ? { rejectUnauthorized: false } : false,
  
  // 연결 유지 설정
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // 에러 처리
  allowExitOnIdle: true,
};

// DATABASE_URL 파싱 및 설정 병합
function createPool() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
  }
  
  console.log('🔗 PostgreSQL 연결 풀 생성 중...');
  console.log(`📍 환경: ${isRailway ? 'Railway' : '로컬'}`);
  console.log(`📊 풀 크기: ${defaultConfig.max}`);
  console.log(`⏱️  연결 타임아웃: ${defaultConfig.connectionTimeoutMillis}ms`);
  
  // URL에 추가 파라미터 병합
  const url = new URL(databaseUrl);
  const params = url.searchParams;
  
  // SSL 모드 확인 및 강제 설정
  if (isRailway && !params.get('sslmode')) {
    params.set('sslmode', 'require');
    console.log('🔒 SSL 모드를 require로 설정');
  }
  
  // 연결 타임아웃 설정
  if (!params.get('connect_timeout')) {
    params.set('connect_timeout', '30');
    console.log('⏱️  연결 타임아웃을 30초로 설정');
  }
  
  // 수정된 URL로 설정 생성
  const finalUrl = url.toString();
  const config = {
    connectionString: finalUrl,
    ...defaultConfig
  };
  
  const pool = new Pool(config);
  
  // 연결 풀 이벤트 리스너
  pool.on('connect', (client) => {
    console.log('✅ PostgreSQL 클라이언트 연결됨');
    
    // 쿼리 타임아웃 설정
    client.query('SET statement_timeout = 15000');
  });
  
  pool.on('error', (err) => {
    console.error('❌ PostgreSQL 연결 풀 오류:', err);
  });
  
  pool.on('remove', () => {
    console.log('🔌 PostgreSQL 클라이언트 연결 해제됨');
  });
  
  return pool;
}

// 풀 상태 확인 함수
async function checkPoolHealth(pool) {
  try {
    const client = await pool.connect();
    
    // 기본 연결 테스트
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    
    // 풀 상태 정보
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
    
    client.release();
    
    return {
      healthy: true,
      timestamp: result.rows[0].current_time,
      version: result.rows[0].version,
      poolStats
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      code: error.code
    };
  }
}

module.exports = {
  createPool,
  checkPoolHealth
};
