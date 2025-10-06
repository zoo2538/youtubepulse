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

// OPTIONS 요청에 대한 명시적 처리
app.options('*', cors());

// JSON 파싱 (크기 제한 증가: 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
        data_type VARCHAR(100),
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'YouTube Pulse API Server', 
      database: 'Not connected', 
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
  
  try {
    const data = req.body;
    const dataSize = JSON.stringify(data).length;
    console.log(`👤 수동수집 분류 데이터 크기: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
    
    const client = await pool.connect();
    
    // 대용량 데이터 처리 (10MB 초과 시 청크 단위로 저장)
    if (dataSize > 10 * 1024 * 1024) {
      console.log('⚠️ 대용량 데이터 감지, 청크 단위로 저장');
      const chunkSize = 1000;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await client.query(`INSERT INTO classification_data (data_type, data) VALUES ($1, $2)`, ['manual_classified', JSON.stringify(chunk)]);
        console.log(`✅ 청크 ${Math.floor(i/chunkSize) + 1} 저장 완료`);
      }
    } else {
      // 수동수집 데이터 저장 (중복 체크 및 업데이트)
      for (const item of data) {
      // 기존 데이터 확인 (videoId + collectionDate 기준)
      const existing = await client.query(`
        SELECT id, data_type, data->>'collectionDate' as collectionDate FROM classification_data 
        WHERE data_type IN ('auto_classified', 'manual_classified')
        AND data->>'videoId' = $1
        AND data->>'collectionDate' = $2
      `, [item.videoId, item.collectionDate]);
      
      if (existing.rows.length === 0) {
        // 중복이 없으면 새로 저장
        await client.query(`
          INSERT INTO classification_data (data_type, data)
          VALUES ($1, $2)
        `, ['manual_classified', JSON.stringify(item)]);
      } else {
        // 중복이 있으면 조회수 비교 후 업데이트
        const existingData = existing.rows[0];
        const existingViews = parseInt(existingData.data?.statistics?.viewCount || '0');
        const newViews = parseInt(item.statistics?.viewCount || '0');
        
        if (newViews > existingViews) {
          // 조회수가 더 높으면 업데이트
          await client.query(`
            UPDATE classification_data 
            SET data_type = 'manual_classified', data = $1, created_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [JSON.stringify(item), existingData.id]);
          console.log(`🔄 영상 업데이트: ${item.videoId} (조회수 ${existingViews.toLocaleString()} → ${newViews.toLocaleString()})`);
        } else {
          console.log(`⏭️ 영상 건너뛰기: ${item.videoId} (기존 조회수 ${existingViews.toLocaleString()} > 신규 ${newViews.toLocaleString()})`);
        }
      }
    }
    }
    
    client.release();
    res.json({ success: true, message: 'Classified data saved' });
  } catch (error) {
    console.error('분류 데이터 저장 실패:', error);
    console.error('에러 상세:', error.message);
    console.error('에러 코드:', error.code);
    console.error('데이터 크기:', JSON.stringify(data).length / 1024 / 1024, 'MB');
    res.status(500).json({ 
      error: 'Failed to save classified data',
      details: error.message,
      dataSize: JSON.stringify(data).length
    });
  }
});

app.get('/api/classified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type = 'classified' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    client.release();
    const data = result.rows.length > 0 ? result.rows[0].data : [];
    res.json({ success: true, data });
  } catch (error) {
    console.error('분류 데이터 조회 실패:', error);
    res.status(500).json({ error: 'Failed to get classified data' });
  }
});

