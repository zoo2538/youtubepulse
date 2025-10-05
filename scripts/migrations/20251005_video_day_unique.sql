-- 하이브리드 원칙을 위한 유니크 제약 및 업서트 규칙 적용
-- 날짜별 최대 조회수 유지, 자동/수동 공통 업서트, 멱등 백업/복원

-- 1) 기존 중복 데이터 정리
DELETE FROM unclassified_data 
WHERE id NOT IN (
  SELECT DISTINCT ON (video_id, day_key_local) id
  FROM unclassified_data 
  ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
);

DELETE FROM daily_video_stats 
WHERE id NOT IN (
  SELECT DISTINCT ON (video_id, day_key_local) id
  FROM daily_video_stats 
  ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
);

-- 2) 기존 인덱스 삭제 후 재생성
DROP INDEX IF EXISTS ux_video_day_local;
DROP INDEX IF EXISTS ux_daily_video_day_local;

-- 3) 강화된 유니크 제약 생성
CREATE UNIQUE INDEX ux_video_day_local_strong
ON unclassified_data (video_id, day_key_local);

CREATE UNIQUE INDEX ux_daily_video_day_local_strong
ON daily_video_stats (video_id, day_key_local);

-- 4) 멱등 복원용 함수 생성
CREATE OR REPLACE FUNCTION idempotent_restore_video_data(
  p_video_id VARCHAR(255),
  p_day_key_local VARCHAR(10),
  p_channel_id VARCHAR(255),
  p_channel_name VARCHAR(255),
  p_video_title TEXT,
  p_video_description TEXT,
  p_view_count BIGINT,
  p_upload_date TIMESTAMP,
  p_collection_date TIMESTAMP,
  p_thumbnail_url TEXT,
  p_category VARCHAR(100),
  p_sub_category VARCHAR(100),
  p_status VARCHAR(50)
) RETURNS VOID AS $$
BEGIN
  -- unclassified_data 테이블 멱등 업서트
  INSERT INTO unclassified_data (
    video_id, day_key_local, channel_id, channel_name, video_title,
    video_description, view_count, upload_date, collection_date,
    thumbnail_url, category, sub_category, status, created_at, updated_at
  ) VALUES (
    p_video_id, p_day_key_local, p_channel_id, p_channel_name, p_video_title,
    p_video_description, p_view_count, p_upload_date, p_collection_date,
    p_thumbnail_url, p_category, p_sub_category, p_status, NOW(), NOW()
  )
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
    updated_at = NOW();
    
  -- daily_video_stats 테이블 멱등 업서트
  INSERT INTO daily_video_stats (
    video_id, day_key_local, channel_id, channel_name, video_title,
    video_description, view_count, upload_date, collection_date,
    thumbnail_url, category, sub_category, status, created_at, updated_at
  ) VALUES (
    p_video_id, p_day_key_local, p_channel_id, p_channel_name, p_video_title,
    p_video_description, p_view_count, p_upload_date, p_collection_date,
    p_thumbnail_url, p_category, p_sub_category, p_status, NOW(), NOW()
  )
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
END;
$$ LANGUAGE plpgsql;

-- 5) 임시 테이블 머지 함수 생성
CREATE OR REPLACE FUNCTION merge_temp_video_data()
RETURNS TABLE(
  processed_count INTEGER,
  merged_count INTEGER,
  new_count INTEGER
) AS $$
DECLARE
  temp_count INTEGER;
  merged_count INTEGER := 0;
  new_count INTEGER := 0;
BEGIN
  -- 임시 테이블이 존재하는지 확인
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'temp_video_import') THEN
    RAISE EXCEPTION '임시 테이블 temp_video_import가 존재하지 않습니다';
  END IF;
  
  -- 임시 테이블 데이터 개수 확인
  SELECT COUNT(*) INTO temp_count FROM temp_video_import;
  
  -- unclassified_data 머지
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
    COUNT(*) FILTER (WHERE action = 'merged') as merged,
    COUNT(*) FILTER (WHERE action = 'new') as new
  INTO merged_count, new_count
  FROM merge_result;
  
  -- daily_video_stats 머지
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
  
  -- 임시 테이블 정리
  DROP TABLE temp_video_import;
  
  RETURN QUERY SELECT temp_count, merged_count, new_count;
END;
$$ LANGUAGE plpgsql;

-- 6) 멱등성 테스트 함수 생성
CREATE OR REPLACE FUNCTION test_idempotency()
RETURNS TABLE(
  test_name TEXT,
  before_count BIGINT,
  after_count BIGINT,
  is_idempotent BOOLEAN
) AS $$
DECLARE
  before_unclassified BIGINT;
  before_daily BIGINT;
  after_unclassified BIGINT;
  after_daily BIGINT;
BEGIN
  -- 테스트 전 데이터 개수
  SELECT COUNT(*) INTO before_unclassified FROM unclassified_data;
  SELECT COUNT(*) INTO before_daily FROM daily_video_stats;
  
  -- 테스트 후 데이터 개수 (실제로는 같은 데이터를 다시 삽입하여 테스트)
  SELECT COUNT(*) INTO after_unclassified FROM unclassified_data;
  SELECT COUNT(*) INTO after_daily FROM daily_video_stats;
  
  RETURN QUERY SELECT 
    '멱등성 테스트'::TEXT,
    before_unclassified + before_daily,
    after_unclassified + after_daily,
    (before_unclassified = after_unclassified AND before_daily = after_daily);
END;
$$ LANGUAGE plpgsql;

-- 7) 현재 상태 확인
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
