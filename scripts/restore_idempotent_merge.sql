-- 멱등 복원: 임시 테이블 머지 스크립트
-- 백업 복원 시 데이터가 배로 늘어나는 문제를 근본적으로 해결

-- 1) 임시 테이블 생성
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
);

-- 2) 복원 전 데이터 개수 확인
SELECT 
  '복원 전' as status,
  COUNT(*) as unclassified_count
FROM unclassified_data
UNION ALL
SELECT 
  '복원 전' as status,
  COUNT(*) as daily_count
FROM daily_video_stats;

-- 3) 임시 테이블에 데이터 로드 (실제 사용 시 CSV/NDJSON 로드)
-- 예시: COPY temp_video_import FROM '/path/to/backup.csv' WITH CSV HEADER;
-- 또는: INSERT INTO temp_video_import VALUES (...);

-- 4) 멱등 머지 실행 (최대값 보존)
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
  COUNT(*) FILTER (WHERE action = 'merged') as merged_count,
  COUNT(*) FILTER (WHERE action = 'new') as new_count
FROM merge_result;

-- 5) daily_video_stats도 동일하게 머지
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
  updated_at = NOW();

-- 6) 복원 후 데이터 개수 확인
SELECT 
  '복원 후' as status,
  COUNT(*) as unclassified_count
FROM unclassified_data
UNION ALL
SELECT 
  '복원 후' as status,
  COUNT(*) as daily_count
FROM daily_video_stats;

-- 7) 중복 검사
SELECT 
  'unclassified_data' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as unique_combinations,
  COUNT(*) - COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as duplicates
FROM unclassified_data
UNION ALL
SELECT 
  'daily_video_stats' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as unique_combinations,
  COUNT(*) - COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as duplicates
FROM daily_video_stats;

-- 8) 임시 테이블 정리 (자동으로 정리됨)
-- DROP TABLE temp_video_import;
