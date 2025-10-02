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

// PostgreSQL 연결 풀 생성 (강화된 연결 관리)
let pool = null;
let isConnected = false;

if (process.env.DATABASE_URL) {
  console.log('🔍 DATABASE_URL 환경 변수 확인됨');
  console.log('🔍 DATABASE_URL 길이:', process.env.DATABASE_URL.length);
  console.log('🔍 DATABASE_URL 값:', process.env.DATABASE_URL);
  
  // DATABASE_URL 형식 검증
  if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL 형식이 올바르지 않습니다:', process.env.DATABASE_URL);
  } else {
    console.log('✅ DATABASE_URL 형식 검증 통과');
  }
  
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
        require: true,
        sslmode: 'require'
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    console.log('✅ PostgreSQL 연결 풀 생성 완료 - 강제 재시작 트리거');
    
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

// CORS 설정 (GitHub Pages 도메인 추가)
app.use(cors({
  origin: [
    'http://localhost:8080', 
    'http://localhost:5173', 
    'https://youthbepulse.com',
    'https://www.youthbepulse.com',
    'https://api.youthbepulse.com',
    'https://zoo2538.github.io',  // GitHub Pages 도메인
    'https://zoo2538.github.io/youtubepulse'  // GitHub Pages 서브경로
  ],
  credentials: true
}));

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

// API 라우트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube Pulse API Server',
    database: (pool && isConnected) ? 'Connected' : 'Not connected',
    poolExists: !!pool,
    isConnected: isConnected,
    databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
  });
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
    const client = await pool.connect();
    const result = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type = 'unclassified' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    client.release();
    const data = result.rows.length > 0 ? result.rows[0].data : [];
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

// 정적 파일 서빙 (SPA) - 반드시 먼저 배치
app.use(express.static(path.join(__dirname, 'dist')));

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
    console.log('🤖 자동수집 API 호출됨');
    await autoCollectData();
    res.json({ success: true, message: 'Auto collection completed' });
  } catch (error) {
    console.error('자동수집 실패:', error);
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

    // 1단계: 트렌드 영상 100개 수집
    console.log('📺 1단계: 트렌드 영상 수집 중...');
    let trendingVideos = [];
    let nextPageToken = '';
    
    for (let page = 0; page < 2; page++) {
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
      
      if (page < 3) await new Promise(resolve => setTimeout(resolve, 500));
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
    const today = new Date().toISOString().split('T')[0];
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
        source: keywordVideo ? 'keyword' : 'trending' // 수집 소스 정보 추가
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

// SPA 폴백 - 모든 React Router 경로를 index.html로 리다이렉트
app.get('*', (req, res) => {
  // API 경로는 제외
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // React Router 경로들을 index.html로 리다이렉트
  console.log('🔄 SPA 라우팅:', req.path, '→ index.html');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

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
