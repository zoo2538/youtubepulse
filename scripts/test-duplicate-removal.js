#!/usr/bin/env node

/**
 * 날짜별 중복 제거 및 최대값 보존 테스트
 * 요구사항: 같은 영상이 같은 날짜에 여러 번 수집되어도 조회수가 가장 높은 하나만 유지
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/youtubepulse'
});

async function testDuplicateRemoval() {
  console.log('🧪 날짜별 중복 제거 테스트 시작...');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 테스트 데이터 생성 (같은 영상, 같은 날짜, 다른 조회수)
    const testData = [
      {
        videoId: 'test_video_001',
        channelId: 'test_channel_001',
        channelName: '테스트 채널',
        videoTitle: '테스트 영상 1',
        videoDescription: '테스트 설명',
        viewCount: 100000,
        uploadDate: '2025-10-05T00:00:00Z',
        collectionDate: '2025-10-05T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        category: '테스트',
        subCategory: '테스트',
        status: 'unclassified'
      },
      {
        videoId: 'test_video_001', // 같은 영상
        channelId: 'test_channel_001',
        channelName: '테스트 채널',
        videoTitle: '테스트 영상 1',
        videoDescription: '테스트 설명',
        viewCount: 150000, // 더 높은 조회수
        uploadDate: '2025-10-05T00:00:00Z',
        collectionDate: '2025-10-05T12:00:00Z', // 같은 날, 다른 시간
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        category: '테스트',
        subCategory: '테스트',
        status: 'unclassified'
      },
      {
        videoId: 'test_video_001', // 같은 영상
        channelId: 'test_channel_001',
        channelName: '테스트 채널',
        videoTitle: '테스트 영상 1',
        videoDescription: '테스트 설명',
        viewCount: 80000, // 더 낮은 조회수
        uploadDate: '2025-10-05T00:00:00Z',
        collectionDate: '2025-10-05T18:00:00Z', // 같은 날, 다른 시간
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        category: '테스트',
        subCategory: '테스트',
        status: 'unclassified'
      }
    ];
    
    console.log('📊 테스트 데이터 생성:');
    testData.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.videoId} - 조회수: ${item.viewCount.toLocaleString()}`);
    });
    
    // 2. 기존 테스트 데이터 삭제
    await client.query(`
      DELETE FROM unclassified_data 
      WHERE video_id = 'test_video_001'
    `);
    console.log('🗑️ 기존 테스트 데이터 삭제 완료');
    
    // 3. 테스트 데이터 삽입 (upsert 로직 테스트)
    for (const item of testData) {
      const dayKeyLocal = new Date(item.collectionDate).toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\./g, '-').replace(/\s/g, '');
      
      await client.query(`
        INSERT INTO unclassified_data (
          video_id, channel_id, channel_name, video_title, video_description,
          view_count, upload_date, collection_date, thumbnail_url, category, sub_category, status, day_key_local
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
          updated_at = NOW()
      `, [
        item.videoId, item.channelId, item.channelName, item.videoTitle,
        item.videoDescription, item.viewCount, item.uploadDate, item.collectionDate,
        item.thumbnailUrl, item.category, item.subCategory, item.status, dayKeyLocal
      ]);
      
      console.log(`✅ ${item.videoId} 삽입/업데이트 완료 (조회수: ${item.viewCount.toLocaleString()})`);
    }
    
    // 4. 결과 확인
    const result = await client.query(`
      SELECT 
        video_id, day_key_local, view_count, collection_date, updated_at
      FROM unclassified_data 
      WHERE video_id = 'test_video_001'
      ORDER BY collection_date
    `);
    
    console.log('\n📊 최종 결과:');
    console.log(`   - 총 레코드 수: ${result.rows.length}개`);
    
    if (result.rows.length === 1) {
      const finalRecord = result.rows[0];
      console.log(`   - 최종 조회수: ${finalRecord.view_count.toLocaleString()}`);
      console.log(`   - 날짜: ${finalRecord.day_key_local}`);
      console.log(`   - 업데이트 시간: ${finalRecord.updated_at}`);
      
      if (finalRecord.view_count === 150000) {
        console.log('✅ 테스트 성공: 최대 조회수(150,000)가 보존됨');
      } else {
        console.log('❌ 테스트 실패: 최대 조회수가 보존되지 않음');
      }
    } else {
      console.log('❌ 테스트 실패: 중복 제거가 되지 않음');
    }
    
    // 5. 다른 날짜 테스트 (같은 영상, 다른 날짜)
    console.log('\n🧪 다른 날짜 테스트...');
    
    const nextDayData = {
      videoId: 'test_video_001',
      channelId: 'test_channel_001',
      channelName: '테스트 채널',
      videoTitle: '테스트 영상 1',
      videoDescription: '테스트 설명',
      viewCount: 200000,
      uploadDate: '2025-10-05T00:00:00Z',
      collectionDate: '2025-10-06T00:00:00Z', // 다음 날
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      category: '테스트',
      subCategory: '테스트',
      status: 'unclassified'
    };
    
    const nextDayKeyLocal = new Date(nextDayData.collectionDate).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '');
    
    await client.query(`
      INSERT INTO unclassified_data (
        video_id, channel_id, channel_name, video_title, video_description,
        view_count, upload_date, collection_date, thumbnail_url, category, sub_category, status, day_key_local
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (video_id, day_key_local) 
      DO UPDATE SET
        view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
        updated_at = NOW()
    `, [
      nextDayData.videoId, nextDayData.channelId, nextDayData.channelName, nextDayData.videoTitle,
      nextDayData.videoDescription, nextDayData.viewCount, nextDayData.uploadDate, nextDayData.collectionDate,
      nextDayData.thumbnailUrl, nextDayData.category, nextDayData.subCategory, nextDayData.status, nextDayKeyLocal
    ]);
    
    // 6. 최종 결과 확인
    const finalResult = await client.query(`
      SELECT 
        video_id, day_key_local, view_count, collection_date
      FROM unclassified_data 
      WHERE video_id = 'test_video_001'
      ORDER BY day_key_local
    `);
    
    console.log('\n📊 최종 결과 (다른 날짜 포함):');
    finalResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.day_key_local} - 조회수: ${row.view_count.toLocaleString()}`);
    });
    
    if (finalResult.rows.length === 2) {
      console.log('✅ 테스트 성공: 같은 영상이 다른 날짜에 각각 저장됨');
    } else {
      console.log('❌ 테스트 실패: 날짜별 분리가 되지 않음');
    }
    
    // 7. 정리
    await client.query(`
      DELETE FROM unclassified_data 
      WHERE video_id = 'test_video_001'
    `);
    console.log('🗑️ 테스트 데이터 정리 완료');
    
    client.release();
    console.log('✅ 날짜별 중복 제거 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 메인 실행
testDuplicateRemoval().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
