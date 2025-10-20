import express from 'express';
const app = express();

// ✅ 헬스체크 엔드포인트
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// ✅ 기본 포트 바인딩
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Health server running on port ${PORT}`));