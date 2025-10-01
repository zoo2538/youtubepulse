import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 연결 풀 생성
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  console.log('✅ PostgreSQL 연결 풀 생성 완료');
}

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:8080', 
    'http://localhost:5173', 
    'https://youthbepulse.com',
    'https://www.youthbepulse.com',
    'https://api.youthbepulse.com'
  ],
  credentials: true
}));

// JSON 파싱
app.use(express.json());

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
    database: pool ? 'Connected' : 'Not connected'
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

// 분류 데이터 API (api-service.ts 호환)
app.post('/api/classified', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const data = req.body;
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
    `, ['classified', JSON.stringify(data)]);
    
    client.release();
    res.json({ success: true, message: 'Classified data saved' });
  } catch (error) {
    console.error('분류 데이터 저장 실패:', error);
    res.status(500).json({ error: 'Failed to save classified data' });
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
    const client = await pool.connect();
    
    await client.query(`
      INSERT INTO classification_data (data_type, data)
      VALUES ($1, $2)
    `, ['unclassified', JSON.stringify(data)]);
    
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

// 정적 파일 서빙 (SPA)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 라우팅 - 모든 경로를 index.html로
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 YouTube Pulse API Server running on port ${PORT}`);
});
