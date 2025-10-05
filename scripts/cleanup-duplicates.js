#!/usr/bin/env node

/**
 * 중복 영상 정리 스크립트
 * 백업으로 인해 늘어난 중복 영상들을 정리합니다
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/youtubepulse'
});

async function cleanupDuplicates() {
  console.log('🧹 중복 영상 정리 시작...');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 현재 중복 상황 분석
    console.log('\n📊 현재 중복 상황 분석...');
    
    const duplicateAnalysis = await client.query(`
      SELECT 
        video_id,
        day_key_local,
        COUNT(*) as duplicate_count,
        MAX(view_count) as max_view_count,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created
      FROM unclassified_data 
      GROUP BY video_id, day_key_local
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, video_id
    `);
    
    console.log(`🔍 발견된 중복 그룹: ${duplicateAnalysis.rows.length}개`);
    
    if (duplicateAnalysis.rows.length === 0) {
      console.log('✅ 중복이 없습니다. 정리할 필요가 없습니다.');
      client.release();
      return;
    }
    
    // 중복 상세 정보 출력
    console.log('\n📋 중복 상세 정보:');
    duplicateAnalysis.rows.slice(0, 10).forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.video_id} (${row.day_key_local})`);
      console.log(`      - 중복 수: ${row.duplicate_count}개`);
      console.log(`      - 최대 조회수: ${row.max_view_count.toLocaleString()}`);
      console.log(`      - 생성 기간: ${row.first_created} ~ ${row.last_created}`);
    });
    
    if (duplicateAnalysis.rows.length > 10) {
      console.log(`   ... 외 ${duplicateAnalysis.rows.length - 10}개 더`);
    }
    
    // 2. 사용자 확인
    console.log('\n⚠️  중복 정리를 진행하시겠습니까?');
    console.log('   - 각 (video_id, day_key_local) 조합에서 조회수가 가장 높은 레코드만 유지');
    console.log('   - 나머지 중복 레코드는 삭제됩니다');
    console.log('   - 이 작업은 되돌릴 수 없습니다');
    
    // 3. 중복 정리 실행
    console.log('\n🔄 중복 정리 실행 중...');
    
    // 임시 테이블에 최적화된 데이터 저장
    await client.query(`
      CREATE TEMP TABLE temp_cleaned_data AS
      SELECT DISTINCT ON (video_id, day_key_local)
        id,
        video_id,
        channel_id,
        channel_name,
        video_title,
        video_description,
        view_count,
        upload_date,
        collection_date,
        thumbnail_url,
        category,
        sub_category,
        status,
        day_key_local,
        created_at,
        updated_at
      FROM unclassified_data
      ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
    `);
    
    // 기존 데이터 백업 (안전장치)
    console.log('💾 기존 데이터 백업 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_before_cleanup AS
      SELECT * FROM unclassified_data WHERE 1=0
    `);
    
    await client.query(`
      INSERT INTO backup_before_cleanup 
      SELECT * FROM unclassified_data
    `);
    
    // 기존 데이터 삭제
    console.log('🗑️ 기존 중복 데이터 삭제 중...');
    const deleteResult = await client.query('DELETE FROM unclassified_data');
    console.log(`   - 삭제된 레코드: ${deleteResult.rowCount}개`);
    
    // 정리된 데이터 복원
    console.log('📥 정리된 데이터 복원 중...');
    const insertResult = await client.query(`
      INSERT INTO unclassified_data 
      SELECT * FROM temp_cleaned_data
    `);
    console.log(`   - 복원된 레코드: ${insertResult.rowCount}개`);
    
    // 임시 테이블 정리
    await client.query('DROP TABLE temp_cleaned_data');
    
    // 4. 정리 결과 확인
    console.log('\n📊 정리 결과 확인...');
    
    const finalDuplicateCheck = await client.query(`
      SELECT 
        video_id,
        day_key_local,
        COUNT(*) as count
      FROM unclassified_data 
      GROUP BY video_id, day_key_local
      HAVING COUNT(*) > 1
    `);
    
    const totalRecords = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    const uniqueCombinations = await client.query(`
      SELECT COUNT(DISTINCT CONCAT(video_id, '-', day_key_local)) as unique_count 
      FROM unclassified_data
    `);
    
    console.log('✅ 중복 정리 완료!');
    console.log(`   - 총 레코드: ${totalRecords.rows[0].count}개`);
    console.log(`   - 고유 조합: ${uniqueCombinations.rows[0].unique_count}개`);
    console.log(`   - 남은 중복: ${finalDuplicateCheck.rows.length}개`);
    
    if (finalDuplicateCheck.rows.length > 0) {
      console.log('⚠️  여전히 중복이 발견됨:');
      finalDuplicateCheck.rows.forEach(row => {
        console.log(`   ${row.video_id} (${row.day_key_local}): ${row.count}개`);
      });
    } else {
      console.log('🎉 모든 중복이 정리되었습니다!');
    }
    
    // 5. daily_video_stats 테이블도 동일하게 정리
    console.log('\n🔄 daily_video_stats 테이블 정리 중...');
    
    await client.query(`
      CREATE TEMP TABLE temp_cleaned_daily AS
      SELECT DISTINCT ON (video_id, day_key_local)
        *
      FROM daily_video_stats
      ORDER BY video_id, day_key_local, view_count DESC, created_at DESC
    `);
    
    const dailyDeleteResult = await client.query('DELETE FROM daily_video_stats');
    const dailyInsertResult = await client.query(`
      INSERT INTO daily_video_stats 
      SELECT * FROM temp_cleaned_daily
    `);
    
    await client.query('DROP TABLE temp_cleaned_daily');
    
    console.log(`   - daily_video_stats 정리 완료: ${dailyInsertResult.rowCount}개 레코드`);
    
    client.release();
    console.log('\n🎉 중복 정리 작업이 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 중복 정리 실패:', error.message);
    console.error('   - 백업 테이블(backup_before_cleanup)에서 데이터를 복원할 수 있습니다');
    throw error;
  } finally {
    await pool.end();
  }
}

// 메인 실행
cleanupDuplicates().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
