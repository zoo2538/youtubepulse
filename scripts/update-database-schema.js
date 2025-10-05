#!/usr/bin/env node

/**
 * 데이터베이스 스키마 업데이트
 * (video_id, day_key_local) 유니크 제약 조건 및 최대값 보존 upsert 로직 구현
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/youtubepulse'
});

async function updateDatabaseSchema() {
  console.log('🔄 데이터베이스 스키마 업데이트 시작...');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 기존 unclassified_data 테이블에 day_key_local 컬럼 추가
    await client.query(`
      ALTER TABLE unclassified_data 
      ADD COLUMN IF NOT EXISTS day_key_local VARCHAR(10)
    `);
    console.log('✅ day_key_local 컬럼 추가 완료');
    
    // 2. day_key_local 값 업데이트 (기존 데이터)
    await client.query(`
      UPDATE unclassified_data 
      SET day_key_local = TO_CHAR(collection_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
      WHERE day_key_local IS NULL
    `);
    console.log('✅ 기존 데이터 day_key_local 업데이트 완료');
    
    // 3. 유니크 인덱스 생성 (video_id, day_key_local)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_video_day_local
      ON unclassified_data (video_id, day_key_local)
    `);
    console.log('✅ 유니크 인덱스 생성 완료: (video_id, day_key_local)');
    
    // 4. 일별 집계 테이블 생성 (최적화된 조회를 위해)
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_video_stats (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(255) NOT NULL,
        day_key_local VARCHAR(10) NOT NULL,
        channel_id VARCHAR(255),
        channel_name VARCHAR(255),
        video_title TEXT,
        video_description TEXT,
        view_count BIGINT DEFAULT 0,
        like_count BIGINT DEFAULT 0,
        upload_date TIMESTAMP,
        collection_date TIMESTAMP,
        thumbnail_url TEXT,
        category VARCHAR(100),
        sub_category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'unclassified',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(video_id, day_key_local)
      )
    `);
    console.log('✅ daily_video_stats 테이블 생성 완료');
    
    // 5. 일별 집계 테이블에 유니크 인덱스 생성
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_video_day
      ON daily_video_stats (video_id, day_key_local)
    `);
    console.log('✅ daily_video_stats 유니크 인덱스 생성 완료');
    
    // 6. 기존 데이터를 일별 집계 테이블로 마이그레이션
    await client.query(`
      INSERT INTO daily_video_stats (
        video_id, day_key_local, channel_id, channel_name, video_title,
        video_description, view_count, like_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status, created_at, updated_at
      )
      SELECT 
        video_id, day_key_local, channel_id, channel_name, video_title,
        video_description, view_count, 0 as like_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status, created_at, updated_at
      FROM unclassified_data
      ON CONFLICT (video_id, day_key_local)
      DO UPDATE SET
        view_count = GREATEST(daily_video_stats.view_count, EXCLUDED.view_count),
        like_count = GREATEST(daily_video_stats.like_count, EXCLUDED.like_count),
        channel_name = EXCLUDED.channel_name,
        video_title = EXCLUDED.video_title,
        video_description = EXCLUDED.video_description,
        thumbnail_url = EXCLUDED.thumbnail_url,
        category = EXCLUDED.category,
        sub_category = EXCLUDED.sub_category,
        status = EXCLUDED.status,
        updated_at = NOW()
    `);
    console.log('✅ 기존 데이터 마이그레이션 완료');
    
    // 7. 통계 확인
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT video_id) as unique_videos,
        COUNT(DISTINCT day_key_local) as unique_days,
        COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as unique_combinations
      FROM daily_video_stats
    `);
    
    console.log('📊 마이그레이션 통계:');
    console.log(`   - 총 레코드: ${stats.rows[0].total_records}개`);
    console.log(`   - 고유 영상: ${stats.rows[0].unique_videos}개`);
    console.log(`   - 고유 날짜: ${stats.rows[0].unique_days}개`);
    console.log(`   - 고유 조합: ${stats.rows[0].unique_combinations}개`);
    
    client.release();
    console.log('✅ 데이터베이스 스키마 업데이트 완료');
    
  } catch (error) {
    console.error('❌ 스키마 업데이트 실패:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 메인 실행
updateDatabaseSchema().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
