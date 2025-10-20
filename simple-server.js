import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube Pulse API Server',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// 미분류 데이터 GET 엔드포인트
app.get('/api/unclassified', (req, res) => {
  const days = req.query.days || 7;
  res.json({
    success: true,
    data: [],
    message: `Unclassified data for ${days} days`,
    count: 0
  });
});

// 미분류 데이터 POST 엔드포인트
app.post('/api/unclassified', (req, res) => {
  try {
    const data = req.body;
    console.log(`📊 POST /api/unclassified received: ${Array.isArray(data) ? data.length : 0} items`);
    
    res.json({
      success: true,
      message: 'Data received successfully',
      receivedCount: Array.isArray(data) ? data.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ POST /api/unclassified error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 분류 데이터 GET 엔드포인트
app.get('/api/classified', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Classified data',
    count: 0
  });
});

// 분류 데이터 POST 엔드포인트
app.post('/api/classified', (req, res) => {
  try {
    const data = req.body;
    console.log(`📊 POST /api/classified received: ${Array.isArray(data) ? data.length : 0} items`);
    
    res.json({
      success: true,
      message: 'Classified data received successfully',
      receivedCount: Array.isArray(data) ? data.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ POST /api/classified error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 자동수집 데이터 GET 엔드포인트
app.get('/api/auto-collected', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Auto-collected data',
    count: 0
  });
});

// 채널 데이터 GET 엔드포인트
app.get('/api/channels', (req, res) => {
  res.json({
    success: true,
    data: {},
    message: 'Channels data',
    count: 0
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ YouTube Pulse API Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Unclassified: http://localhost:${PORT}/api/unclassified`);
  console.log(`🌐 Classified: http://localhost:${PORT}/api/classified`);
  console.log(`🌐 Auto-collected: http://localhost:${PORT}/api/auto-collected`);
  console.log(`🌐 Channels: http://localhost:${PORT}/api/channels`);
});
