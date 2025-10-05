#!/usr/bin/env node

/**
 * IndexedDB 데이터 초기화 스크립트
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function clearIndexedDB() {
  console.log('🔄 IndexedDB 데이터 초기화 시작');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 서버에서 최신 데이터 조회
    const result = await client.query(`
      SELECT 
        id, video_id, channel_id, channel_name, video_title, 
        video_description, view_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status
      FROM unclassified_data 
      WHERE collection_date::text LIKE '2025-10-05%'
      ORDER BY view_count DESC
    `);
    
    console.log(`📊 서버 데이터: ${result.rows.length}개`);
    
    // 2. API 형식으로 변환
    const apiData = result.rows.map(row => ({
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
    
    // 3. classification_data에 clean 데이터로 저장
    await client.query(`
      DELETE FROM classification_data WHERE data_type = 'unclassified'
    `);
    
    await client.query(`
      INSERT INTO classification_data (data_type, data, created_at)
      VALUES ($1, $2, NOW())
    `, ['unclassified', JSON.stringify(apiData)]);
    
    console.log('✅ IndexedDB용 데이터 정리 완료');
    console.log(`📊 정리된 데이터: ${apiData.length}개`);
    
    client.release();
    
  } catch (error) {
    console.error('❌ IndexedDB 초기화 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearIndexedDB();
