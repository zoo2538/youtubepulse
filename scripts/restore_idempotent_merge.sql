-- 서버 멱등 복원 SQL 스크립트
-- 임시 테이블을 사용한 안전한 데이터 병합

-- 1. 임시 테이블 생성 (unclassified_data와 동일한 구조)
CREATE TEMP TABLE IF NOT EXISTS temp_video_import (
    video_id VARCHAR(255) NOT NULL,
    day_key_local VARCHAR(10) NOT NULL,
    channel_id VARCHAR(255),
    channel_name VARCHAR(500),
    video_title TEXT,
    video_description TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    upload_date TIMESTAMP,
    collection_date TIMESTAMP,
    thumbnail_url TEXT,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'unclassified',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 임시 테이블에 데이터 로드 (실제 사용시에는 COPY 명령이나 INSERT 사용)
-- COPY temp_video_import FROM '/path/to/backup_data.csv' WITH CSV HEADER;

-- 3. unclassified_data 테이블에 멱등 병합
INSERT INTO unclassified_data (
    video_id, day_key_local, channel_id, channel_name, video_title, video_description,
    view_count, like_count, upload_date, collection_date, thumbnail_url,
    category, sub_category, status, created_at, updated_at
)
SELECT 
    video_id, day_key_local, channel_id, channel_name, video_title, video_description,
    view_count, like_count, upload_date, collection_date, thumbnail_url,
    category, sub_category, status, created_at, updated_at
FROM temp_video_import
ON CONFLICT (video_id, day_key_local) 
DO UPDATE SET
    -- 메타데이터는 서버 우선 (정본)
    channel_id = EXCLUDED.channel_id,
    channel_name = EXCLUDED.channel_name,
    video_title = EXCLUDED.video_title,
    video_description = EXCLUDED.video_description,
    thumbnail_url = EXCLUDED.thumbnail_url,
    
    -- 수치 데이터는 최대값 보존
    view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
    like_count = GREATEST(unclassified_data.like_count, EXCLUDED.like_count),
    
    -- 수동 분류 필드는 로컬 우선 (사용자 입력 우선)
    category = CASE 
        WHEN EXCLUDED.category IS NOT NULL AND EXCLUDED.category != '' 
        THEN EXCLUDED.category 
        ELSE unclassified_data.category 
    END,
    sub_category = CASE 
        WHEN EXCLUDED.sub_category IS NOT NULL AND EXCLUDED.sub_category != '' 
        THEN EXCLUDED.sub_category 
        ELSE unclassified_data.sub_category 
    END,
    status = CASE 
        WHEN EXCLUDED.status IS NOT NULL AND EXCLUDED.status != 'unclassified' 
        THEN EXCLUDED.status 
        ELSE unclassified_data.status 
    END,
    
    -- 날짜는 최신값
    upload_date = EXCLUDED.upload_date,
    collection_date = EXCLUDED.collection_date,
    updated_at = GREATEST(unclassified_data.updated_at, EXCLUDED.updated_at)
RETURNING 
    video_id, 
    day_key_local,
    CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as action;

-- 4. daily_video_stats 테이블에도 동일한 로직 적용
INSERT INTO daily_video_stats (
    video_id, day_key_local, channel_id, channel_name, video_title, video_description,
    view_count, like_count, upload_date, collection_date, thumbnail_url,
    category, sub_category, status, created_at, updated_at
)
SELECT 
    video_id, day_key_local, channel_id, channel_name, video_title, video_description,
    view_count, like_count, upload_date, collection_date, thumbnail_url,
    category, sub_category, status, created_at, updated_at
FROM temp_video_import
ON CONFLICT (video_id, day_key_local)
DO UPDATE SET
    -- 메타데이터는 서버 우선
    channel_name = EXCLUDED.channel_name,
    video_title = EXCLUDED.video_title,
    video_description = EXCLUDED.video_description,
    thumbnail_url = EXCLUDED.thumbnail_url,
    
    -- 수치 데이터는 최대값 보존
    view_count = GREATEST(daily_video_stats.view_count, EXCLUDED.view_count),
    like_count = GREATEST(daily_video_stats.like_count, EXCLUDED.like_count),
    
    -- 수동 분류 필드는 로컬 우선
    category = CASE 
        WHEN EXCLUDED.category IS NOT NULL AND EXCLUDED.category != '' 
        THEN EXCLUDED.category 
        ELSE daily_video_stats.category 
    END,
    sub_category = CASE 
        WHEN EXCLUDED.sub_category IS NOT NULL AND EXCLUDED.sub_category != '' 
        THEN EXCLUDED.sub_category 
        ELSE daily_video_stats.sub_category 
    END,
    status = CASE 
        WHEN EXCLUDED.status IS NOT NULL AND EXCLUDED.status != 'unclassified' 
        THEN EXCLUDED.status 
        ELSE daily_video_stats.status 
    END,
    
    -- 날짜는 최신값
    upload_date = EXCLUDED.upload_date,
    collection_date = EXCLUDED.collection_date,
    updated_at = GREATEST(daily_video_stats.updated_at, EXCLUDED.updated_at)
RETURNING 
    video_id, 
    day_key_local,
    CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as action;

-- 5. 임시 테이블 정리
DROP TABLE IF EXISTS temp_video_import;

-- 6. 통계 출력
SELECT 
    'unclassified_data' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE updated_at > created_at) as updated_records,
    COUNT(*) FILTER (WHERE updated_at = created_at) as new_records
FROM unclassified_data
WHERE updated_at >= NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
    'daily_video_stats' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE updated_at > created_at) as updated_records,
    COUNT(*) FILTER (WHERE updated_at = created_at) as new_records
FROM daily_video_stats
WHERE updated_at >= NOW() - INTERVAL '1 hour';