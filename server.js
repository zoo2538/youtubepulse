import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 실행 중인 엔트리 파일 경로 로그 출력
console.log('🔍 ENTRY:', __filename);
console.log('🔍 CWD:', process.cwd());
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
console.log('🚀 FORCE RESTART TRIGGER - v2.0.0 -', new Date().toISOString());

// PostgreSQL 연결 풀 생성 (강화된 연결 관리)
let pool = null;
let isConnected = false;

// 환경 변수 충돌 방지 - PG* 변수 제거
const conflictingVars = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE'];
conflictingVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`🔧 충돌 변수 제거: ${varName}=${process.env[varName]}`);
    delete process.env[varName];
  }
});

// 0) ENV 강제 검증 + 로그
// 부팅 초기에 추가
const v = process.env.DATABASE_URL || '';
// 어떤 키가 들어왔는지 다국어 혼선 방지 차원에서 유사 키까지 덤프
const dump = Object.keys(process.env).filter(k =>
  /DATABASE_URL|데이터베이스_URL|DB_URL|POSTGRES_URL|PGDATABASE_URL/i.test(k)
);
console.log('ENV_DB_KEYS', dump, 'LEN', v.length);
if (!v.trim()) { 
  console.error('FATAL: DATABASE_URL empty or whitespace'); 
  process.exit(1); 
}
try { 
  const u = new URL(v.trim()); 
  console.log('DB URL OK host=', u.hostname, 'sslmode=', u.searchParams.get('sslmode')); 
}
catch(e){ 
  console.error('FATAL: DATABASE_URL parse failed:', e.message); 
  process.exit(1); 
}

if (process.env.DATABASE_URL) {
  console.log('🔍 DATABASE_URL 환경 변수 확인됨');
  console.log('🔍 DATABASE_URL 길이:', process.env.DATABASE_URL.length);
  console.log('🔍 DATABASE_URL 값:', process.env.DATABASE_URL);
  console.log('🔍 DATABASE_URL 시작:', process.env.DATABASE_URL.substring(0, 20));
  console.log('🔍 DATABASE_URL 끝:', process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 20));
  
  // DATABASE_URL 형식 검증
  if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL 형식이 올바르지 않습니다:', process.env.DATABASE_URL);
  } else {
    console.log('✅ DATABASE_URL 형식 검증 통과');
  }
  
  // SSL 설정 이중 정의 방지: sslmode=require를 sslmode=disable로 변경
  let databaseUrl = process.env.DATABASE_URL;
  console.log('🔍 원본 DATABASE_URL:', databaseUrl);
  
  if (databaseUrl.includes('sslmode=require')) {
    databaseUrl = databaseUrl.replace('sslmode=require', 'sslmode=disable');
    console.log('🔧 SSL 설정 변경: sslmode=require → sslmode=disable');
    console.log('🔧 수정된 DATABASE_URL:', databaseUrl);
  } else if (!databaseUrl.includes('sslmode=')) {
    // sslmode 파라미터가 없으면 disable 추가
    databaseUrl = databaseUrl + '?sslmode=disable';
    console.log('🔧 SSL 설정 추가: sslmode=disable');
    console.log('🔧 수정된 DATABASE_URL:', databaseUrl);
  }
  
  // 강제로 sslmode=disable 적용 (최종 보장)
  if (databaseUrl.includes('sslmode=')) {
    databaseUrl = databaseUrl.replace(/sslmode=[^&]*/, 'sslmode=disable');
  } else {
    databaseUrl = databaseUrl + '?sslmode=disable';
  }
  console.log('🔧 최종 강제 적용된 DATABASE_URL:', databaseUrl);
  console.log('🔧 DATABASE_URL 길이:', databaseUrl?.length || 0);
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      console.log('🔧 DATABASE_URL 호스트:', url.hostname);
      console.log('🔧 DATABASE_URL 포트:', url.port);
      console.log('🔧 DATABASE_URL sslmode:', url.searchParams.get('sslmode'));
    } catch (error) {
      console.log('❌ DATABASE_URL 파싱 오류:', error.message);
    }
  }
  
  try {
  // 1) Pool 생성은 ENV 검증 이후
  pool = new Pool({ connectionString: databaseUrl }); // 코드 ssl 옵션 제거, 문자열 한 곳만 사용
    console.log('✅ PostgreSQL 연결 풀 생성 완료 - 강제 재시작 트리거');
    
    // 2) 기동 확인용 쿼리
    pool.query('select 1').then(r => {
      console.log('PG select 1 OK:', r.rows);
    }).catch(e => {
      console.error('PG connect error:', e.message);
      process.exit(1); // 초기 연결 실패 시 즉시 종료(재시작으로 빨리 드러냄)
    });
    
    // 즉시 연결 테스트
    pool.connect()
      .then(client => {
        console.log('✅ PostgreSQL 데이터베이스 연결 성공');
        isConnected = true;
        
        // 테스트 쿼리 실행
        return client.query('SELECT version()');
      })
      .then(result => {
        console.log('📊 PostgreSQL 버전:', result.rows[0].version);
        
        // 테이블 목록 확인
        return pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
      })
      .then(tables => {
        console.log('📋 테이블 목록:', tables.rows.map(row => row.table_name));
        console.log('🎉 PostgreSQL 연결 및 쿼리 테스트 완료!');
      })
      .catch(err => {
        console.error('❌ PostgreSQL 데이터베이스 연결 실패:', err);
        console.error('❌ 연결 에러 상세:', err.message);
        pool = null;
        isConnected = false;
      });
  } catch (error) {
    console.error('❌ PostgreSQL 연결 풀 생성 실패:', error);
    pool = null;
    isConnected = false;
  }
} else {
  console.error('❌ DATABASE_URL 환경 변수가 설정되지 않음');
  console.error('❌ 사용 가능한 환경 변수:', Object.keys(process.env).filter(key => key.includes('DATABASE')));
}

// CORS 설정 (강화된 GitHub Pages 지원)
const allowedOrigins = [
  'http://localhost:8080', 
  'http://localhost:5173', 
  'https://youthbepulse.com',
  'https://www.youthbepulse.com',
  'https://api.youthbepulse.com',
  'https://zoo2538.github.io',  // GitHub Pages 도메인
  'https://zoo2538.github.io/youtubepulse'  // GitHub Pages 서브경로
];

