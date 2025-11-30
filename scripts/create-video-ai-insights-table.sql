-- ✅ video_ai_insights 테이블 생성 SQL
-- 튜브렌즈 스타일의 AI 분석 결과를 저장하는 테이블

CREATE TABLE IF NOT EXISTS video_ai_insights (
  video_id VARCHAR(50) PRIMARY KEY,
  summary TEXT,
  viral_reason TEXT,
  keywords TEXT[],
  clickbait_score INTEGER,
  sentiment VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

