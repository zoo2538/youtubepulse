#!/usr/bin/env node

/**
 * API 날짜별 데이터 테스트
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testApiDate() {
  console.log('🔍 API 날짜별 데이터 테스트');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 날짜 형식 확인
    const dateResult = await client.query(`
      SELECT DISTINCT collection_date 
      FROM unclassified_data 
      ORDER BY collection_date DESC
    `);
    
    console.log('📅 저장된 날짜들:');
    dateResult.rows.forEach(row => {
      console.log(`   ${row.collection_date} (타입: ${typeof row.collection_date})`);
    });
    
    // 2. 2025-01-03 데이터 직접 조회
    const testResult = await client.query(`
      SELECT 
        id, video_id, channel_id, channel_name, video_title, 
        video_description, view_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status
      FROM unclassified_data 
      WHERE collection_date = $1
      ORDER BY view_count DESC
      LIMIT 3
    `, ['2025-01-03']);
    
    console.log('📊 2025-01-03 데이터 (상위 3개):');
    testResult.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.video_title}`);
      console.log(`   채널: ${row.channel_name}`);
      console.log(`   조회수: ${parseInt(row.view_count).toLocaleString()}`);
      console.log(`   상태: ${row.status}`);
      console.log(`   날짜: ${row.collection_date}`);
      console.log('---');
    });
    
    // 3. API 형식으로 변환 테스트
    const apiData = testResult.rows.map(row => ({
      id: row.id,
      videoId: row.video_id,
      channelId: row.channel_id,
      channelName: row.channel_name,
      videoTitle: row.video_title,
      videoDescription: row.video_description,
      viewCount: row.view_count,
      uploadDate: row.upload_date,
      collectionDate: row.collection_date,
      thumbnailUrl: row.thumbnail_url,
      category: row.category || '',
      subCategory: row.sub_category || '',
      status: row.status || 'unclassified'
    }));
    
    console.log('🔄 API 형식 변환 결과:');
    console.log(JSON.stringify(apiData[0], null, 2));
    
    client.release();
    console.log('✅ 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testApiDate();