app.use(cors({
  origin: (origin, callback) => {
    // origin이 undefined인 경우 (같은 도메인 요청) 허용
    if (!origin) return callback(null, true);
    
    // 허용된 origin인지 확인
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    console.log('🚫 CORS 차단된 origin:', origin);
    return callback(new Error('CORS 정책에 의해 차단됨'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// OPTIONS 요청에 대한 명시적 처리 (모든 경로) - Express 5 호환
app.options('/*splat', cors());

// JSON 파싱 (크기 제한 증가: 100MB)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// PostgreSQL 테이블 생성
async function createTables() {
  if (!pool) return;
  
  try {
    const client = await pool.connect();
    
    // 채널 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(255) UNIQUE NOT NULL,
        channel_name VARCHAR(255),
        description TEXT,
        category VARCHAR(100),
        sub_category VARCHAR(100),
        youtube_url VARCHAR(500),
        thumbnail_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 영상 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(255) UNIQUE NOT NULL,
        channel_id VARCHAR(255),
        title VARCHAR(500),
        description TEXT,
        view_count BIGINT DEFAULT 0,
        like_count BIGINT DEFAULT 0,
        comment_count BIGINT DEFAULT 0,
        published_at TIMESTAMP,
        thumbnail_url VARCHAR(500),
        duration VARCHAR(50),
        category VARCHAR(100),
        sub_category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'unclassified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(channel_id)
      )
    `);
    
    // 분류 데이터 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS classification_data (
        id SERIAL PRIMARY KEY,
        data_type VARCHAR(100) UNIQUE,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 미분류 데이터 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS unclassified_data (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255),
        channel_name VARCHAR(255),
        video_title VARCHAR(500),
        video_description TEXT,
        view_count BIGINT DEFAULT 0,
        like_count BIGINT DEFAULT 0,
        comment_count BIGINT DEFAULT 0,
        upload_date TIMESTAMP,
        collection_date TIMESTAMP,
        thumbnail_url VARCHAR(500),
        category VARCHAR(100),
        sub_category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'unclassified',
        day_key_local VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, day_key_local)
      )
    `);
    
    console.log('✅ PostgreSQL 테이블 생성 완료');
    client.release();
  } catch (error) {
    console.error('❌ PostgreSQL 테이블 생성 실패:', error);
  }
}

// 서버 시작 시 테이블 생성
createTables();

// 라우트 등록 로그
console.log('🔍 API 라우트 등록 완료:');
console.log('  - /api/health');
console.log('  - /api/debug-db');
console.log('  - /api/health-sql');
console.log('🚀 API 서버 준비 완료 - v2.0.0');

// API 라우트
app.get('/api/health', async (req, res) => {
  try {
    // PostgreSQL 연결이 없어도 서버는 정상 (옵셔널 DB)
    if (!pool) {
      return res.json({ 
        status: 'OK', 
        message: 'YouTube Pulse API Server', 
        database: 'Not configured (optional)', 
        poolExists: false,
        isConnected: false,
        timestamp: new Date().toISOString()
      });
    }

    // 실제 연결 시도로 DB 상태 판정
    const client = await pool.connect();
    try {
      // 경량 쿼리로 ping
      const result = await client.query('SELECT 1 as ok');
      res.json({ 
        status: 'OK', 
        message: 'YouTube Pulse API Server', 
        database: 'Connected', 
        poolExists: !!pool,
        isConnected: true,
        ok: result.rows?.[0]?.ok === 1,
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (e) {
    // DB 연결 실패해도 서버는 정상 (폴백 가능)
    res.json({ 
      status: 'OK', 
      message: 'YouTube Pulse API Server', 
      database: 'Connection failed (using fallback)', 
      poolExists: !!pool,
      isConnected: false,
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Railway 변수 주입 전용 점검용 엔드포인트
app.get('/api/env-len', (req, res) => {
  const v = process.env.DATABASE_URL || '';
  res.status(v.trim()?200:500).json({ len: v.length, empty: !v.trim() });
});

// 임시 디버그 엔드포인트 - 실제 DATABASE_URL 확인
app.get('/api/debug-db', (req, res) => {
  console.log('🔍 /api/debug-db 라우트 호출됨');
  try {
    const url = new URL(process.env.DATABASE_URL || '');
    const result = {
      rawUrl: process.env.DATABASE_URL,
      hostname: url.hostname,
      port: url.port,
      database: url.pathname,
      sslmode: url.searchParams.get('sslmode'),
      username: url.username,
      protocol: url.protocol,
      timestamp: new Date().toISOString()
    };
    console.log('🔍 DATABASE_URL 파싱 결과:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ DATABASE_URL 파싱 오류:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 개선된 health-sql 엔드포인트 - 실제 연결 시도로 판정
app.get('/api/health-sql', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ 
        ok: false, 
        error: 'Pool not initialized',
        poolExists: false,
        isConnected: false
      });
    }
    
    // 실제 연결 시도로 DB 상태 판정
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT 1 as ok, NOW() as current_time');
      res.json({ 
        ok: true, 
        rows: result.rows.length, 
        sample: result.rows[0],
        poolExists: !!pool,
        isConnected: true,
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      poolExists: !!pool,
      isConnected: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Railway 헬스 체크 엔드포인트
app.get('/api/health', async (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'YouTube Pulse API',
    timestamp: new Date().toISOString()
  });
});

// 헬스 체크 - DB 상태 및 Pool 정보
app.get('/health/db', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({
        status: 'DOWN',
        service: 'PostgreSQL',
        message: 'Database pool not initialized',
        poolExists: false,
        isConnected: false,
        timestamp: new Date().toISOString()
      });
    }

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT 1 as health_check, NOW() as current_time');
      const poolStatus = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };
      
      res.status(200).json({
        status: 'UP',
        service: 'PostgreSQL',
        message: 'Database connection healthy',
        queryResult: result.rows[0],
        poolStatus: poolStatus,
        poolExists: true,
        isConnected: true,
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Health check /health/db failed:', error.message);
    res.status(500).json({
      status: 'ERROR',
      service: 'PostgreSQL',
      message: 'Database connection error',
      error: error.message,
      poolExists: !!pool,
      isConnected: false,
      timestamp: new Date().toISOString()
    });
  }
});

// 데이터 동기화 API
app.post('/api/sync/channels', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { channels } = req.body;
    if (!channels || !Array.isArray(channels)) {
      return res.status(400).json({ error: 'Invalid channels data' });
    }
    
    const client = await pool.connect();
    
    for (const channel of channels) {
      await client.query(`
        INSERT INTO channels (channel_id, channel_name, description, category, sub_category, youtube_url, thumbnail_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (channel_id) 
        DO UPDATE SET 
          channel_name = EXCLUDED.channel_name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          sub_category = EXCLUDED.sub_category,
          youtube_url = EXCLUDED.youtube_url,
          thumbnail_url = EXCLUDED.thumbnail_url,
          updated_at = CURRENT_TIMESTAMP
      `, [
        channel.channelId,
        channel.channelName,
        channel.description,
        channel.category,
        channel.subCategory,
        channel.youtubeUrl,
        channel.thumbnailUrl
      ]);
    }
    
    client.release();
    res.json({ success: true, message: `${channels.length}개 채널 동기화 완료` });
  } catch (error) {
    console.error('채널 동기화 실패:', error);
    res.status(500).json({ error: 'Channel sync failed' });
  }
});

app.post('/api/sync/videos', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { videos } = req.body;
    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'Invalid videos data' });
    }
    
    const client = await pool.connect();
    
    for (const video of videos) {
      await client.query(`
        INSERT INTO videos (video_id, channel_id, title, description, view_count, like_count, comment_count, published_at, thumbnail_url, duration, category, sub_category, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (video_id) 
        DO UPDATE SET 
          channel_id = EXCLUDED.channel_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          view_count = EXCLUDED.view_count,
          like_count = EXCLUDED.like_count,
          comment_count = EXCLUDED.comment_count,
          published_at = EXCLUDED.published_at,
          thumbnail_url = EXCLUDED.thumbnail_url,
          duration = EXCLUDED.duration,
          category = EXCLUDED.category,
          sub_category = EXCLUDED.sub_category,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        video.videoId,
        video.channelId,
        video.title,
        video.description,
        video.viewCount || 0,
        video.likeCount || 0,
        video.commentCount || 0,
        video.publishedAt,
        video.thumbnailUrl,
        video.duration,
        video.category,
        video.subCategory,
        video.status || 'unclassified'
      ]);
    }
    
    client.release();
    res.json({ success: true, message: `${videos.length}개 영상 동기화 완료` });
  } catch (error) {
    console.error('영상 동기화 실패:', error);
    res.status(500).json({ error: 'Video sync failed' });
  }
});

app.post('/api/sync/classification', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Invalid classification data' });
    }
    
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
    `, ['classification', JSON.stringify(data)]);
    
    client.release();
    res.json({ success: true, message: '분류 데이터 동기화 완료' });
  } catch (error) {
    console.error('분류 데이터 동기화 실패:', error);
    res.status(500).json({ error: 'Classification sync failed' });
  }
});

// 수동수집 전용 분류 데이터 저장 API (수동수집과 자동수집 분리)
app.post('/api/classified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  let client;
  try {
    const newData = req.body;
    
    // 데이터 검증
    if (!Array.isArray(newData)) {
      console.error('❌ 잘못된 데이터 형식: 배열이 아님');
      return res.status(400).json({ error: 'Data must be an array' });
    }
    
    const dataSize = JSON.stringify(newData).length;
    console.log(`👤 수동수집 분류 데이터 크기: ${(dataSize / 1024 / 1024).toFixed(2)}MB, 개수: ${newData.length}개`);
    
    client = await pool.connect();
    
    // 1. 기존 전체 데이터 조회
    const existingResult = await client.query(
      `SELECT data FROM classification_data WHERE data_type = 'manual_classified'`
    );
    
    let existingData = [];
    if (existingResult.rows.length > 0 && existingResult.rows[0].data) {
      existingData = existingResult.rows[0].data;
    }
    
    console.log(`📊 기존 분류 데이터: ${existingData.length}개`);
    
    // 2. 새 데이터의 날짜 추출 (한국 시간 기준 dayKeyLocal, collectionDate, uploadDate)
    const newDates = new Set();
    newData.forEach(item => {
      const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      if (date) {
        const normalizedDate = date.includes('T') ? date.split('T')[0] : date;
        newDates.add(normalizedDate);
      }
    });
    
    console.log(`📊 업데이트할 날짜 (한국 시간): ${Array.from(newDates).join(', ')}`);
    
    // 3. 새 데이터의 날짜에 해당하지 않는 기존 데이터만 필터링
    const otherDatesData = existingData.filter(item => {
      const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      if (!date) return true; // 날짜 없는 항목은 유지
      
      const normalizedDate = date.includes('T') ? date.split('T')[0] : date;
      return !newDates.has(normalizedDate);
    });
    
    console.log(`📊 다른 날짜 분류 데이터: ${otherDatesData.length}개`);
    
    // 4. 병합: 다른 날짜 데이터 + 새 데이터
    const mergedData = [...otherDatesData, ...newData];
    
    console.log(`📊 병합된 전체 분류 데이터: ${mergedData.length}개 (다른 날짜: ${otherDatesData.length}개 + 새 데이터: ${newData.length}개)`);
    
    // 5. 병합된 데이터 저장
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
      ON CONFLICT (data_type) 
      DO UPDATE SET 
        data = EXCLUDED.data,
        created_at = CURRENT_TIMESTAMP
    `, ['manual_classified', JSON.stringify(mergedData)]);
    
    console.log(`✅ 분류 데이터 날짜별 병합 저장 완료: ${mergedData.length}개 항목`);
    
    // 분류된 항목들 로깅
    const classifiedCount = mergedData.filter(item => item.status === 'classified').length;
    console.log(`📊 분류 완료: ${classifiedCount}개, 미분류: ${mergedData.length - classifiedCount}개`);
    
    res.json({ 
      success: true, 
      message: 'Classified data saved',
      stats: {
        newItems: newData.length,
        preservedItems: otherDatesData.length,
        totalItems: mergedData.length,
        classifiedCount: classifiedCount,
        updatedDates: Array.from(newDates)
      }
    });
  } catch (error) {
    console.error('❌ 분류 데이터 저장 실패:', error);
    console.error('❌ 에러 메시지:', error.message);
    console.error('❌ 에러 스택:', error.stack);
    res.status(500).json({ 
      error: 'Failed to save classified data',
      details: error.message,
      code: error.code
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get('/api/classified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { date } = req.query;
    const client = await pool.connect();
    
    // unclassified_data 테이블에서 status='classified'이고 collection_type='manual'인 데이터 조회
    let query = `
      SELECT 
        id,
        video_id as "videoId",
        channel_id as "channelId",
        channel_name as "channelName",
        video_title as "videoTitle",
        video_description as "videoDescription",
        view_count as "viewCount",
        like_count as "likeCount",
        comment_count as "commentCount",
        upload_date as "uploadDate",
        collection_date as "collectionDate",
        thumbnail_url as "thumbnailUrl",
        category,
        sub_category as "subCategory",
        status,
        day_key_local as "dayKeyLocal",
        collection_type as "collectionType",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM unclassified_data
      WHERE status = 'classified' AND (collection_type = 'manual' OR collection_type IS NULL)
    `;
    
    const params = [];
    
    // 날짜별 필터링 (선택적)
    if (date) {
      query += ` AND day_key_local = $1`;
      params.push(date);
      console.log(`📅 날짜별 필터링: ${date}`);
    }
    
    query += ` ORDER BY view_count DESC`;
    
    const result = await client.query(query, params);
    client.release();
    
    // collectionType 기본값 설정 (기존 데이터 호환성)
    const data = result.rows.map(item => ({
      ...item,
      collectionType: item.collectionType || 'manual'
    }));
    
    console.log(`📊 분류 데이터 조회: ${data.length}개`);
    if (date) {
      console.log(`📅 날짜 (${date}): ${data.length}개`);
    }
    
    // 응답 형식: { success: true, data: [] }로 통일
    res.json({ success: true, data });
  } catch (error) {
    console.error('분류 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get classified data' });
  }
});

// 날짜별 전체 데이터 조회 (수동+자동, 분류+미분류 모두)
app.get('/api/unclassified-by-date', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    
    const client = await pool.connect();
    
    // unclassified_data 테이블에서 해당 날짜의 모든 데이터 조회 (status, collection_type 필터 없음)
    const query = `
      SELECT 
        id,
        video_id as "videoId",
        channel_id as "channelId",
        channel_name as "channelName",
        video_title as "videoTitle",
        video_description as "videoDescription",
        view_count as "viewCount",
        like_count as "likeCount",
        comment_count as "commentCount",
        upload_date as "uploadDate",
        collection_date as "collectionDate",
        thumbnail_url as "thumbnailUrl",
        category,
        sub_category as "subCategory",
        status,
        day_key_local as "dayKeyLocal",
        collection_type as "collectionType",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM unclassified_data
      WHERE day_key_local = $1
      ORDER BY view_count DESC
    `;
    
    const result = await client.query(query, [date]);
    client.release();
    
    // collectionType 기본값 설정
    const data = result.rows.map(item => ({
      ...item,
      collectionType: item.collectionType || 'manual'
    }));
    
    console.log(`📊 날짜별 전체 데이터 조회 (${date}): ${data.length}개 (분류+미분류 모두 포함)`);
    console.log(`   - status='classified': ${data.filter(item => item.status === 'classified').length}개`);
    console.log(`   - status='unclassified': ${data.filter(item => item.status === 'unclassified').length}개`);
    console.log(`   - collection_type='auto': ${data.filter(item => item.collectionType === 'auto').length}개`);
    console.log(`   - collection_type='manual': ${data.filter(item => item.collectionType === 'manual').length}개`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('날짜별 전체 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get data by date' });
  }
});

// 미분류 데이터 API (api-service.ts 호환)
app.post('/api/unclassified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  let client;
  try {
    const newData = req.body;
    
    // 데이터 검증
    if (!Array.isArray(newData)) {
      console.error('❌ 잘못된 데이터 형식: 배열이 아님');
      return res.status(400).json({ error: 'Data must be an array' });
    }
    
    const dataSize = JSON.stringify(newData).length;
    console.log(`📊 미분류 데이터 크기: ${(dataSize / 1024 / 1024).toFixed(2)}MB, 개수: ${newData.length}개`);
    
    client = await pool.connect();
    
    // 1. 기존 전체 데이터 조회
    const existingResult = await client.query(
      `SELECT data FROM classification_data WHERE data_type = 'unclassified'`
    );
    
    let existingData = [];
    if (existingResult.rows.length > 0 && existingResult.rows[0].data) {
      existingData = Array.isArray(existingResult.rows[0].data) ? existingResult.rows[0].data : [];
    }
    
    console.log(`📊 기존 미분류 데이터: ${existingData.length}개`);
    
    // 2. 새 데이터의 날짜 추출 (dayKeyLocal, collectionDate, uploadDate 순으로 확인)
    const newDates = new Set();
    newData.forEach(item => {
      const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      if (date) {
        const normalizedDate = date.includes('T') ? date.split('T')[0] : date;
        newDates.add(normalizedDate);
      }
    });
    
    console.log(`📊 업데이트할 날짜: ${Array.from(newDates).join(', ')}`);
    
    // 3. 새 데이터의 날짜에 해당하지 않는 기존 데이터만 필터링
    const otherDatesData = existingData.filter(item => {
      const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      if (!date) return true; // 날짜 없는 항목은 유지
      
      const normalizedDate = date.includes('T') ? date.split('T')[0] : date;
      return !newDates.has(normalizedDate);
    });
    
    console.log(`📊 다른 날짜 데이터: ${otherDatesData.length}개`);
    
    // 4. 병합: 다른 날짜 데이터 + 새 데이터
    const mergedData = [...otherDatesData, ...newData];
    
    console.log(`📊 병합된 전체 데이터: ${mergedData.length}개 (다른 날짜: ${otherDatesData.length}개 + 새 데이터: ${newData.length}개)`);
    
    // 5. 데이터 저장 (2가지 방식)
    
    // 5-1. classification_data 테이블에 저장 (전체 조회용 - 기존 방식 유지)
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
      ON CONFLICT (data_type) 
      DO UPDATE SET 
        data = EXCLUDED.data,
        created_at = CURRENT_TIMESTAMP
    `, ['unclassified', JSON.stringify(mergedData)]);
    console.log(`✅ classification_data 테이블 저장 완료: ${mergedData.length}개`);
    
    // 5-2. unclassified_data 테이블에 배치 UPSERT (분류 작업용)
    console.log(`💾 unclassified_data 테이블 배치 UPSERT 시작: ${newData.length}개`);
    
    // 배치 크기를 100개로 제한하여 타임아웃 방지
    const BATCH_SIZE = 100;
    const batches = [];
    for (let i = 0; i < newData.length; i += BATCH_SIZE) {
      batches.push(newData.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 ${batches.length}개 배치로 처리 (배치당 최대 ${BATCH_SIZE}개)`);
    
    let totalInsertCount = 0;
    let totalUpdateCount = 0;
    let totalErrorCount = 0;
    
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`📦 배치 ${batchIdx + 1}/${batches.length} 처리 중 (${batch.length}개)...`);
      
      for (const item of batch) {
        try {
          // day_key_local 계산
          const dayKeyLocal = item.dayKeyLocal || 
            (item.collectionDate ? (item.collectionDate.includes('T') ? item.collectionDate.split('T')[0] : item.collectionDate) : 
             (item.uploadDate ? (item.uploadDate.includes('T') ? item.uploadDate.split('T')[0] : item.uploadDate) : 
              new Date().toISOString().split('T')[0]));
          
        const result = await client.query(`
          INSERT INTO unclassified_data (
            video_id, channel_id, channel_name, video_title, 
            video_description, view_count, like_count, comment_count,
            upload_date, collection_date, thumbnail_url, 
            category, sub_category, status, day_key_local, collection_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (video_id, day_key_local) 
          DO UPDATE SET
            channel_id = EXCLUDED.channel_id,
            channel_name = EXCLUDED.channel_name,
            video_title = EXCLUDED.video_title,
            video_description = EXCLUDED.video_description,
            view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
            like_count = GREATEST(unclassified_data.like_count, EXCLUDED.like_count),
            comment_count = GREATEST(unclassified_data.comment_count, EXCLUDED.comment_count),
            thumbnail_url = EXCLUDED.thumbnail_url,
            category = EXCLUDED.category,
            sub_category = EXCLUDED.sub_category,
            status = EXCLUDED.status,
            collection_type = EXCLUDED.collection_type,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [
          item.videoId, 
          item.channelId, 
          item.channelName, 
          item.videoTitle,
          item.videoDescription, 
          item.viewCount || 0,
          item.likeCount || 0,
          item.commentCount || 0,
          item.uploadDate, 
          item.collectionDate,
          item.thumbnailUrl, 
          item.category || '', 
          item.subCategory || '', 
          item.status || 'unclassified',
          dayKeyLocal,
          item.collectionType || 'manual'
        ]);
          
          if (result.rows[0].inserted) {
            totalInsertCount++;
          } else {
            totalUpdateCount++;
          }
        } catch (itemError) {
          console.error(`❌ 항목 저장 실패 (${item.videoId}):`, itemError.message);
          totalErrorCount++;
        }
      }
      
      console.log(`✅ 배치 ${batchIdx + 1}/${batches.length} 완료`);
    }
    
    console.log(`✅ unclassified_data 테이블 저장 완료: 신규 ${totalInsertCount}개, 업데이트 ${totalUpdateCount}개, 오류 ${totalErrorCount}개`);
    
    res.json({ 
      success: true, 
      message: 'Unclassified data saved',
      stats: {
        newItems: newData.length,
        preservedItems: otherDatesData.length,
        totalItems: mergedData.length,
        updatedDates: Array.from(newDates)
      }
    });
  } catch (error) {
    console.error('❌ 미분류 데이터 저장 실패:', error);
    console.error('❌ 에러 메시지:', error.message);
    console.error('❌ 에러 스택:', error.stack);
    res.status(500).json({ 
      error: 'Failed to save unclassified data',
      details: error.message,
      code: error.code
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// 서버 데이터 ID 목록 조회 API (차분 업로드용)
app.get('/api/data/ids', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    
    // 미분류 데이터 ID 목록
    const unclassifiedResult = await client.query(`
      SELECT data->>'id' as id 
      FROM classification_data 
      WHERE data_type = 'unclassified'
    `);
    
    // 분류 데이터 ID 목록
    const classifiedResult = await client.query(`
      SELECT data->>'id' as id 
      FROM classification_data 
      WHERE data_type = 'classified'
    `);
    
    client.release();
    
    const unclassifiedIds = unclassifiedResult.rows.map(row => row.id).filter(Boolean);
    const classifiedIds = classifiedResult.rows.map(row => row.id).filter(Boolean);
    
    console.log(`📊 서버 데이터 ID: 미분류 ${unclassifiedIds.length}개, 분류 ${classifiedIds.length}개`);
    
    res.json({ 
      success: true, 
      data: { unclassifiedIds, classifiedIds }
    });
  } catch (error) {
    console.error('데이터 ID 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get data IDs' });
  }
});

// 14일 이상된 오래된 데이터 삭제 API
app.post('/api/data/cleanup', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { retentionDays = 14 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    console.log(`🗑️ ${retentionDays}일 이상된 데이터 삭제 시작 (기준: ${cutoffDateString} 이전)`);
    
    const client = await pool.connect();
    
    // 1. unclassified_data 테이블에서 오래된 데이터 삭제
    const unclassifiedResult = await client.query(`
      DELETE FROM unclassified_data
      WHERE day_key_local < $1
      RETURNING video_id
    `, [cutoffDateString]);
    
    const unclassifiedDeletedCount = unclassifiedResult.rowCount || 0;
    console.log(`🗑️ unclassified_data 테이블: ${unclassifiedDeletedCount}개 삭제`);
    
    // 2. classification_data 테이블에서 오래된 데이터 삭제
    const classificationResult = await client.query(`
      DELETE FROM classification_data
      WHERE (data->>'collectionDate')::date < $1
         OR (data->>'uploadDate')::date < $1
      RETURNING data_type
    `, [cutoffDateString]);
    
    const classificationDeletedCount = classificationResult.rowCount || 0;
    console.log(`🗑️ classification_data 테이블: ${classificationDeletedCount}개 삭제`);
    
    client.release();
    
    const totalDeletedCount = unclassifiedDeletedCount + classificationDeletedCount;
    console.log(`✅ 총 ${totalDeletedCount}개의 오래된 데이터 삭제 완료`);
    
    res.json({ 
      success: true, 
      message: `${totalDeletedCount}개의 오래된 데이터를 삭제했습니다.`,
      deletedCount: totalDeletedCount,
      unclassifiedDeleted: unclassifiedDeletedCount,
      classificationDeleted: classificationDeletedCount,
      cutoffDate: cutoffDateString
    });
  } catch (error) {
    console.error('데이터 정리 실패:', error);
    res.status(500).json({ error: 'Failed to cleanup old data' });
  }
});

app.get('/api/unclassified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { date, days } = req.query;
    const client = await pool.connect();
    
    // 항상 unclassified_data 테이블에서 직접 조회 (올바른 dayKeyLocal 보장)
    let query, params;
    if (date) {
      // 특정 날짜 데이터 조회
      query = `
        SELECT 
          id, video_id, channel_id, channel_name, video_title, 
          video_description, view_count, like_count, comment_count,
          upload_date, collection_date, thumbnail_url, 
          category, sub_category, status, collection_type, day_key_local
        FROM unclassified_data 
        WHERE day_key_local = $1
        ORDER BY view_count DESC
      `;
      params = [date];
    } else if (days) {
      // 최근 N일 데이터 조회 (오늘 포함)
      const daysCount = Math.min(Math.max(parseInt(days) || 7, 1), 30); // 1~30일로 제한
      
      // 날짜 계산 (KST 기준)
      const today = new Date();
      const kstToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const startDate = new Date(kstToday);
      startDate.setDate(startDate.getDate() - (daysCount - 1));
      const startDateString = startDate.toISOString().split('T')[0];
      
      console.log(`📅 최근 ${daysCount}일 데이터 조회: ${startDateString} ~ 오늘`);
      
      query = `
        SELECT 
          id, video_id, channel_id, channel_name, video_title, 
          video_description, view_count, like_count, comment_count,
          upload_date, collection_date, thumbnail_url, 
          category, sub_category, status, collection_type, day_key_local
        FROM unclassified_data 
        WHERE day_key_local >= $1
        ORDER BY collection_date DESC, view_count DESC
      `;
      params = [startDateString];
    } else {
      // 전체 데이터 조회 (unclassified_data 테이블에서 직접 조회)
      query = `
        SELECT 
          id, video_id, channel_id, channel_name, video_title, 
          video_description, view_count, like_count, comment_count,
          upload_date, collection_date, thumbnail_url, 
          category, sub_category, status, collection_type, day_key_local
        FROM unclassified_data 
        ORDER BY collection_date DESC, view_count DESC
      `;
      params = [];
    }
    
    const result = await client.query(query, params);
    client.release();
    
    // 조회 결과를 API 형식으로 변환
    const data = result.rows.map(row => {
      // day_key_local이 없으면 collection_date로부터 생성
      let dayKeyLocal = row.day_key_local;
      if (!dayKeyLocal) {
        const date = new Date(row.collection_date);
        const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        dayKeyLocal = kstDate.toISOString().split('T')[0];
      }
      
      return {
        id: row.id,
        videoId: row.video_id,
        channelId: row.channel_id,
        channelName: row.channel_name,
        videoTitle: row.video_title,
        videoDescription: row.video_description,
        viewCount: row.view_count,
        likeCount: row.like_count,
        commentCount: row.comment_count,
        uploadDate: row.upload_date,
        collectionDate: row.collection_date,
        dayKeyLocal: dayKeyLocal, // KST 기준 일자 키 추가
        thumbnailUrl: row.thumbnail_url,
        category: row.category || '',
        subCategory: row.sub_category || '',
        status: row.status || 'unclassified',
        collectionType: row.collection_type || 'manual'
      };
    });
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('미분류 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get unclassified data' });
  }
});

// 채널 데이터 API (api-service.ts 호환)
app.post('/api/channels', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { channels } = req.body;
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
    `, ['channels', JSON.stringify(channels)]);
    
    client.release();
    res.json({ success: true, message: 'Channels saved' });
  } catch (error) {
    console.error('채널 데이터 저장 실패:', error);
    res.status(500).json({ error: 'Failed to save channels' });
  }
});

// 개별 비디오 수정 API (PATCH /api/videos/:id)
app.patch('/api/videos/:id', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const updateData = req.body;
    const client = await pool.connect();
    
    console.log(`📝 비디오 수정 요청: ${id}`, updateData);
    
    // 현재 데이터 조회
    const currentResult = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type IN ('classified', 'manual_classified', 'auto_collected')
      AND data::text LIKE '%"id":"${id}"%'
    `);
    
    if (currentResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // 데이터 업데이트
    const currentData = currentResult.rows[0].data;
    const updatedData = currentData.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          ...updateData,
          updatedAt: new Date().toISOString(),
          version: (item.version || 0) + 1
        };
      }
      return item;
    });
    
    // 업데이트된 데이터 저장
    await client.query(`
      UPDATE classification_data 
      SET data = $1, created_at = CURRENT_TIMESTAMP
      WHERE data_type IN ('classified', 'manual_classified', 'auto_collected')
      AND data @> '[{"id": $2}]'
    `, [JSON.stringify(updatedData), id]);
    
    client.release();
    
    const updatedItem = updatedData.find((item) => item.id === id);
    
    console.log(`✅ 비디오 수정 완료: ${id}`, {
      updated_at: updatedItem?.updatedAt,
      version: updatedItem?.version,
      affectedIds: [id]
    });
    
    res.json({
      success: true,
      message: 'Video updated successfully',
      updated_at: updatedItem?.updatedAt,
      version: updatedItem?.version,
      affectedIds: [id]
    });
    
  } catch (error) {
    console.error('비디오 수정 실패:', error);
    res.status(500).json({ 
      error: 'Failed to update video',
      details: error.message 
    });
  }
});

