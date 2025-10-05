// 서버 PostgreSQL 유니크 제약 조건 강제 적용
import fs from 'fs';
import path from 'path';

console.log('🔧 서버 PostgreSQL 유니크 제약 조건 적용...');

// SQL 스크립트 생성
const sqlScript = `
-- YouTube Pulse 하이브리드 시스템 유니크 제약 조건
-- 날짜 버킷별 중복 제거 및 최대값 보존을 위한 스키마 업데이트

-- 1. unclassified_data 테이블 유니크 제약 조건
CREATE UNIQUE INDEX IF NOT EXISTS ux_video_day_local_unclassified 
ON unclassified_data (video_id, day_key_local);

-- 2. daily_video_stats 테이블 유니크 제약 조건  
CREATE UNIQUE INDEX IF NOT EXISTS ux_video_day_local_daily 
ON daily_video_stats (video_id, day_key_local);

-- 3. 기존 중복 데이터 정리 (최대값 보존)
WITH ranked_data AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY video_id, day_key_local 
      ORDER BY view_count DESC, updated_at DESC
    ) as rn
  FROM unclassified_data
)
DELETE FROM unclassified_data 
WHERE id IN (
  SELECT id FROM ranked_data WHERE rn > 1
);

-- 4. daily_video_stats 중복 데이터 정리
WITH ranked_daily AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY video_id, day_key_local 
      ORDER BY view_count DESC, updated_at DESC
    ) as rn
  FROM daily_video_stats
)
DELETE FROM daily_video_stats 
WHERE id IN (
  SELECT id FROM ranked_daily WHERE rn > 1
);

-- 5. 멱등 upsert 함수 생성
CREATE OR REPLACE FUNCTION upsert_video_data(
  p_video_id VARCHAR(255),
  p_day_key_local VARCHAR(10),
  p_channel_id VARCHAR(255),
  p_channel_name VARCHAR(500),
  p_video_title TEXT,
  p_video_description TEXT,
  p_view_count INTEGER,
  p_like_count INTEGER,
  p_upload_date TIMESTAMP,
  p_collection_date TIMESTAMP,
  p_thumbnail_url TEXT,
  p_category VARCHAR(100),
  p_sub_category VARCHAR(100),
  p_status VARCHAR(50)
) RETURNS TABLE(
  video_id VARCHAR(255),
  day_key_local VARCHAR(10),
  action VARCHAR(10)
) AS $$
BEGIN
  -- unclassified_data 테이블에 멱등 upsert
  INSERT INTO unclassified_data (
    video_id, day_key_local, channel_id, channel_name, video_title, video_description,
    view_count, like_count, upload_date, collection_date, thumbnail_url,
    category, sub_category, status, created_at, updated_at
  ) VALUES (
    p_video_id, p_day_key_local, p_channel_id, p_channel_name, p_video_title, p_video_description,
    p_view_count, p_like_count, p_upload_date, p_collection_date, p_thumbnail_url,
    p_category, p_sub_category, p_status, NOW(), NOW()
  )
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
    updated_at = GREATEST(unclassified_data.updated_at, NOW())
  RETURNING 
    video_id, 
    day_key_local,
    CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as action;
    
  -- daily_video_stats 테이블에도 동일한 로직 적용
  INSERT INTO daily_video_stats (
    video_id, day_key_local, channel_id, channel_name, video_title, video_description,
    view_count, like_count, upload_date, collection_date, thumbnail_url,
    category, sub_category, status, created_at, updated_at
  ) VALUES (
    p_video_id, p_day_key_local, p_channel_id, p_channel_name, p_video_title, p_video_description,
    p_view_count, p_like_count, p_upload_date, p_collection_date, p_thumbnail_url,
    p_category, p_sub_category, p_status, NOW(), NOW()
  )
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
    updated_at = GREATEST(daily_video_stats.updated_at, NOW())
  RETURNING 
    video_id, 
    day_key_local,
    CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as action;
END;
$$ LANGUAGE plpgsql;

-- 6. 통계 출력
SELECT 
  'unclassified_data' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT(video_id, '_', day_key_local)) as unique_keys,
  COUNT(*) - COUNT(DISTINCT CONCAT(video_id, '_', day_key_local)) as duplicates_removed
FROM unclassified_data

UNION ALL

SELECT 
  'daily_video_stats' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT CONCAT(video_id, '_', day_key_local)) as unique_keys,
  COUNT(*) - COUNT(DISTINCT CONCAT(video_id, '_', day_key_local)) as duplicates_removed
FROM daily_video_stats;
`;

// SQL 스크립트 저장
const sqlFile = 'scripts/enforce-unique-constraints-final.sql';
fs.writeFileSync(sqlFile, sqlScript);

console.log('✅ SQL 스크립트 생성 완료:', sqlFile);
console.log('');
console.log('🔧 적용 방법:');
console.log('1. Railway 대시보드에서 PostgreSQL 데이터베이스 접속');
console.log('2. 다음 SQL 스크립트 실행:');
console.log('');
console.log('```sql');
console.log(sqlScript);
console.log('```');
console.log('');
console.log('3. 또는 Railway CLI 사용:');
console.log('   railway run psql < scripts/enforce-unique-constraints-final.sql');

// Node.js 실행 스크립트도 생성
const nodeScript = `
// Node.js로 유니크 제약 조건 적용
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function enforceUniqueConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 유니크 제약 조건 적용 중...');
    
    // SQL 스크립트 실행
    const sqlScript = fs.readFileSync('scripts/enforce-unique-constraints-final.sql', 'utf8');
    await client.query(sqlScript);
    
    console.log('✅ 유니크 제약 조건 적용 완료');
  } catch (error) {
    console.error('❌ 적용 실패:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

enforceUniqueConstraints().catch(console.error);
`;

const nodeFile = 'scripts/apply-unique-constraints.js';
fs.writeFileSync(nodeFile, nodeScript);

console.log('✅ Node.js 스크립트 생성 완료:', nodeFile);
console.log('');
console.log('🚀 실행 방법:');
console.log('1. DATABASE_URL 환경변수 설정');
console.log('2. node scripts/apply-unique-constraints.js');
