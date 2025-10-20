import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Test server running',
    timestamp: new Date().toISOString()
  });
});

// 간단한 GET 엔드포인트
app.get('/api/unclassified', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Test unclassified data endpoint'
  });
});

// 간단한 POST 엔드포인트
app.post('/api/unclassified', (req, res) => {
  console.log('POST /api/unclassified received:', req.body);
  res.json({
    success: true,
    message: 'Test data received',
    receivedCount: Array.isArray(req.body) ? req.body.length : 0
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Unclassified GET: http://localhost:${PORT}/api/unclassified`);
  console.log(`🌐 Unclassified POST: http://localhost:${PORT}/api/unclassified`);
});