// 개별 비디오 삭제 API (DELETE /api/videos/:id)
app.delete('/api/videos/:id', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    console.log(`🗑️ 비디오 삭제 요청: ${id}`);
    
    // 현재 데이터 조회
    const currentResult = await client.query(`
      SELECT data, data_type FROM classification_data 
      WHERE data_type IN ('classified', 'manual_classified', 'auto_collected')
      AND data::text LIKE '%"id":"${id}"%'
    `);
    
    if (currentResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // 데이터에서 해당 항목 제거
    const currentData = currentResult.rows[0].data;
    const filteredData = currentData.filter((item) => item.id !== id);
    
    if (filteredData.length === currentData.length) {
      client.release();
      return res.status(404).json({ error: 'Video not found in data' });
    }
    
    // 업데이트된 데이터 저장
    await client.query(`
      UPDATE classification_data 
      SET data = $1, created_at = CURRENT_TIMESTAMP
      WHERE data_type = $2
      AND data @> '[{"id": $3}]'
    `, [JSON.stringify(filteredData), currentResult.rows[0].data_type, id]);
    
    client.release();
    
    console.log(`✅ 비디오 삭제 완료: ${id}`, {
      affectedIds: [id],
      remainingItems: filteredData.length
    });
    
    res.json({
      success: true,
      message: 'Video deleted successfully',
      affectedIds: [id],
      remainingItems: filteredData.length
    });
    
  } catch (error) {
    console.error('비디오 삭제 실패:', error);
    res.status(500).json({ 
      error: 'Failed to delete video',
      details: error.message 
    });
  }
});

