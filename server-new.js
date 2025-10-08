import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

// 새로운 모듈들 (CommonJS 형태로 import)
import { createPool, checkPoolHealth } from './lib/db-pool.js';
import AutoCollector from './services/autoCollector.js';
import { requestLogger, errorLogger, logAutoCollection, logDatabase } from './middleware/logError.js';
import healthRouter from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 전역 상태 변수
global.autoCollectionInProgress = false;
global.manualCollectionInProgress = false;
global.lastAutoCollectionRun = null;

// PostgreSQL 연결 풀 생성
let pool = null;
let isConnected = false;

try {
  pool = createPool();
  isConnected = true;
  app.locals.pool = pool; // Express 앱에 풀 연결
  
  logDatabase('PostgreSQL 연결 풀 생성 완료');
} catch (error) {
  logDatabase('PostgreSQL 연결 풀 생성 실패', { error: error.message });
  pool = null;
  isConnected = false;
}

// 미들웨어 설정
app.use(cors({
  origin: [
    'http://localhost:8080', 
    'http://localhost:5173', 
    'https://youthbepulse.com',
    'https://www.youthbepulse.com',
    'https://api.youthbepulse.com',
    'https://zoo2538.github.io',
    'https://zoo2538.github.io/youtubepulse'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 요청 로깅 미들웨어
app.use(requestLogger);

// 라우터 설정
app.use('/health', healthRouter);

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'dist')));

// API 라우트들...

// 자동수집 API (개선된 버전)
app.post('/api/auto-collect', async (req, res) => {
  const requestId = req.requestId || `auto-collect-${Date.now()}`;
  
  try {
    logAutoCollection('자동수집 API 호출됨', { requestId });
    
    // 수동 수집 중인지 확인
    if (global.manualCollectionInProgress) {
      logAutoCollection('수동 수집 진행 중으로 자동 수집 건너뜀', { requestId });
      return res.json({ success: false, message: '수동 수집이 진행 중입니다.' });
    }

    // 자동 수집 시작 플래그 설정
    global.autoCollectionInProgress = true;
    global.lastAutoCollectionRun = new Date().toISOString();
    
    // 자동수집 서비스 초기화
    const collector = new AutoCollector(pool);
    
    // YouTube API 키 확인
    const apiKey = process.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YouTube API Key가 설정되지 않았습니다.');
    }
    
    logAutoCollection('자동수집 시작', { requestId, hasApiKey: !!apiKey });
    
    // 1단계: 트렌딩 비디오 수집
    const trendingVideos = await collector.collectTrendingVideos(apiKey, 1); // 테스트용 1페이지
    
    // 2단계: 키워드 기반 비디오 수집 (테스트용 1개 키워드)
    const keywords = ['브이로그']; // 테스트용
    const keywordVideos = await collector.collectKeywordVideos(apiKey, keywords);
    
    // 3단계: 데이터 정규화
    const allVideos = [...trendingVideos, ...keywordVideos];
    const normalizedData = collector.normalizeData(allVideos, 'mixed');
    
    // 4단계: 데이터 저장 (배치 처리 및 재시도 포함)
    const saveResult = await collector.saveCollectedData(normalizedData, requestId);
    
    // 자동 수집 완료 플래그 해제
    global.autoCollectionInProgress = false;
    
    logAutoCollection('자동수집 완료', { 
      requestId, 
      totalVideos: allVideos.length,
      savedCount: saveResult.savedCount,
      failedCount: saveResult.failedCount
    });
    
    res.json({ 
      success: true, 
      message: 'Auto collection completed',
      data: {
        totalVideos: allVideos.length,
        savedCount: saveResult.savedCount,
        failedCount: saveResult.failedCount,
        requestId
      }
    });
    
  } catch (error) {
    // 오류 발생 시에도 플래그 해제
    global.autoCollectionInProgress = false;
    
    logAutoCollection('자동수집 실패', { 
      requestId, 
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Auto collection failed', 
      details: error.message,
      requestId
    });
  }
});

// 기존 API들...
app.get('/api/auto-collected', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT data, collected_at FROM classification_data 
      WHERE data_type = 'auto_collected' 
      ORDER BY collected_at DESC
    `);
    
    client.release();
    
    const collections = result.rows.map(row => ({
      data: row.data,
      collectedAt: row.collected_at
    }));
    
    res.json({ success: true, data: collections });
  } catch (error) {
    logDatabase('자동 수집 데이터 조회 실패', { error: error.message });
    res.status(500).json({ error: 'Failed to get auto-collected data' });
  }
});

// 에러 로깅 미들웨어
app.use(errorLogger);

// SPA 라우팅을 위한 catch-all 핸들러
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 시작되었습니다`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 PostgreSQL 연결: ${isConnected ? '✅ 연결됨' : '❌ 연결 실패'}`);
  
  // 헬스체크 엔드포인트 안내
  console.log(`🏥 헬스체크: http://localhost:${PORT}/health`);
  console.log(`🔍 DB 헬스체크: http://localhost:${PORT}/health/db`);
});

// 크론 작업 설정 (매일 자정 KST)
cron.schedule('0 0 * * *', async () => {
  if (global.autoCollectionInProgress) {
    logAutoCollection('크론 작업 스킵 - 이미 자동수집 진행 중');
    return;
  }
  
  logAutoCollection('크론 작업 시작 - 매일 자정 자동수집');
  
  try {
    // 자동수집 API 호출
    const response = await fetch(`http://localhost:${PORT}/api/auto-collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateKey: new Date().toISOString().split('T')[0] })
    });
    
    if (response.ok) {
      logAutoCollection('크론 작업 완료');
    } else {
      logAutoCollection('크론 작업 실패', { status: response.status });
    }
  } catch (error) {
    logAutoCollection('크론 작업 오류', { error: error.message });
  }
}, {
  timezone: 'Asia/Seoul'
});

export default app;
