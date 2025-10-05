#!/usr/bin/env node

/**
 * 중복 방지 시스템 강화
 * 백업/복원 시 영상이 배로 늘어나는 문제 해결
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/youtubepulse'
});

async function fixDuplicatePrevention() {
  console.log('🔧 중복 방지 시스템 강화 시작...');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 기존 중복 데이터 정리
    console.log('🗑️ 기존 중복 데이터 정리 중...');
    await client.query(`
      DELETE FROM unclassified_data 
      WHERE id NOT IN (
        SELECT DISTINCT ON (video_id, day_key_local) id
        FROM unclassified_data 
        ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
      )
    `);
    
    // 2. 유니크 제약 조건 강화
    console.log('🔒 유니크 제약 조건 강화 중...');
    
    // 기존 인덱스 삭제 후 재생성
    await client.query(`DROP INDEX IF EXISTS ux_video_day_local`);
    await client.query(`DROP INDEX IF EXISTS ux_daily_video_day`);
    
    // 강화된 유니크 인덱스 생성
    await client.query(`
      CREATE UNIQUE INDEX ux_video_day_local_strong
      ON unclassified_data (video_id, day_key_local)
    `);
    
    await client.query(`
      CREATE UNIQUE INDEX ux_daily_video_day_strong
      ON daily_video_stats (video_id, day_key_local)
    `);
    
    // 3. 백업/복원용 안전한 업서트 함수 생성
    console.log('🛡️ 안전한 업서트 함수 생성 중...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION safe_upsert_video_data(
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
          
        -- daily_video_stats 테이블에도 동일하게 적용
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
    `);
    
    // 4. 백업 메타데이터 테이블 생성
    console.log('📊 백업 메타데이터 테이블 생성 중...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_metadata (
        id SERIAL PRIMARY KEY,
        backup_date TIMESTAMP DEFAULT NOW(),
        backup_type VARCHAR(50) NOT NULL,
        schema_version VARCHAR(20) DEFAULT '1.0',
        record_count INTEGER,
        day_key_range_start VARCHAR(10),
        day_key_range_end VARCHAR(10),
        checksum VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 5. 중복 검사 함수 생성
    console.log('🔍 중복 검사 함수 생성 중...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION check_duplicates()
      RETURNS TABLE(
        video_id VARCHAR(255),
        day_key_local VARCHAR(10),
        duplicate_count BIGINT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          u.video_id,
          u.day_key_local,
          COUNT(*) as duplicate_count
        FROM unclassified_data u
        GROUP BY u.video_id, u.day_key_local
        HAVING COUNT(*) > 1
        ORDER BY duplicate_count DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // 6. 현재 상태 확인
    console.log('📊 현재 상태 확인 중...');
    
    const duplicateCheck = await client.query('SELECT * FROM check_duplicates()');
    const totalRecords = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    const uniqueCombinations = await client.query(`
      SELECT COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as unique_count 
      FROM unclassified_data
    `);
    
    console.log('📊 중복 방지 시스템 강화 완료');
    console.log(`   - 총 레코드: ${totalRecords.rows[0].count}개`);
    console.log(`   - 고유 조합: ${uniqueCombinations.rows[0].unique_count}개`);
    console.log(`   - 중복 그룹: ${duplicateCheck.rows.length}개`);
    
    if (duplicateCheck.rows.length > 0) {
      console.log('⚠️  여전히 중복이 발견됨:');
      duplicateCheck.rows.forEach(row => {
        console.log(`   ${row.video_id} (${row.day_key_local}): ${row.duplicate_count}개`);
      });
    } else {
      console.log('✅ 중복 없음 - 시스템 정상');
    }
    
    client.release();
    console.log('✅ 중복 방지 시스템 강화 완료');
    
  } catch (error) {
    console.error('❌ 중복 방지 시스템 강화 실패:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 메인 실행
fixDuplicatePrevention().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