// 배치 비디오 삭제 API (DELETE /api/videos/batch)
app.delete('/api/videos/batch', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty ids array' });
    }
    
    const client = await pool.connect();
    
    console.log(`🗑️ 배치 비디오 삭제 요청: ${ids.length}개`);
    
    let totalDeleted = 0;
    const results = [];
    
    // 각 데이터 타입별로 처리
    for (const dataType of ['classified', 'manual_classified', 'auto_collected']) {
      const currentResult = await client.query(`
        SELECT data FROM classification_data 
        WHERE data_type = $1
      `, [dataType]);
      
      if (currentResult.rows.length > 0) {
        const currentData = currentResult.rows[0].data;
        const filteredData = currentData.filter((item) => !ids.includes(item.id));
        const deletedCount = currentData.length - filteredData.length;
        
        if (deletedCount > 0) {
          await client.query(`
            UPDATE classification_data 
            SET data = $1, created_at = CURRENT_TIMESTAMP
            WHERE data_type = $2
          `, [JSON.stringify(filteredData), dataType]);
          
          totalDeleted += deletedCount;
          results.push({ dataType, deletedCount });
        }
      }
    }
    
    client.release();
    
    console.log(`✅ 배치 비디오 삭제 완료: ${totalDeleted}개`, results);
    
    res.json({
      success: true,
      message: `Batch delete completed: ${totalDeleted} items deleted`,
      affectedIds: ids,
      deletedCount: totalDeleted,
      results
    });
    
  } catch (error) {
    console.error('배치 비디오 삭제 실패:', error);
    res.status(500).json({ 
      error: 'Failed to delete videos',
      details: error.message 
    });
  }
});

app.get('/api/channels', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type = 'channels' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    client.release();
    const data = result.rows.length > 0 ? result.rows[0].data : {};
    res.json({ success: true, data });
  } catch (error) {
    console.error('채널 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// 자동 수집 전용 분류 데이터 저장 API (자동수집과 수동수집 분리)
app.post('/api/auto-classified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const data = req.body;
    const dataSize = JSON.stringify(data).length;
    console.log(`🤖 자동수집 분류 데이터 크기: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
    
    const client = await pool.connect();
    
    // 자동수집 데이터 저장 (중복 체크)
    for (const item of data) {
      // 기존 데이터 확인 (videoId + collectionDate 기준)
      const existing = await client.query(`
        SELECT id, data->>'collectionDate' as collectionDate FROM classification_data 
        WHERE data_type IN ('auto_classified', 'manual_classified')
        AND data->>'videoId' = $1
        AND data->>'collectionDate' = $2
      `, [item.videoId, item.collectionDate]);
      
      if (existing.rows.length === 0) {
        // 중복이 없으면 저장
        await client.query(`
          INSERT INTO classification_data (data_type, data)
          VALUES ($1, $2)
        `, ['auto_classified', JSON.stringify(item)]);
      } else {
        // 중복이 있으면 조회수 비교 후 업데이트
        const existingData = existing.rows[0];
        const existingViews = parseInt(existingData.data?.statistics?.viewCount || '0');
        const newViews = parseInt(item.statistics?.viewCount || '0');
        
        if (newViews > existingViews) {
          // 조회수가 더 높으면 업데이트
          await client.query(`
            UPDATE classification_data 
            SET data_type = 'auto_classified', data = $1, created_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [JSON.stringify(item), existingData.id]);
          console.log(`🤖 자동수집 업데이트: ${item.videoId} (조회수 ${existingViews.toLocaleString()} → ${newViews.toLocaleString()})`);
        } else {
          console.log(`⏭️ 자동수집 건너뛰기: ${item.videoId} (기존 조회수 ${existingViews.toLocaleString()} > 신규 ${newViews.toLocaleString()})`);
        }
      }
    }
    
    client.release();
    res.json({ success: true, message: 'Auto classified data saved' });
  } catch (error) {
    console.error('자동수집 분류 데이터 저장 실패:', error);
    console.error('에러 상세:', error.message);
    console.error('에러 코드:', error.code);
    console.error('데이터 크기:', JSON.stringify(data).length / 1024 / 1024, 'MB');
    res.status(500).json({ 
      error: 'Failed to save auto classified data',
      details: error.message,
      dataSize: JSON.stringify(data).length
    });
  }
});

// 자동 수집 데이터 조회 API (실제 저장된 데이터 기준)
app.get('/api/auto-collected', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    
    // unclassified_data 테이블에서 실제 저장된 자동수집 데이터 조회 (최근 30일)
    const today = new Date();
    const kstToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const startDate = new Date(kstToday);
    startDate.setDate(startDate.getDate() - 29); // 최근 30일
    const startDateString = startDate.toISOString().split('T')[0];
    
    const result = await client.query(`
      SELECT 
        id, video_id, channel_id, channel_name, video_title, 
        video_description, view_count, like_count, comment_count,
        upload_date, collection_date, thumbnail_url, 
        category, sub_category, status, collection_type, day_key_local,
        created_at
      FROM unclassified_data
      WHERE collection_type = 'auto' AND day_key_local >= $1
      ORDER BY collection_date DESC, view_count DESC
    `, [startDateString]);
    
    client.release();
    
    console.log(`📊 자동 수집 데이터 조회 (실제 저장 데이터): ${result.rows.length}개 (최근 30일)`);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('자동 수집 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get auto-collected data' });
  }
});

