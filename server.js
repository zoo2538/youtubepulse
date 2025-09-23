import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'https://api.youthbepulse.com'],
  credentials: true
}));

// JSON 파싱
app.use(express.json());

// API 라우트
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'YouTube Pulse API Server' });
});

// YouTube API 프록시
app.get('/api/youtube/*', async (req, res) => {
  try {
    const apiKey = process.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }
    
    // YouTube API 요청 프록시
    const response = await fetch(`https://www.googleapis.com/youtube/v3${req.path.replace('/api/youtube', '')}?key=${apiKey}&${req.query}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('YouTube API Error:', error);
    res.status(500).json({ error: 'YouTube API request failed' });
  }
});

// 정적 파일 서빙 (SPA)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 라우팅 - 모든 경로를 index.html로
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 YouTube Pulse API Server running on port ${PORT}`);
});