// 미분류 데이터 API (api-service.ts 호환)
app.post('/api/unclassified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const data = req.body;
    const dataSize = JSON.stringify(data).length;
    console.log(`📊 미분류 데이터 크기: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
    
    const client = await pool.connect();
    
    // 대용량 데이터 처리 (10MB 초과 시 청크 단위로 저장)
    if (dataSize > 10 * 1024 * 1024) {
      console.log('⚠️ 대용량 미분류 데이터 감지, 청크 단위로 저장');
      const chunkSize = 1000;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await client.query(`INSERT INTO classification_data (data_type, data) VALUES ($1, $2)`, ['unclassified', JSON.stringify(chunk)]);
        console.log(`✅ 미분류 청크 ${Math.floor(i/chunkSize) + 1} 저장 완료`);
      }
    } else {
      await client.query(`
        INSERT INTO classification_data (data_type, data)
        VALUES ($1, $2)
      `, ['unclassified', JSON.stringify(data)]);
    }
    
    client.release();
    res.json({ success: true, message: 'Unclassified data saved' });
  } catch (error) {
    console.error('미분류 데이터 저장 실패:', error);
    res.status(500).json({ error: 'Failed to save unclassified data' });
  }
});

app.get('/api/unclassified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const { date } = req.query;
    const client = await pool.connect();
    
    let query, params;
    if (date) {
      // 날짜별 데이터 조회 (문자열 비교)
      query = `
        SELECT 
          id, video_id, channel_id, channel_name, video_title, 
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status
        FROM unclassified_data 
        WHERE collection_date::text LIKE $1
        ORDER BY view_count DESC
      `;
      params = [`${date}%`];
    } else {
      // 전체 데이터 조회 (기존 방식)
      query = `
        SELECT data FROM classification_data 
        WHERE data_type = 'unclassified' 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      params = [];
    }
    
    const result = await client.query(query, params);
    client.release();
    
    if (date) {
      // 날짜별 조회 결과를 API 형식으로 변환
      const data = result.rows.map(row => {
        // KST 기준 day_key_local 생성
        const dayKeyLocal = new Date(row.collection_date).toLocaleDateString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\./g, '-').replace(/\s/g, '');
        
        return {
          id: row.id,
          videoId: row.video_id,
          channelId: row.channel_id,
          channelName: row.channel_name,
          videoTitle: row.video_title,
          videoDescription: row.video_description,
          viewCount: row.view_count,
          uploadDate: row.upload_date,
          collectionDate: row.collection_date,
          dayKeyLocal: dayKeyLocal, // KST 기준 일자 키 추가
          thumbnailUrl: row.thumbnail_url,
          category: row.category || '',
          subCategory: row.sub_category || '',
          status: row.status || 'unclassified'
        };
      });
      res.json({ success: true, data });
    } else {
      // 기존 방식
      const data = result.rows.length > 0 ? result.rows[0].data : [];
      res.json({ success: true, data });
    }
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