// 비디오 데이터 API (api-service.ts 호환)
app.post('/api/videos', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { videos } = req.body;
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
    `, ['videos', JSON.stringify(videos)]);
    
    client.release();
    res.json({ success: true, message: 'Videos saved' });
  } catch (error) {
    console.error('비디오 데이터 저장 실패:', error);
    res.status(500).json({ error: 'Failed to save videos' });
  }
});

app.get('/api/videos', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type = 'videos' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    client.release();
    const data = result.rows.length > 0 ? result.rows[0].data : {};
    res.json({ success: true, data });
  } catch (error) {
    console.error('비디오 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get videos' });
  }
});

// 데이터 조회 API
app.get('/api/data/channels', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM channels ORDER BY created_at DESC');
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('채널 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.get('/api/data/videos', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM videos ORDER BY created_at DESC');
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('영상 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.get('/api/data/stats', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    
    // 카테고리별 통계
    const categoryStats = await client.query(`
      SELECT 
        category,
        COUNT(*) as video_count,
        SUM(view_count) as total_views,
        AVG(view_count) as avg_views
      FROM videos 
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY total_views DESC
    `);
    
    // 전체 통계
    const totalStats = await client.query(`
      SELECT 
        COUNT(DISTINCT channel_id) as total_channels,
        COUNT(*) as total_videos,
        SUM(view_count) as total_views
      FROM videos
    `);
    
    client.release();
    res.json({
      categoryStats: categoryStats.rows,
      totalStats: totalStats.rows[0]
    });
  } catch (error) {
    console.error('통계 조회 실패:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// YouTube API 프록시 (현재 미사용으로 주석 처리)
// Express Router의 와일드카드 문법 변경으로 인한 에러 방지
// app.get('/api/youtube/:path(*)', async (req, res) => {
//   try {
//     const apiKey = process.env.VITE_YOUTUBE_API_KEY;
//     if (!apiKey) {
//       return res.status(500).json({ error: 'YouTube API key not configured' });
//     }
//     
//     // YouTube API 요청 프록시
//     const youtubeApiPath = req.params.path || '';
//     const queryString = new URLSearchParams(req.query).toString();
//     const youtubeUrl = `https://www.googleapis.com/youtube/v3/${youtubeApiPath}?key=${apiKey}${queryString ? '&' + queryString : ''}`;
//     
//     const response = await fetch(youtubeUrl);
//     const data = await response.json();
//     res.json(data);
//   } catch (error) {
//     console.error('YouTube API Error:', error);
//     res.status(500).json({ error: 'YouTube API request failed' });
//   }
// });

// API 라우트가 먼저 처리되도록 정적 파일 서빙을 뒤로 이동
// app.use(express.static(path.join(__dirname, 'dist'))); // 임시 주석 처리

// SPA 라우팅은 파일 끝에 이미 정의됨 (중복 제거)
// 중복된 SPA 라우팅 설정 제거 - API 엔드포인트가 먼저 처리되도록 함

// /data 경로는 React Router에서 처리하므로 서버 엔드포인트 제거

// 모든 정적 파일 요청 로깅
app.use((req, res, next) => {
  if (req.url.includes('data') || req.url.includes('assets')) {
    console.log('📁 정적 파일 요청:', req.url);
  }
  next();
});

// PostgreSQL 연결 테스트 API
app.post('/api/test-postgresql', async (req, res) => {
  try {
    console.log('🧪 PostgreSQL 연결 테스트 시작');
    console.log('🧪 DATABASE_URL 존재 여부:', !!process.env.DATABASE_URL);
    console.log('🧪 pool 상태:', !!pool);
    console.log('🧪 isConnected 상태:', isConnected);
    
    if (!pool) {
      console.error('❌ PostgreSQL 연결이 없습니다.');
      console.error('❌ DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '설정되지 않음');
      return res.status(500).json({ 
        error: 'PostgreSQL connection not available',
        databaseUrl: !!process.env.DATABASE_URL,
        pool: !!pool,
        isConnected: isConnected
      });
    }
    
    const client = await pool.connect();
    console.log('✅ PostgreSQL 클라이언트 연결 성공');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ PostgreSQL 쿼리 성공:', result.rows[0]);
    
    client.release();
    
    res.json({ 
      success: true, 
      message: 'PostgreSQL connection test successful',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ PostgreSQL 연결 테스트 실패:', error);
    res.status(500).json({ 
      error: 'PostgreSQL connection test failed',
      details: error.message
    });
  }
});

// 자동수집 API 엔드포인트 (GitHub Actions에서 호출)
app.post('/api/auto-collect', async (req, res) => {
  try {
    // 수동 수집 중인지 확인
    if (global.manualCollectionInProgress) {
      console.log('⚠️ 수동 수집이 진행 중이므로 자동 수집을 건너뜁니다.');
      return res.json({ success: false, message: '수동 수집이 진행 중입니다.' });
    }

    // 자동 수집 시작 플래그 설정
    global.autoCollectionInProgress = true;
    
    console.log('🤖 자동수집 API 호출됨');
    console.log('🤖 요청 본문:', req.body);
    
    // 자동수집 함수 실행 및 결과 확인
    const result = await autoCollectData();
    
    // 자동 수집 완료 플래그 해제
    global.autoCollectionInProgress = false;
    
    if (result === false) {
      console.error('❌ 자동수집 함수에서 실패 반환');
      return res.status(500).json({ 
        error: 'Auto collection function failed',
        details: 'Function returned false'
      });
    }
    
    res.json({ success: true, message: 'Auto collection completed' });
  } catch (error) {
    console.error('자동수집 실패:', error);
    console.error('자동수집 오류 상세:', error.message);
    console.error('자동수집 오류 스택:', error.stack);
    
    // 오류 발생 시에도 플래그 해제
    global.autoCollectionInProgress = false;
    
    res.status(500).json({ 
      error: 'Auto collection failed', 
      details: error.message,
      stack: error.stack?.substring(0, 500) // 스택 트레이스 일부만 전달
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 자동 데이터 수집 함수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function autoCollectData() {
  console.log('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 자동 데이터 수집 시작');
  console.log('🤖 시간:', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
  console.log('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  let requestCount = 0; // API 요청 카운터 초기화
  let client; // PostgreSQL 클라이언트 변수 선언
  
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('❌ YouTube API Key가 설정되지 않았습니다.');
      return false;
    }
    console.log('✅ YouTube API Key 확인됨');

    if (!pool) {
      console.error('❌ PostgreSQL 연결이 없습니다.');
      return false;
    }
    console.log('✅ PostgreSQL 연결 확인됨');
    
    // PostgreSQL 연결 테스트
    try {
      const client = await pool.connect();
      console.log('✅ PostgreSQL 클라이언트 연결 성공');
      await client.query('SELECT NOW()');
      console.log('✅ PostgreSQL 쿼리 테스트 성공');
      client.release();
    } catch (pgError) {
      console.error('❌ PostgreSQL 연결 테스트 실패:', pgError);
      return false;
    }

    // 1단계: 트렌드 영상 수집 - 키워드 검색만 사용하므로 비활성화
    console.log('📺 1단계: 트렌드 영상 수집 건너뛰기 (키워드 검색만 사용)');
    let trendingVideos = [];
    console.log('✅ 트렌드: 건너뜀 (키워드 검색으로 충분한 데이터 확보)');

    // 2단계: 키워드 기반 영상 수집 (전체 75개 키워드 × 50개 = 최대 3,750개)
    console.log('🔍 2단계: 키워드 영상 수집 중... (75개 키워드 × 50개)');
    let keywordVideos = [];
    
    // 전체 키워드 사용
    const testKeywords = [
      // 인기 콘텐츠 (4개)
      '브이로그', '리뷰', '언박싱', '튜토리얼',
      // 엔터테인먼트 (7개)
      '케이팝', '인터뷰', '예능', '라방', '비하인드', 'idol', 'k-pop',
      // 게임 & 스트리밍 (2개)
      '게임요약', '게임 공략',
      // 라이프스타일 (3개)
      '뷰티', '메이크업', '패션',
      // 여행 & 라이프 (3개)
      '여행', '인테리어', '집꾸미기',
      // 교육 & 학습 (3개)
      '공부', '시험', '취업',
      // 투자 & 경제 (4개)
      '부동산 이슈', '경제 이슈', '경제 요약', '재테크',
      // 뉴스 & 이슈 (4개)
      '뉴스 요약', '사회 이슈', '정치 이슈', '정치 요약',
      // 음악 & 예술 (5개)
      '연예인', '아이돌', '가수', '스타 소식', '트롯트',
      // 영화 & 드라마 (4개)
      '영화', '드라마', '영화리뷰', '드라마리뷰',
      // 기술 & 개발 (3개)
      '인공지능', 'ai 이슈', '기술 트렌드',
      // 스포츠 (3개)
      '스포츠 요약', '스포츠 이슈', '운동',
      // 쇼핑 & 리뷰 (4개)
      '쇼핑', '쇼핑리뷰', '구매', '리뷰',
      // 창작 & 취미 (3개)
      '취미', '여가', '반려동물',
      // 애니메이션 & 웹툰 (3개)
      '애니메이션', '애니', '웹툰',
      // 음식 & 요리 (2개)
      '요리', 'K푸드',
      // 시니어 & 노년층 (9개)
      '막장', '건강관리', '인생경험', '지혜', '사연', '감동', '인생', '국뽕', '실화',
      // 트렌드 & 밈 (5개)
      '썰', '밈', '힐링', '커뮤니티', '짤',
      // 하이라이트 & 편집 콘텐츠 (4개)
      '모음', '명장면', '베스트', '짜집기'
    ]; // 총 75개
    
    for (const keyword of testKeywords) {
      console.log(`🔍 키워드 검색: "${keyword}"`);
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&regionCode=KR&order=viewCount&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log(`🔍 키워드 "${keyword}" 검색 결과: ${searchData.items?.length || 0}개`);
        
        if (searchData.error) {
          console.error(`❌ 키워드 검색 오류:`, searchData.error);
          continue; // 다음 키워드로 계속
        }
        
        requestCount++;
        
        if (searchData.items && searchData.items.length > 0) {
          const videoIds = searchData.items.map(item => item.id.videoId).join(',');
          const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
          const videosResponse = await fetch(videosUrl);
          
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            console.log(`🔍 키워드 "${keyword}" 비디오 상세: ${videosData.items?.length || 0}개`);
            
            if (videosData.error) {
              console.error(`❌ 비디오 상세 오류:`, videosData.error);
              continue; // 다음 키워드로 계속
            }
            
            requestCount++;
            if (videosData.items) {
              // 키워드 정보를 함께 저장
              const videosWithKeyword = videosData.items.map(item => ({
                ...item,
                searchKeyword: keyword // 어떤 키워드로 수집되었는지 기록
              }));
              keywordVideos = [...keywordVideos, ...videosWithKeyword];
            }
          } else {
            const errorText = await videosResponse.text();
            console.error(`❌ 비디오 상세 요청 실패: ${videosResponse.status} - ${errorText}`);
          }
        }
      } else {
        const errorText = await searchResponse.text();
        console.error(`❌ 키워드 검색 요청 실패: ${searchResponse.status} - ${errorText}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ 키워드: ${keywordVideos.length}개 수집`);

    // 3단계: 수동수집과 동일한 중복 제거 방식 적용
    console.log('🔄 수동수집과 동일한 중복 제거 방식 적용...');
    
    // 모든 영상을 수동수집과 동일한 형태로 변환
    const allVideos = [...trendingVideos, ...keywordVideos];
    const transformedVideos = allVideos.map(video => ({
      videoId: video.id,
      dayKeyLocal: today, // 당일 데이터로 설정
      collectionDate: today,
      uploadDate: video.snippet?.publishedAt ? video.snippet.publishedAt.split('T')[0] : today,
      viewCount: parseInt(video.statistics?.viewCount || '0'),
      likeCount: parseInt(video.statistics?.likeCount || '0'),
      commentCount: parseInt(video.statistics?.commentCount || '0'),
      videoTitle: video.snippet?.title || '',
      videoDescription: video.snippet?.description || '',
      channelId: video.snippet?.channelId || '',
      channelName: video.snippet?.channelTitle || '',
      thumbnailUrl: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url || '',
      searchKeyword: video.searchKeyword || 'trending',
      source: video.searchKeyword ? 'keyword' : 'trending',
      // 원본 데이터도 보존
      originalData: video
    }));
    
    console.log(`📊 변환된 영상 데이터: ${transformedVideos.length}개`);
    
    // 수동수집과 동일한 dedupeByVideoDay 함수 사용
    const dedupeByVideoDay = (videos) => {
      const map = new Map();
      let duplicatesFound = 0;
      
      for (const video of videos) {
        const dayKey = video.dayKeyLocal || video.collectionDate || video.uploadDate;
        if (!dayKey) continue;
        
        const key = `${video.videoId}|${dayKey}`;
        const existing = map.get(key);
        
        if (!existing) {
          map.set(key, video);
        } else {
          duplicatesFound++;
          const currentViews = video.viewCount || 0;
          const existingViews = existing.viewCount || 0;
          
          if (currentViews > existingViews) {
            map.set(key, video);
            console.log(`🔄 중복 교체: ${video.videoId} (조회수 ${existingViews} → ${currentViews})`);
          }
        }
      }
      
      if (duplicatesFound > 0) {
        console.log(`📊 중복 제거 완료: ${duplicatesFound}개 중복 발견, ${map.size}개 유지`);
      }
      
      return Array.from(map.values());
    };
    
    const uniqueVideos = dedupeByVideoDay(transformedVideos);
    console.log(`✅ 수동수집과 동일한 중복 제거: ${transformedVideos.length}개 → ${uniqueVideos.length}개`);

    // 4단계: 채널 정보 수집
    console.log('📊 채널 정보 수집 중...');
    const channelIds = [...new Set(uniqueVideos.map(v => v.channelId))];
    let allChannels = [];
    
    for (let i = 0; i < channelIds.length; i += 50) {
      const batchIds = channelIds.slice(i, i + 50);
      const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batchIds.join(',')}&key=${apiKey}`;
      const response = await fetch(channelsUrl);
      
      if (response.ok) {
    const data = await response.json();
        if (data.items) allChannels = [...allChannels, ...data.items];
        requestCount++;
      }
      
      if (i + 50 < channelIds.length) await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ 채널: ${allChannels.length}개 수집`);

    // 5단계: 14일 자동 분류 로직 조회 (실시간 최신 데이터)
    console.log('🔄 자동 분류 참조 데이터 조회 중 (실시간)...');
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoString = fourteenDaysAgo.toISOString().split('T')[0];
    
    const client = await pool.connect();
    
    // unclassified_data 테이블에서 실시간 최신 분류 데이터 조회
    const classifiedResult = await client.query(`
      SELECT DISTINCT ON (channel_id)
        channel_id, category, sub_category, day_key_local
      FROM unclassified_data
      WHERE status = 'classified' 
        AND category IS NOT NULL 
        AND category != ''
        AND sub_category IS NOT NULL
        AND sub_category != ''
        AND day_key_local >= $1
      ORDER BY channel_id, day_key_local DESC
    `, [fourteenDaysAgoString]);
    
    let classifiedChannelMap = new Map();
    classifiedResult.rows.forEach(row => {
      classifiedChannelMap.set(row.channel_id, {
        category: row.category,
        subCategory: row.sub_category,
        collectionDate: row.day_key_local
      });
    });
    
    console.log(`✅ 자동 분류 참조 (실시간): ${classifiedChannelMap.size}개 채널 (최근 14일)`);

    // 6단계: 데이터 변환 및 저장
    // KST 기준으로 오늘 날짜 생성 (오전 9시 실행되므로 당일로 저장)
    const now = new Date();
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    const today = kstNow.toISOString().split('T')[0];
    
    console.log(`📅 수집 날짜 설정: ${today} (당일 데이터로 저장)`);
    const newData = uniqueVideos.map((video, index) => {
      const channel = allChannels.find(ch => ch.id === video.channelId);
      const existingClassification = classifiedChannelMap.get(video.channelId);
      
      return {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
        channelId: video.channelId,
        channelName: video.channelName,
        description: channel?.snippet?.description || "설명 없음",
        videoId: video.videoId,
        videoTitle: video.videoTitle,
        videoDescription: video.videoDescription,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        publishedAt: video.originalData?.snippet?.publishedAt || '',
        thumbnailUrl: video.thumbnailUrl,
        duration: video.originalData?.contentDetails?.duration || '',
        uploadDate: video.uploadDate,
        collectionDate: video.collectionDate,
        dayKeyLocal: video.dayKeyLocal,
        category: existingClassification?.category || "",
        subCategory: existingClassification?.subCategory || "",
        status: existingClassification ? "classified" : "unclassified",
        keyword: video.searchKeyword, // 키워드 정보 추가
        source: video.source, // 수집 소스 정보 추가
        collectionType: 'auto', // 자동 수집으로 명시
        collectionTimestamp: new Date().toISOString(), // 수집 시간 기록
        collectionSource: 'auto_collect_api' // 수집 소스 기록
      };
    });

    // PostgreSQL에 저장
    console.log(`💾 PostgreSQL 저장 시작: ${newData.length}개 데이터`);
    
    // 1. classification_data 테이블에 저장 (기존 방식 유지 - 전체 조회용)
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
      ON CONFLICT (data_type) 
      DO UPDATE SET 
        data = EXCLUDED.data,
        created_at = CURRENT_TIMESTAMP
    `, ['auto_collected', JSON.stringify(newData)]);
    console.log('✅ classification_data 저장 완료');
    
    // 2. unclassified_data 테이블에도 저장 (분류 작업용) - 500개씩 배치 처리
    console.log(`💾 unclassified_data 테이블에도 저장 시작: ${newData.length}개`);
    let insertCount = 0;
    let updateCount = 0;
    
    // 500개씩 배치 처리
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(newData.length / BATCH_SIZE);
    console.log(`📦 배치 처리 시작: ${newData.length}개 → ${totalBatches}개 배치 (${BATCH_SIZE}개씩)`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, newData.length);
      const batch = newData.slice(startIdx, endIdx);
      
      console.log(`📦 배치 ${batchIndex + 1}/${totalBatches} 처리 중... (${batch.length}개)`);
      
      for (const item of batch) {
        try {
          const result = await client.query(`
            INSERT INTO unclassified_data (
              video_id, channel_id, channel_name, video_title, 
              video_description, view_count, like_count, comment_count,
              upload_date, collection_date, thumbnail_url, 
              category, sub_category, status, day_key_local, collection_type, keyword
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (video_id, day_key_local) 
            DO UPDATE SET
              channel_id = EXCLUDED.channel_id,
              channel_name = EXCLUDED.channel_name,
              video_title = EXCLUDED.video_title,
              video_description = EXCLUDED.video_description,
              view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
              like_count = GREATEST(unclassified_data.like_count, EXCLUDED.like_count),
              comment_count = GREATEST(unclassified_data.comment_count, EXCLUDED.comment_count),
              thumbnail_url = EXCLUDED.thumbnail_url,
              category = COALESCE(unclassified_data.category, EXCLUDED.category),
              sub_category = COALESCE(unclassified_data.sub_category, EXCLUDED.sub_category),
              status = COALESCE(unclassified_data.status, EXCLUDED.status),
              collection_type = EXCLUDED.collection_type,
              keyword = COALESCE(unclassified_data.keyword, EXCLUDED.keyword),
              updated_at = NOW()
            RETURNING (xmax = 0) AS inserted
          `, [
            item.videoId, 
            item.channelId, 
            item.channelName, 
            item.videoTitle,
            item.videoDescription, 
            item.viewCount || 0,
            item.likeCount || 0,
            item.commentCount || 0,
            item.uploadDate, 
            item.collectionDate,
            item.thumbnailUrl, 
            item.category || '', 
            item.subCategory || '', 
            item.status || 'unclassified',
            today,
            'auto',
            item.keyword || ''
          ]);
          
          if (result.rows[0].inserted) {
            insertCount++;
          } else {
            updateCount++;
          }
        } catch (itemError) {
          console.error(`❌ 항목 저장 실패 (${item.videoId}):`, itemError.message);
        }
      }
      
      console.log(`✅ 배치 ${batchIndex + 1}/${totalBatches} 완료 (누적: ${insertCount} 삽입, ${updateCount} 업데이트)`);
      
      // 배치 간 100ms 지연 (서버 부하 분산)
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ unclassified_data 저장 완료: 신규 ${insertCount}개, 업데이트 ${updateCount}개`);

    console.log('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 자동 수집 완료!');
    console.log(`🤖 총 ${newData.length}개 영상 수집`);
    console.log(`🤖 자동 분류: ${newData.filter(d => d.status === 'classified').length}개`);
    console.log(`🤖 미분류: ${newData.filter(d => d.status === 'unclassified').length}개`);
    console.log(`🤖 API 요청: ${requestCount}번`);
    console.log('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return true; // 성공 시 true 반환
  } catch (error) {
    console.error('❌ 자동 수집 실패:', error);
    console.error('❌ 오류 상세:', error.message);
    console.error('❌ 오류 스택:', error.stack);
    console.error('❌ 오류 타입:', typeof error);
    console.error('❌ 오류 속성:', Object.keys(error));
    
    // 오류를 API 응답으로도 전달
    throw new Error(`자동수집 실패: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// 백업 파일 업로드 API
app.post('/api/upload-backup', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    const { backupData } = req.body;
    console.log('📤 백업 파일 업로드 시작:', backupData?.exportDate);
    
    // 백업 데이터를 임시로 저장 (실제로는 파일 시스템이나 메모리에 저장)
    // 여기서는 간단히 로그만 출력
    console.log('📊 백업 데이터 요약:');
    console.log(`- 내보내기 날짜: ${backupData.exportDate}`);
    console.log(`- 날짜 범위: ${backupData.dateRange?.from} ~ ${backupData.dateRange?.to}`);
    console.log(`- 총 영상: ${backupData.totalVideos}개`);
    console.log(`- 분류된 영상: ${backupData.totalClassified}개`);
    console.log(`- 미분류 영상: ${backupData.totalUnclassified}개`);
    console.log(`- 일별 데이터: ${backupData.dailyData?.length}일`);
    
    res.json({ 
      success: true, 
      message: 'Backup uploaded successfully',
      dataSize: JSON.stringify(backupData).length
    });
  } catch (error) {
    console.error('백업 업로드 실패:', error);
    res.status(500).json({ error: 'Failed to upload backup' });
  }
});

// 백업 복원 API
app.post('/api/restore-backup', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    console.log('🔄 백업 복원 시작...');
    
    // 여기서는 실제 백업 데이터를 처리
    // 실제로는 업로드된 백업 데이터를 읽어서 처리
    
    res.json({ 
      success: true, 
      message: 'Backup restored successfully',
      restored: {
        classified: 0,
        unclassified: 0,
        channels: 0,
        videos: 0
      }
    });
  } catch (error) {
    console.error('백업 복원 실패:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// 날짜 범위 데이터 교체 API (DELETE + INSERT)
app.post('/api/replace-date-range', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    const { dates, data } = req.body;
    console.log(`🔄 날짜 범위 데이터 교체: ${dates.length}개 날짜, ${data.length}개 항목`);
    
    const client = await pool.connect();
    
    // 1. 해당 날짜들의 기존 데이터 삭제
    await client.query(`
      DELETE FROM unclassified_data
      WHERE day_key_local = ANY($1::text[])
    `, [dates]);
    
    console.log(`🗑️ 기존 데이터 삭제 완료: ${dates.join(', ')}`);
    
    // 2. 새 데이터 삽입 (배치 처리)
    let insertCount = 0;
    for (const item of data) {
      const dayKeyLocal = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      
      await client.query(`
        INSERT INTO unclassified_data (
          video_id, channel_id, channel_name, video_title, 
          video_description, view_count, like_count, comment_count,
          upload_date, collection_date, thumbnail_url, 
          category, sub_category, status, day_key_local, collection_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        item.videoId, item.channelId, item.channelName, item.videoTitle,
        item.videoDescription, item.viewCount || 0, item.likeCount || 0, item.commentCount || 0,
        item.uploadDate, item.collectionDate, item.thumbnailUrl,
        item.category || '', item.subCategory || '', item.status || 'unclassified',
        dayKeyLocal, item.collectionType || 'manual'
      ]);
      
      insertCount++;
    }
    
    client.release();
    
    console.log(`✅ 날짜 범위 데이터 교체 완료: ${insertCount}개 삽입`);
    
    res.json({ 
      success: true, 
      deleted: dates.length,
      inserted: insertCount
    });
  } catch (error) {
    console.error('날짜 범위 데이터 교체 실패:', error);
    res.status(500).json({ error: 'Failed to replace date range data' });
  }
});

// 미분류 데이터 삭제 동기화 API
app.post('/api/sync/delete-unclassified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    const { ids, date } = req.body;
    console.log(`🗑️ 미분류 데이터 삭제 동기화: ${ids.length}개 항목, 날짜: ${date}`);
    
    // PostgreSQL에서 해당 ID들의 데이터 삭제
    const client = await pool.connect();
    
    for (const id of ids) {
      await client.query(`
        DELETE FROM classification_data 
        WHERE data_type = 'unclassified' 
        AND data->>'id' = $1
      `, [id.toString()]);
    }
    
    client.release();
    
    console.log(`✅ 서버에서 ${ids.length}개 미분류 데이터 삭제 완료`);
    res.json({ 
      success: true, 
      message: 'Unclassified data deleted successfully',
      deletedCount: ids.length
    });
  } catch (error) {
    console.error('미분류 데이터 삭제 실패:', error);
    res.status(500).json({ error: 'Failed to delete unclassified data' });
  }
});

// 안전한 백업 복원 API (중복 방지)
app.post('/api/backup/import', async (req, res) => {
  try {
    const { data, date } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid backup data' });
    }
    
    const client = await pool.connect();
    
    console.log(`🔄 안전한 백업 복원 시작: ${data.length}개 레코드, 날짜: ${date}`);
    
    // 안전한 업서트로 중복 방지
    let successCount = 0;
    let duplicateCount = 0;
    
    for (const item of data) {
      try {
        // day_key_local 계산
        const dayKeyLocal = item.dayKeyLocal || 
          (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : 
           new Date().toISOString().split('T')[0]);
        
        // 안전한 업서트 (중복 시 최대값 보존)
        await client.query(`
          INSERT INTO unclassified_data (
            video_id, channel_id, channel_name, video_title, 
            video_description, view_count, upload_date, collection_date,
            thumbnail_url, category, sub_category, status, day_key_local
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (video_id, day_key_local) 
          DO UPDATE SET
            channel_id = EXCLUDED.channel_id,
            channel_name = EXCLUDED.channel_name,
            video_title = EXCLUDED.video_title,
            video_description = EXCLUDED.video_description,
            view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
            upload_date = EXCLUDED.upload_date,
            thumbnail_url = EXCLUDED.thumbnail_url,
            category = EXCLUDED.category,
            sub_category = EXCLUDED.sub_category,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          item.videoId, item.channelId, item.channelName, item.videoTitle,
          item.videoDescription, item.viewCount, item.uploadDate, item.collectionDate,
          item.thumbnailUrl, item.category, item.subCategory, item.status, dayKeyLocal
        ]);
        
        successCount++;
      } catch (error) {
        if (error.code === '23505') { // 유니크 제약 위반
          duplicateCount++;
          console.log(`⚠️  중복 감지: ${item.videoId} (${dayKeyLocal})`);
        } else {
          console.error(`❌ 레코드 처리 실패 ${item.videoId}:`, error.message);
        }
      }
    }
    
    client.release();
    
    console.log(`✅ 안전한 백업 복원 완료: 성공 ${successCount}개, 중복 ${duplicateCount}개`);
    res.json({ 
      success: true, 
      message: 'Backup restored safely with duplicate prevention',
      stats: {
        total: data.length,
        success: successCount,
        duplicates: duplicateCount,
        date: date
      }
    });
  } catch (error) {
    console.error('백업 복원 실패:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// 중복 라우트 제거됨 - 아래에 SPA 라우팅이 있음

// 크론잡 실행 이력 저장 (메모리)
const cronJobHistory = [];
const MAX_HISTORY = 50; // 최대 50개 이력 저장

function addCronHistory(status, message, error = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    timestampKST: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    status, // 'started', 'success', 'failed'
    message,
    error: error ? error.message : null
  };
  
  cronJobHistory.unshift(entry);
  
  // 최대 개수 유지
  if (cronJobHistory.length > MAX_HISTORY) {
    cronJobHistory.pop();
  }
}

// 크론잡 실행 이력 조회 API
app.get('/api/cron/history', (req, res) => {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(9, 0, 0, 0);
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  res.json({
    success: true,
    serverStartTime: global.serverStartTime || new Date().toISOString(),
    cronSchedule: '매일 09:00 KST',
    currentTime: now.toISOString(),
    currentTimeKST: now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    nextRun: nextRun.toISOString(),
    nextRunKST: nextRun.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    historyCount: cronJobHistory.length,
    history: cronJobHistory.slice(0, 20) // 최근 20개만 반환
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const startTime = new Date();
  const kstTime = new Date(startTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  
  // 서버 시작 시간 저장
  global.serverStartTime = startTime.toISOString();
  
  console.log('='.repeat(80));
  console.log(`🚀 YouTube Pulse API Server running on port ${PORT}`);
  console.log(`⏰ 서버 시작 시간 (KST): ${startTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`⏰ 서버 시작 시간 (UTC): ${startTime.toISOString()}`);
  console.log(`🌏 서버 타임존: Asia/Seoul`);
  console.log('='.repeat(80));
  
  // 자동 수집 cron job 설정 (매일 09:00 KST - 당일 데이터로 저장)
  // cron 표현식: '분 시 일 월 요일'
  // '0 9 * * *' = 매일 09:00 (오전 9시)
  // YouTube API 할당량은 UTC 자정(KST 오전 9시)에 초기화되므로 9시에 실행
  const cronJob = cron.schedule('0 9 * * *', async () => {
    const executeTime = new Date();
    console.log('\n' + '='.repeat(80));
    console.log('⏰ [크론잡] 자동 수집 스케줄 트리거됨!');
    console.log(`🕐 트리거 시간 (KST): ${executeTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`🕐 트리거 시간 (UTC): ${executeTime.toISOString()}`);
    console.log('📅 당일(오늘) 데이터로 저장됩니다');
    console.log('='.repeat(80) + '\n');
    
    // 이력 기록: 시작
    addCronHistory('started', '자동 수집 시작');
    
    try {
      const result = await autoCollectData();
      if (result) {
        console.log('\n✅ [크론잡] 자동 수집 완료 성공!');
        addCronHistory('success', '자동 수집 완료 성공');
      } else {
        console.log('\n⚠️ [크론잡] 자동 수집 실패 (false 반환)');
        addCronHistory('failed', '자동 수집 실패 (false 반환)');
      }
    } catch (error) {
      console.error('\n❌ [크론잡] 자동 수집 중 오류 발생:', error.message);
      console.error('❌ [크론잡] 오류 스택:', error.stack);
      addCronHistory('failed', '자동 수집 중 오류 발생', error);
    }
  }, {
    timezone: 'Asia/Seoul',
    scheduled: true
  });
  
  // 다음 실행 시간 계산 (KST 기준)
  const now = new Date();
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const nextRun = new Date(kstNow);
  nextRun.setHours(10, 0, 0, 0);
  if (nextRun <= kstNow) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  console.log('\n📋 크론잡 설정 정보:');
  console.log(`   - 스케줄: 매일 10:00 KST (할당량 초기화 1시간 후)`);
  console.log(`   - 타임존: Asia/Seoul`);
  console.log(`   - 현재 시간 (KST): ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`   - 다음 실행 예정: ${nextRun.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`   - 상태: ${cronJob ? '활성화 ✅' : '비활성화 ❌'}`);
  console.log('='.repeat(80) + '\n');
});

// 정적 파일 서빙 (SPA) - API 라우트 처리 후 마지막에 배치
// __dirname은 /app/dist/server이므로, 한 단계 위의 dist로 이동
app.use(express.static(path.join(__dirname, '..')));

// 동기화 API 엔드포인트
app.post('/api/sync/upload', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { operation, tableName, recordId, payload, clientVersion } = req.body;
    const client = await pool.connect();
    
    // 동기화 큐에 작업 추가
    await client.query(`
      INSERT INTO sync_queue (operation, table_name, record_id, payload, client_version, status)
      VALUES ($1, $2, $3, $4, $5, 'processing')
    `, [operation, tableName, recordId, JSON.stringify(payload), clientVersion]);
    
    // 실제 데이터 처리 - 최대값 보존 upsert
    if (operation === 'create' || operation === 'update') {
      if (tableName === 'unclassified_data') {
        // day_key_local 계산 (KST 기준, YYYY-MM-DD 형식)
        const date = new Date(payload.collectionDate);
        const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        const dayKeyLocal = kstDate.toISOString().split('T')[0];
        
        await client.query(`
          INSERT INTO unclassified_data (
            video_id, channel_id, channel_name, video_title, video_description,
            view_count, upload_date, collection_date, thumbnail_url, category, sub_category, status, day_key_local
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (video_id, day_key_local) 
          DO UPDATE SET
            channel_id = EXCLUDED.channel_id,
            channel_name = EXCLUDED.channel_name,
            video_title = EXCLUDED.video_title,
            video_description = EXCLUDED.video_description,
            view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
            upload_date = EXCLUDED.upload_date,
            thumbnail_url = EXCLUDED.thumbnail_url,
            category = EXCLUDED.category,
            sub_category = EXCLUDED.sub_category,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          payload.videoId, payload.channelId, payload.channelName, payload.videoTitle,
          payload.videoDescription, payload.viewCount, payload.uploadDate, payload.collectionDate,
          payload.thumbnailUrl, payload.category, payload.subCategory, payload.status, dayKeyLocal
        ]);
        
        // daily_video_stats 테이블에도 동일한 로직 적용
        await client.query(`
          INSERT INTO daily_video_stats (
            video_id, day_key_local, channel_id, channel_name, video_title,
            video_description, view_count, upload_date, collection_date,
            thumbnail_url, category, sub_category, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (video_id, day_key_local)
          DO UPDATE SET
            channel_name = EXCLUDED.channel_name,
            video_title = EXCLUDED.video_title,
            video_description = EXCLUDED.video_description,
            view_count = GREATEST(daily_video_stats.view_count, EXCLUDED.view_count),
            like_count = GREATEST(daily_video_stats.like_count, EXCLUDED.like_count),
            upload_date = EXCLUDED.upload_date,
            thumbnail_url = EXCLUDED.thumbnail_url,
            category = EXCLUDED.category,
            sub_category = EXCLUDED.sub_category,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          payload.videoId, dayKeyLocal, payload.channelId, payload.channelName, payload.videoTitle,
          payload.videoDescription, payload.viewCount, payload.uploadDate, payload.collectionDate,
          payload.thumbnailUrl, payload.category, payload.subCategory, payload.status
        ]);
      }
    }
    
    // 동기화 큐 상태 업데이트
    await client.query(`
      UPDATE sync_queue 
      SET status = 'completed', processed_at = NOW()
      WHERE record_id = $1 AND operation = $2
    `, [recordId, operation]);
    
    client.release();
    res.json({ success: true, message: 'Upload completed' });
    
  } catch (error) {
    console.error('동기화 업로드 실패:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/sync/download', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { since } = req.query;
    const client = await pool.connect();
    
    let query, params;
    if (since) {
      query = `
        SELECT 
          id, video_id, channel_id, channel_name, video_title,
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status, created_at, updated_at
        FROM unclassified_data 
        WHERE updated_at > $1
        ORDER BY updated_at ASC
      `;
      params = [new Date(parseInt(since))];
    } else {
      query = `
        SELECT 
          id, video_id, channel_id, channel_name, video_title,
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status, created_at, updated_at
        FROM unclassified_data 
        ORDER BY updated_at ASC
      `;
      params = [];
    }
    
    const result = await client.query(query, params);
    client.release();
    
    // API 형식으로 변환
    const records = result.rows.map(row => ({
      id: row.id,
      videoId: row.video_id,
      channelId: row.channel_id,
      channelName: row.channel_name,
      videoTitle: row.video_title,
      videoDescription: row.video_description,
      viewCount: row.view_count,
      uploadDate: row.upload_date,
      collectionDate: row.collection_date,
      thumbnailUrl: row.thumbnail_url,
      category: row.category || '',
      subCategory: row.sub_category || '',
      status: row.status || 'unclassified',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({ 
      success: true, 
      records,
      totalRecords: records.length,
      lastSync: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('동기화 다운로드 실패:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.get('/api/sync/check', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { since } = req.query;
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM unclassified_data 
      WHERE updated_at > $1
    `, [new Date(parseInt(since))]);
    
    client.release();
    
    res.json({ 
      hasChanges: parseInt(result.rows[0].count) > 0,
      changeCount: parseInt(result.rows[0].count)
    });
    
  } catch (error) {
    console.error('동기화 확인 실패:', error);
    res.status(500).json({ error: 'Check failed' });
  }
});

// 멱등 복원 API (근본적 해결)
app.post('/api/restore/idempotent', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { data } = req.body;
    const client = await pool.connect();
    
    console.log(`🔄 멱등 복원 시작: ${data.length}개 레코드`);
    
    // 임시 테이블 생성
    await client.query(`
      CREATE TEMP TABLE temp_video_import (
        video_id VARCHAR(255),
        day_key_local VARCHAR(10),
        channel_id VARCHAR(255),
        channel_name VARCHAR(255),
        video_title TEXT,
        video_description TEXT,
        view_count BIGINT,
        upload_date TIMESTAMP,
        collection_date TIMESTAMP,
        thumbnail_url TEXT,
        category VARCHAR(100),
        sub_category VARCHAR(100),
        status VARCHAR(50)
      )
    `);
    
    // 임시 테이블에 데이터 적재
    for (const item of data) {
      const dayKeyLocal = item.dayKeyLocal || 
        (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : 
         new Date().toISOString().split('T')[0]);
      
      await client.query(`
        INSERT INTO temp_video_import (
          video_id, day_key_local, channel_id, channel_name, video_title,
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        item.videoId, dayKeyLocal, item.channelId, item.channelName, item.videoTitle,
        item.videoDescription, item.viewCount, item.uploadDate, item.collectionDate,
        item.thumbnailUrl, item.category, item.subCategory, item.status
      ]);
    }
    
    // 복원 전 데이터 개수
    const beforeUnclassified = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    const beforeDaily = await client.query('SELECT COUNT(*) as count FROM daily_video_stats');
    
    // 멱등 머지 실행
    const mergeResult = await client.query(`
      WITH merge_result AS (
        INSERT INTO unclassified_data (
          video_id, day_key_local, channel_id, channel_name, video_title,
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status, created_at, updated_at
        )
        SELECT 
          video_id, day_key_local, channel_id, channel_name, video_title,
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status, NOW(), NOW()
        FROM temp_video_import
        ON CONFLICT (video_id, day_key_local)
        DO UPDATE SET
          channel_id = EXCLUDED.channel_id,
          channel_name = EXCLUDED.channel_name,
          video_title = EXCLUDED.video_title,
          video_description = EXCLUDED.video_description,
          view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
          upload_date = EXCLUDED.upload_date,
          thumbnail_url = EXCLUDED.thumbnail_url,
          category = EXCLUDED.category,
          sub_category = EXCLUDED.sub_category,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING 
          CASE WHEN xmax = 0 THEN 'new' ELSE 'merged' END as action
      )
      SELECT 
        COUNT(*) FILTER (WHERE action = 'merged') as merged,
        COUNT(*) FILTER (WHERE action = 'new') as new
      FROM merge_result
    `);
    
    // daily_video_stats도 동일하게 머지
    await client.query(`
      INSERT INTO daily_video_stats (
        video_id, day_key_local, channel_id, channel_name, video_title,
        video_description, view_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status, created_at, updated_at
      )
      SELECT 
        video_id, day_key_local, channel_id, channel_name, video_title,
        video_description, view_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status, NOW(), NOW()
      FROM temp_video_import
      ON CONFLICT (video_id, day_key_local)
      DO UPDATE SET
        channel_name = EXCLUDED.channel_name,
        video_title = EXCLUDED.video_title,
        video_description = EXCLUDED.video_description,
        view_count = GREATEST(daily_video_stats.view_count, EXCLUDED.view_count),
        like_count = GREATEST(daily_video_stats.like_count, EXCLUDED.like_count),
        upload_date = EXCLUDED.upload_date,
        thumbnail_url = EXCLUDED.thumbnail_url,
        category = EXCLUDED.category,
        sub_category = EXCLUDED.sub_category,
        status = EXCLUDED.status,
        updated_at = NOW()
    `);
    
    // 복원 후 데이터 개수
    const afterUnclassified = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    const afterDaily = await client.query('SELECT COUNT(*) as count FROM daily_video_stats');
    
    client.release();
    
    console.log(`✅ 멱등 복원 완료: 병합 ${mergeResult.rows[0].merged}개, 신규 ${mergeResult.rows[0].new}개`);
    
    res.json({ 
      success: true, 
      message: 'Idempotent restore completed',
      stats: {
        total: data.length,
        merged: mergeResult.rows[0].merged,
        new: mergeResult.rows[0].new,
        before: {
          unclassified: beforeUnclassified.rows[0].count,
          daily: beforeDaily.rows[0].count
        },
        after: {
          unclassified: afterUnclassified.rows[0].count,
          daily: afterDaily.rows[0].count
        }
      }
    });
  } catch (error) {
    console.error('멱등 복원 실패:', error);
    res.status(500).json({ error: 'Failed to perform idempotent restore' });
  }
});

// 중복 정리 API
app.post('/api/cleanup-duplicates', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    
    console.log('🧹 서버 중복 정리 시작...');
    
    // 1. 현재 중복 상황 분석
    const duplicateAnalysis = await client.query(`
      SELECT 
        video_id,
        day_key_local,
        COUNT(*) as duplicate_count
      FROM unclassified_data 
      GROUP BY video_id, day_key_local
      HAVING COUNT(*) > 1
    `);
    
    console.log(`🔍 발견된 중복 그룹: ${duplicateAnalysis.rows.length}개`);
    
    if (duplicateAnalysis.rows.length === 0) {
      client.release();
      return res.json({ 
        success: true, 
        message: 'No duplicates found',
        stats: { total: 0, removed: 0, remaining: 0 }
      });
    }
    
    // 2. 임시 테이블에 최적화된 데이터 저장
    await client.query(`
      CREATE TEMP TABLE temp_cleaned_data AS
      SELECT DISTINCT ON (video_id, day_key_local)
        *
      FROM unclassified_data
      ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
    `);
    
    // 3. 기존 데이터 개수 확인
    const beforeCount = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    
    // 4. 기존 데이터 삭제 후 정리된 데이터 복원
    await client.query('DELETE FROM unclassified_data');
    await client.query('INSERT INTO unclassified_data SELECT * FROM temp_cleaned_data');
    
    // 5. 정리 후 데이터 개수 확인
    const afterCount = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    
    // 6. daily_video_stats도 동일하게 정리
    await client.query(`
      CREATE TEMP TABLE temp_cleaned_daily AS
      SELECT DISTINCT ON (video_id, day_key_local)
        *
      FROM daily_video_stats
      ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
    `);
    
    await client.query('DELETE FROM daily_video_stats');
    await client.query('INSERT INTO daily_video_stats SELECT * FROM temp_cleaned_daily');
    
    // 7. 임시 테이블 정리
    await client.query('DROP TABLE temp_cleaned_data');
    await client.query('DROP TABLE temp_cleaned_daily');
    
    const removed = beforeCount.rows[0].count - afterCount.rows[0].count;
    
    console.log(`✅ 서버 중복 정리 완료: ${removed}개 중복 제거`);
    
    client.release();
    
    res.json({ 
      success: true, 
      message: 'Duplicates cleaned successfully',
      stats: {
        total: beforeCount.rows[0].count,
        removed: removed,
        remaining: afterCount.rows[0].count
      }
    });
  } catch (error) {
    console.error('중복 정리 실패:', error);
    res.status(500).json({ error: 'Failed to cleanup duplicates' });
  }
});

// DB 스키마 마이그레이션 API (UNIQUE 제약 조건 추가)
app.post('/api/migrate-schema', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    console.log('🔄 스키마 마이그레이션 시작...');
    const client = await pool.connect();
    
    // classification_data 테이블에 UNIQUE 제약 조건 추가
    try {
      await client.query(`
        ALTER TABLE classification_data 
        ADD CONSTRAINT classification_data_data_type_key 
        UNIQUE (data_type)
      `);
      console.log('✅ classification_data.data_type UNIQUE 제약 조건 추가 완료');
    } catch (constraintError) {
      if (constraintError.code === '42P07') {
        console.log('⚠️ UNIQUE 제약 조건이 이미 존재함 (정상)');
      } else {
        throw constraintError;
      }
    }
    
    client.release();
    
    res.json({ 
      success: true, 
      message: 'Schema migration completed successfully'
    });
  } catch (error) {
    console.error('❌ 스키마 마이그레이션 실패:', error);
    res.status(500).json({ 
      error: 'Schema migration failed',
      details: error.message,
      code: error.code
    });
  }
});

// DB 전체 초기화 API (관리자 전용)
app.post('/api/reset-database', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { confirmKey } = req.body;
    
    // 안전장치: 확인 키 필요
    if (confirmKey !== 'RESET_ALL_DATA_CONFIRM') {
      return res.status(403).json({ error: 'Invalid confirmation key' });
    }
    
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️ 데이터베이스 전체 초기화 시작');
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const client = await pool.connect();
    
    // 모든 classification_data 삭제
    const result = await client.query(`
      DELETE FROM classification_data
      RETURNING data_type
    `);
    
    const deletedCount = result.rowCount || 0;
    
    console.log(`✅ classification_data 테이블 초기화: ${deletedCount}개 삭제`);
    
    client.release();
    
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗑️ 데이터베이스 초기화 완료: ${deletedCount}개 삭제`);
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    res.json({ 
      success: true, 
      message: 'Database reset successfully',
      deletedCount: deletedCount
    });
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14일 데이터 자동 정리 스케줄러
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function autoCleanupOldData() {
  if (!pool) {
    console.log('⚠️ PostgreSQL 연결 없음, 자동 정리 건너뜀');
    return;
  }
  
  try {
    const retentionDays = 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗑️ 자동 데이터 정리 시작 (${retentionDays}일 보관)`);
    console.log(`🗑️ 삭제 기준: ${cutoffDateString} 이전 데이터`);
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const client = await pool.connect();
    
    // 1. unclassified_data 테이블에서 오래된 데이터 삭제
    const unclassifiedResult = await client.query(`
      DELETE FROM unclassified_data
      WHERE day_key_local < $1
      RETURNING video_id
    `, [cutoffDateString]);
    
    const unclassifiedDeletedCount = unclassifiedResult.rowCount || 0;
    console.log(`🗑️ unclassified_data 테이블: ${unclassifiedDeletedCount}개 삭제`);
    
    // 2. classification_data 테이블에서 오래된 데이터 삭제
    const classificationResult = await client.query(`
      DELETE FROM classification_data
      WHERE (data->>'collectionDate')::date < $1
         OR (data->>'uploadDate')::date < $1
      RETURNING data_type, data->>'id' as id
    `, [cutoffDateString]);
    
    const classificationDeletedCount = classificationResult.rowCount || 0;
    console.log(`🗑️ classification_data 테이블: ${classificationDeletedCount}개 삭제`);
    
    client.release();
    
    const totalDeletedCount = unclassifiedDeletedCount + classificationDeletedCount;
    
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗑️ 자동 정리 완료: 총 ${totalDeletedCount}개 삭제`);
    console.log(`🗑️   - unclassified_data: ${unclassifiedDeletedCount}개`);
    console.log(`🗑️   - classification_data: ${classificationDeletedCount}개`);
    console.log(`🗑️ 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log('🗑️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return totalDeletedCount;
  } catch (error) {
    console.error('❌ 자동 데이터 정리 실패:', error);
    return 0;
  }
}

// 매일 자정(KST) 14일 데이터 정리 실행
setInterval(() => {
  const now = new Date();
  const kstHour = parseInt(now.toLocaleString('en-US', { 
    timeZone: 'Asia/Seoul', 
    hour: '2-digit', 
    hour12: false 
  }));
  const kstMinute = parseInt(now.toLocaleString('en-US', { 
    timeZone: 'Asia/Seoul', 
    minute: '2-digit' 
  }));
  
  // 자정(00:00~00:05)에 실행
  if (kstHour === 0 && kstMinute < 5) {
    console.log('🕛 KST 자정 감지 - 7일 데이터 자동 정리 실행');
    autoCleanupOldData();
  }
}, 5 * 60 * 1000); // 5분마다 체크

// 서버 시작 시 1회 실행
console.log('🧹 서버 시작 시 7일 데이터 정리 1회 실행...');
autoCleanupOldData();

// SPA 라우팅 - 모든 경로를 index.html로 리다이렉트 (API 라우트 제외)
app.use((req, res) => {
  // API 경로는 제외하고 SPA 라우팅 적용
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // __dirname은 /app/dist/server이므로, 한 단계 위로 이동
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
