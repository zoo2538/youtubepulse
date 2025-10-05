#!/usr/bin/env node

/**
 * 중복 데이터 제거 스크립트
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function removeDuplicates() {
  console.log('🔄 중복 데이터 제거 시작');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 10월 5일 데이터 확인
    const result = await client.query(`
      SELECT 
        video_id, collection_date, COUNT(*) as count
      FROM unclassified_data 
      WHERE collection_date::text LIKE '2025-10-05%'
      GROUP BY video_id, collection_date
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log(`📊 중복된 video_id 조합: ${result.rows.length}개`);
    
    if (result.rows.length > 0) {
      console.log('🔍 중복 데이터 상세:');
      result.rows.forEach(row => {
        console.log(`   ${row.video_id} (${row.collection_date}): ${row.count}개`);
      });
      
      // 2. 중복 제거 (조회수 높은 것만 유지)
      for (const duplicate of result.rows) {
        const deleteResult = await client.query(`
          DELETE FROM unclassified_data 
          WHERE video_id = $1 
            AND collection_date = $2 
            AND id NOT IN (
              SELECT id FROM unclassified_data 
              WHERE video_id = $1 
                AND collection_date = $2 
              ORDER BY view_count DESC 
              LIMIT 1
            )
        `, [duplicate.video_id, duplicate.collection_date]);
        
        console.log(`✅ ${duplicate.video_id} 중복 제거: ${deleteResult.rowCount}개 삭제`);
      }
    } else {
      console.log('✅ 중복 데이터가 없습니다.');
    }
    
    // 3. 최종 확인
    const finalResult = await client.query(`
      SELECT 
        collection_date, COUNT(*) as count
      FROM unclassified_data 
      WHERE collection_date::text LIKE '2025-10-05%'
      GROUP BY collection_date
      ORDER BY collection_date
    `);
    
    console.log('📊 최종 10월 5일 데이터:');
    finalResult.rows.forEach(row => {
      console.log(`   ${row.collection_date}: ${row.count}개`);
    });
    
    client.release();
    console.log('✅ 중복 제거 완료');
    
  } catch (error) {
    console.error('❌ 중복 제거 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

removeDuplicates();
