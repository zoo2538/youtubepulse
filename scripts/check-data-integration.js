#!/usr/bin/env node

/**
 * 수집된 데이터와 웹 분류 시스템 연동 확인
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkDataIntegration() {
  console.log('🔗 수집된 데이터와 웹 분류 시스템 연동 확인');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 수집된 데이터 상태 확인
    const dataResult = await client.query(`
      SELECT 
        video_id, 
        video_title, 
        channel_name, 
        status, 
        category, 
        sub_category,
        view_count,
        collection_date
      FROM unclassified_data 
      WHERE collection_date = '2025-01-03' 
      ORDER BY view_count DESC 
      LIMIT 5
    `);
    
    console.log('📊 수집된 데이터 샘플 (조회수 상위 5개):');
    dataResult.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.video_title}`);
      console.log(`   채널: ${row.channel_name}`);
      console.log(`   조회수: ${parseInt(row.view_count).toLocaleString()}`);
      console.log(`   상태: ${row.status}`);
      console.log(`   카테고리: ${row.category || '미분류'}`);
      console.log(`   세부카테고리: ${row.sub_category || '미분류'}`);
      console.log('---');
    });
    
    // 2. 상태별 통계
    const statusResult = await client.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM unclassified_data 
      WHERE collection_date = '2025-01-03'
      GROUP BY status
    `);
    
    console.log('📈 상태별 통계:');
    statusResult.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}개`);
    });
    
    // 3. 카테고리별 통계 (분류된 것만)
    const categoryResult = await client.query(`
      SELECT 
        category,
        COUNT(*) as count
      FROM unclassified_data 
      WHERE collection_date = '2025-01-03' 
        AND status = 'classified'
        AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `);
    
    console.log('🏷️ 분류된 카테고리별 통계:');
    if (categoryResult.rows.length > 0) {
      categoryResult.rows.forEach(row => {
        console.log(`   ${row.category}: ${row.count}개`);
      });
    } else {
      console.log('   아직 분류된 데이터가 없습니다.');
    }
    
    // 4. 웹 인터페이스에서 접근 가능한 데이터 확인
    console.log('🌐 웹 인터페이스 연동 정보:');
    console.log('   - API 엔드포인트: https://api.youthbepulse.com/api/unclassified');
    console.log('   - 웹 분류 페이지: https://youthbepulse.com/data-classification-detail?date=2025-01-03');
    console.log('   - 데이터베이스: PostgreSQL (Railway)');
    console.log('   - 로컬 저장소: IndexedDB (브라우저)');
    
    client.release();
    console.log('✅ 연동 확인 완료');
    
  } catch (error) {
    console.error('❌ 연동 확인 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDataIntegration();
