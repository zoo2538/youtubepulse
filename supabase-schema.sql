-- YouTube Pulse 데이터베이스 스키마
-- Supabase PostgreSQL용

-- 1. 채널 정보 테이블
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(1000),
  subscriber_count BIGINT,
  video_count INTEGER,
  view_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 비디오 정보 테이블
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(255) UNIQUE NOT NULL,
  channel_id VARCHAR(255) REFERENCES channels(channel_id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(1000),
  view_count BIGINT,
  like_count INTEGER,
  comment_count INTEGER,
  duration VARCHAR(50),
  published_at TIMESTAMP WITH TIME ZONE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category VARCHAR(100),
  sub_category VARCHAR(100)
);

-- 3. 일별 통계 테이블
CREATE TABLE daily_stats (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  channel_id VARCHAR(255) REFERENCES channels(channel_id),
  video_id VARCHAR(255) REFERENCES videos(video_id),
  views BIGINT,
  likes INTEGER,
  comments INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 카테고리 설정 테이블
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  sub_categories JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 사용자 설정 테이블
CREATE TABLE user_settings (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) UNIQUE NOT NULL,
  retention_days INTEGER DEFAULT 7,
  auto_collection BOOLEAN DEFAULT false,
  collection_time TIME DEFAULT '09:00:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_collected_at ON videos(collected_at);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
CREATE INDEX idx_daily_stats_channel_id ON daily_stats(channel_id);

-- RLS (Row Level Security) 설정
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 설정 (개발용)
CREATE POLICY "Enable all access for all users" ON channels FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON videos FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON daily_stats FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON categories FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON user_settings FOR ALL USING (true);

-- 기본 카테고리 데이터 삽입
INSERT INTO categories (category_name, sub_categories) VALUES
('엔터테인먼트', '["음악", "영화", "TV", "게임", "스포츠", "코미디", "예능"]'),
('교육', '["강의", "튜토리얼", "언어학습", "과학", "역사", "문학", "기술"]'),
('라이프스타일', '["뷰티", "패션", "요리", "여행", "건강", "운동", "인테리어"]'),
('뉴스', '["정치", "경제", "사회", "국제", "기술", "스포츠", "연예"]'),
('기술', '["프로그래밍", "AI", "하드웨어", "소프트웨어", "리뷰", "튜토리얼", "뉴스"]'),
('비즈니스', '["경영", "마케팅", "재무", "창업", "투자", "부동산", "경제"]'),
('기타', '["일반", "기타", "미분류"]');
