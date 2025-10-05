#!/usr/bin/env node

/**
 * 수집된 데이터 확인 스크립트
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkCollectedData() {
  console.log('🔍 수집된 데이터 확인 시작');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 2025-01-03 수집 데이터 개수 확인
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM unclassified_data WHERE collection_date = $1', 
      ['2025-01-03']
    );
    console.log(`📊 2025-01-03 수집 데이터 개수: ${countResult.rows[0].count}개`);
    
    // 전체 수집 데이터 개수 확인
    const totalResult = await client.query('SELECT COUNT(*) as count FROM unclassified_data');
    console.log(`📊 전체 수집 데이터 개수: ${totalResult.rows[0].count}개`);
    
    // 날짜별 수집 데이터 확인
    const dateResult = await client.query(`
      SELECT collection_date, COUNT(*) as count 
      FROM unclassified_data 
      GROUP BY collection_date 
      ORDER BY collection_date DESC
    `);
    console.log('📅 날짜별 수집 데이터:');
    dateResult.rows.forEach(row => {
      console.log(`   ${row.collection_date}: ${row.count}개`);
    });
    
    // 상위 5개 영상 확인
    const topVideos = await client.query(`
      SELECT video_title, view_count, collection_date 
      FROM unclassified_data 
      WHERE collection_date = '2025-01-03'
      ORDER BY view_count DESC 
      LIMIT 5
    `);
    console.log('📺 2025-01-03 상위 5개 영상:');
    topVideos.rows.forEach((row, i) => {
      console.log(`   ${i+1}. ${row.video_title} (조회수: ${parseInt(row.view_count).toLocaleString()})`);
    });
    
    client.release();
    console.log('✅ 데이터 확인 완료');
    
  } catch (error) {
    console.error('❌ 데이터 확인 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkCollectedData();