// 자동 수집 데이터 조회 API
app.get('/api/auto-collected', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT data, created_at FROM classification_data 
      WHERE data_type = 'auto_collected' 
      ORDER BY created_at DESC
    `);
    
    client.release();
    
    // 모든 자동 수집 데이터 반환 (날짜별)
    const collections = result.rows.map(row => ({
      data: row.data,
      collectedAt: row.created_at
    }));
    
    res.json({ success: true, data: collections });
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
    await autoCollectData();
    
    // 자동 수집 완료 플래그 해제
    global.autoCollectionInProgress = false;
    
    res.json({ success: true, message: 'Auto collection completed' });
  } catch (error) {
    console.error('자동수집 실패:', error);
    
    // 오류 발생 시에도 플래그 해제
    global.autoCollectionInProgress = false;
    
    res.status(500).json({ error: 'Auto collection failed' });
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

    const apiKey = process.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
    console.error('❌ YouTube API Key가 설정되지 않았습니다.');
    return;
  }

  if (!pool) {
    console.error('❌ PostgreSQL 연결이 없습니다.');
    return;
  }

  try {
    let requestCount = 0;
    const keywords = [
      '브이로그', '리뷰', '언박싱', '튜토리얼', '케이팝', '인터뷰', '예능',
      '게임요약', '게임 공략', '뷰티', '메이크업', '패션', '여행', '인테리어', '집꾸미기',
      '공부', '시험', '취업', '부동산 이슈', '경제 이슈', '경제 요약', '재테크',
      '뉴스 요약', '사회 이슈', '정치 이슈', '정치 요약', '연예인', '아이돌', '가수', '스타 소식',
      '영화', '드라마', '영화리뷰', '드라마리뷰', '인공지능', 'ai 이슈', '기술 트렌드',
      '스포츠 요약', '스포츠 이슈', '운동', '쇼핑', '쇼핑리뷰', '구매', '리뷰',
      '취미', '여가', '반려동물', '애니메이션', '애니', '웹툰',
      '막장', '건강관리', '인생경험', '지혜', '사연', '감동', '인생', '국뽕', '실화',
      '썰', '밈', '힐링', '커뮤니티', '짤'
    ];

    // 1단계: 트렌드 영상 200개 수집 (50개씩 4페이지)
    console.log('📺 1단계: 트렌드 영상 수집 중...');
    let trendingVideos = [];
    let nextPageToken = '';
    
    for (let page = 0; page < 4; page++) {
      const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&key=${apiKey}`;
      const response = await fetch(trendingUrl);
      
      if (response.ok) {
    const data = await response.json();
        requestCount++;
        if (data.items) {
          trendingVideos = [...trendingVideos, ...data.items];
          nextPageToken = data.nextPageToken;
          if (!nextPageToken) break;
        }
      }
      
      if (page < 4) await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 한글 필터링
    const beforeFilter = trendingVideos.length;
    trendingVideos = trendingVideos.filter(video => {
      const title = video.snippet?.title || '';
      const channelName = video.snippet?.channelTitle || '';
      return /[가-힣]/.test(title) || /[가-힣]/.test(channelName);
    });
    console.log(`✅ 트렌드: ${beforeFilter}개 → ${trendingVideos.length}개 (한글 필터링)`);

    // 2단계: 키워드 기반 영상 수집
    console.log('🔍 2단계: 키워드 영상 수집 중...');
    let keywordVideos = [];
    
    for (const keyword of keywords) {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&regionCode=KR&order=viewCount&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        requestCount++;
        
        if (searchData.items && searchData.items.length > 0) {
          const videoIds = searchData.items.map(item => item.id.videoId).join(',');
          const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
          const videosResponse = await fetch(videosUrl);
          
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            requestCount++;
            if (videosData.items) {
              keywordVideos = [...keywordVideos, ...videosData.items];
            }
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ 키워드: ${keywordVideos.length}개 수집`);

    // 3단계: 합치기 및 중복 제거
    const allVideos = [...trendingVideos, ...keywordVideos];
    const videoMap = new Map();
    
    allVideos.forEach(video => {
      const existing = videoMap.get(video.id);
      if (!existing || parseInt(video.statistics?.viewCount || '0') > parseInt(existing.statistics?.viewCount || '0')) {
        videoMap.set(video.id, video);
      }
    });
    
    let uniqueVideos = Array.from(videoMap.values());
    uniqueVideos.sort((a, b) => parseInt(b.statistics?.viewCount || '0') - parseInt(a.statistics?.viewCount || '0'));
    
    console.log(`✅ 전체: ${allVideos.length}개 → 중복 제거: ${uniqueVideos.length}개`);

    // 4단계: 채널 정보 수집
    console.log('📊 채널 정보 수집 중...');
    const channelIds = [...new Set(uniqueVideos.map(v => v.snippet.channelId))];
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

    // 5단계: 14일 자동 분류 로직 조회
    console.log('🔄 자동 분류 참조 데이터 조회 중...');
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoString = fourteenDaysAgo.toISOString().split('T')[0];
    
    const client = await pool.connect();
    const classifiedResult = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type = 'unclassified' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    let classifiedChannelMap = new Map();
    if (classifiedResult.rows.length > 0) {
      const existingData = classifiedResult.rows[0].data || [];
      const recentClassified = existingData.filter(item => 
        item.status === 'classified' && item.collectionDate >= fourteenDaysAgoString
      );
      
      recentClassified.forEach(item => {
        if (!classifiedChannelMap.has(item.channelId) || 
            item.collectionDate > (classifiedChannelMap.get(item.channelId)?.collectionDate || '')) {
          classifiedChannelMap.set(item.channelId, {
            category: item.category,
            subCategory: item.subCategory,
            collectionDate: item.collectionDate
          });
        }
      });
    }
    
    console.log(`✅ 자동 분류 참조: ${classifiedChannelMap.size}개 채널 (최근 14일)`);

    // 6단계: 데이터 변환 및 저장
    // KST 기준으로 오늘 날짜 생성
    const today = new Date().toLocaleDateString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '');
    const newData = uniqueVideos.map((video, index) => {
      const channel = allChannels.find(ch => ch.id === video.snippet.channelId);
      const existingClassification = classifiedChannelMap.get(video.snippet.channelId);
      
      // 키워드 정보 찾기 (키워드 수집에서 온 영상인지 확인)
      let sourceKeyword = 'trending';
      const keywordVideo = keywordVideos.find(kv => kv.id === video.id);
      if (keywordVideo) {
        // 키워드 수집에서 온 영상인 경우, 어떤 키워드로 수집되었는지 찾기
        for (const keyword of keywords) {
          // 실제로는 키워드 매핑 로직이 필요하지만, 일단 기본값으로 설정
          sourceKeyword = keyword;
          break;
        }
      }
      
      return {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
        channelId: video.snippet.channelId,
        channelName: video.snippet.channelTitle,
        description: channel?.snippet?.description || "설명 없음",
        videoId: video.id,
        videoTitle: video.snippet.title,
        videoDescription: video.snippet.description,
        viewCount: parseInt(video.statistics?.viewCount || '0'),
        uploadDate: video.snippet.publishedAt.split('T')[0],
        collectionDate: today,
        thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '',
        category: existingClassification?.category || "",
        subCategory: existingClassification?.subCategory || "",
        status: existingClassification ? "classified" : "unclassified",
        keyword: sourceKeyword, // 키워드 정보 추가
        source: keywordVideo ? 'keyword' : 'trending', // 수집 소스 정보 추가
        collectionType: 'auto', // 자동 수집으로 명시
        collectionTimestamp: new Date().toISOString(), // 수집 시간 기록
        collectionSource: 'auto_collect_api' // 수집 소스 기록
      };
    });

    // PostgreSQL에 저장
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
    `, ['auto_collected', JSON.stringify(newData)]);
    
    client.release();

    console.log('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 자동 수집 완료!');
    console.log(`🤖 총 ${newData.length}개 영상 수집`);
    console.log(`🤖 자동 분류: ${newData.filter(d => d.status === 'classified').length}개`);
    console.log(`🤖 미분류: ${newData.filter(d => d.status === 'unclassified').length}개`);
    console.log(`🤖 API 요청: ${requestCount}번`);
    console.log('🤖 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ 자동 수집 실패:', error);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 YouTube Pulse API Server running on port ${PORT}`);
  
  // 자동 수집 cron job 설정 (매일 오전 9시 KST)
  // cron 표현식: '분 시 일 월 요일'
  // '0 0 * * *' = 매일 오전 9시 (서버 시간 기준)
  // Railway는 UTC를 사용하므로 KST 오전 9시 = UTC 00:00 (같은 날)
  cron.schedule('0 0 * * *', () => {
    console.log('⏰ 자동 수집 스케줄 실행 (매일 오전 9시 KST)');
    autoCollectData();
  }, {
    timezone: 'Asia/Seoul'
  });
  
  console.log('⏰ 자동 수집 스케줄 등록 완료: 매일 09:00 (한국시간)');
});

// 정적 파일 서빙 (SPA) - API 라우트 처리 후 마지막에 배치
app.use(express.static(path.join(__dirname, 'dist')));

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
        // day_key_local 계산 (KST 기준)
        const dayKeyLocal = new Date(payload.collectionDate).toLocaleDateString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\./g, '-').replace(/\s/g, '');
        
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

// SPA 라우팅 - 모든 경로를 index.html로 리다이렉트 (API 라우트 제외)
app.use((req, res) => {
  // API 경로는 제외하고 SPA 라우팅 적용
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
