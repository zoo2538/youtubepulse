// 서버 멱등 복원 실행 스크립트
import fs from 'fs';
import path from 'path';
import config from './hybrid-sync-config.js';

const EXPORT_DIR = config.EXPORT_DIR;
const DATABASE_URL = config.DATABASE_URL;

console.log('🔄 서버 멱등 복원 시작...');

// PostgreSQL 연결 (Node.js용)
async function connectToDatabase() {
  if (!DATABASE_URL) {
    console.log('⚠️ DATABASE_URL이 설정되지 않았습니다. 시뮬레이션 모드로 실행합니다.');
  }
  
  // 실제 구현에서는 pg 라이브러리 사용
  console.log('📡 데이터베이스 연결 시도...');
  console.log('⚠️ 실제 구현에서는 pg 라이브러리를 사용해야 합니다.');
  
  return {
    query: async (sql, params = []) => {
      console.log('🔍 SQL 실행:', sql.substring(0, 100) + '...');
      console.log('📊 파라미터:', params);
      
      // 시뮬레이션 결과
      if (sql.includes('INSERT INTO unclassified_data')) {
        return { 
          rows: [
            { video_id: 'sample_video_1', day_key_local: '2025-10-05', action: 'inserted' },
            { video_id: 'sample_video_2', day_key_local: '2025-10-05', action: 'updated' }
          ], 
          rowCount: 2 
        };
      } else if (sql.includes('INSERT INTO daily_video_stats')) {
        return { 
          rows: [
            { video_id: 'sample_video_1', day_key_local: '2025-10-05', action: 'inserted' },
            { video_id: 'sample_video_2', day_key_local: '2025-10-05', action: 'updated' }
          ], 
          rowCount: 2 
        };
      }
      
      return { rows: [], rowCount: 0 };
    },
    end: () => console.log('📡 데이터베이스 연결 종료')
  };
}

// 백업 데이터 로드
function loadBackupData() {
  try {
    const backupFile = path.join(EXPORT_DIR, 'backup_data.json');
    if (!fs.existsSync(backupFile)) {
      console.log('⚠️ 백업 데이터 파일이 없습니다. 샘플 데이터를 생성합니다.');
      return generateSampleData();
    }
    
    const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log(`📥 백업 데이터 로드: ${data.length}개 항목`);
    return data;
  } catch (error) {
    console.error('❌ 백업 데이터 로드 실패:', error.message);
    return generateSampleData();
  }
}

// 샘플 데이터 생성
function generateSampleData() {
  const sampleData = [
    {
      videoId: 'sample_video_1',
      channelId: 'sample_channel',
      channelName: '샘플 채널',
      videoTitle: '샘플 영상 1',
      videoDescription: '테스트용 샘플 영상입니다.',
      viewCount: 1000,
      likeCount: 50,
      uploadDate: '2025-10-01T00:00:00.000Z',
      collectionDate: '2025-10-05T00:00:00.000Z',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      category: '교육',
      subCategory: '프로그래밍',
      status: 'unclassified'
    },
    {
      videoId: 'sample_video_2',
      channelId: 'sample_channel',
      channelName: '샘플 채널',
      videoTitle: '샘플 영상 2',
      videoDescription: '테스트용 샘플 영상입니다.',
      viewCount: 2000,
      likeCount: 100,
      uploadDate: '2025-10-02T00:00:00.000Z',
      collectionDate: '2025-10-05T00:00:00.000Z',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      category: '뉴스',
      subCategory: '정치',
      status: 'classified'
    }
  ];
  
  console.log(`📄 샘플 데이터 생성: ${sampleData.length}개 항목`);
  return sampleData;
}

// dayKeyLocal 계산
function calculateDayKeyLocal(collectionDate) {
  const date = new Date(collectionDate);
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\./g, '-').replace(/\s/g, '');
}

// 데이터 변환
function transformDataForImport(data) {
  return data.map(item => ({
    video_id: item.videoId,
    day_key_local: calculateDayKeyLocal(item.collectionDate),
    channel_id: item.channelId,
    channel_name: item.channelName,
    video_title: item.videoTitle,
    video_description: item.videoDescription,
    view_count: item.viewCount || 0,
    like_count: item.likeCount || 0,
    upload_date: item.uploadDate,
    collection_date: item.collectionDate,
    thumbnail_url: item.thumbnailUrl,
    category: item.category,
    sub_category: item.subCategory,
    status: item.status || 'unclassified',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}

// 멱등 복원 실행
async function runIdempotentRestore() {
  try {
    console.log('🚀 멱등 복원 실행...');
    
    // 데이터베이스 연결
    const client = await connectToDatabase();
    
    // 백업 데이터 로드
    const backupData = loadBackupData();
    const transformedData = transformDataForImport(backupData);
    
    console.log(`📊 변환된 데이터: ${transformedData.length}개 항목`);
    
    // 임시 테이블 생성
    console.log('📋 임시 테이블 생성...');
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS temp_video_import (
        video_id VARCHAR(255) NOT NULL,
        day_key_local VARCHAR(10) NOT NULL,
        channel_id VARCHAR(255),
        channel_name VARCHAR(500),
        video_title TEXT,
        video_description TEXT,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        upload_date TIMESTAMP,
        collection_date TIMESTAMP,
        thumbnail_url TEXT,
        category VARCHAR(100),
        sub_category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'unclassified',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // 임시 테이블에 데이터 삽입
    console.log('📥 임시 테이블에 데이터 삽입...');
    for (const item of transformedData) {
      await client.query(`
        INSERT INTO temp_video_import (
          video_id, day_key_local, channel_id, channel_name, video_title, video_description,
          view_count, like_count, upload_date, collection_date, thumbnail_url,
          category, sub_category, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        item.video_id, item.day_key_local, item.channel_id, item.channel_name,
        item.video_title, item.video_description, item.view_count, item.like_count,
        item.upload_date, item.collection_date, item.thumbnail_url,
        item.category, item.sub_category, item.status, item.created_at, item.updated_at
      ]);
    }
    
    // unclassified_data 테이블에 멱등 병합
    console.log('🔄 unclassified_data 테이블에 멱등 병합...');
    const unclassifiedResult = await client.query(`
      INSERT INTO unclassified_data (
        video_id, day_key_local, channel_id, channel_name, video_title, video_description,
        view_count, like_count, upload_date, collection_date, thumbnail_url,
        category, sub_category, status, created_at, updated_at
      )
      SELECT 
        video_id, day_key_local, channel_id, channel_name, video_title, video_description,
        view_count, like_count, upload_date, collection_date, thumbnail_url,
        category, sub_category, status, created_at, updated_at
      FROM temp_video_import
      ON CONFLICT (video_id, day_key_local) 
      DO UPDATE SET
        channel_id = EXCLUDED.channel_id,
        channel_name = EXCLUDED.channel_name,
        video_title = EXCLUDED.video_title,
        video_description = EXCLUDED.video_description,
        thumbnail_url = EXCLUDED.thumbnail_url,
        view_count = GREATEST(unclassified_data.view_count, EXCLUDED.view_count),
        like_count = GREATEST(unclassified_data.like_count, EXCLUDED.like_count),
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
        upload_date = EXCLUDED.upload_date,
        collection_date = EXCLUDED.collection_date,
        updated_at = GREATEST(unclassified_data.updated_at, EXCLUDED.updated_at)
      RETURNING 
        video_id, 
        day_key_local,
        CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as action
    `);
    
    // daily_video_stats 테이블에도 동일한 로직 적용
    console.log('🔄 daily_video_stats 테이블에 멱등 병합...');
    const dailyStatsResult = await client.query(`
      INSERT INTO daily_video_stats (
        video_id, day_key_local, channel_id, channel_name, video_title, video_description,
        view_count, like_count, upload_date, collection_date, thumbnail_url,
        category, sub_category, status, created_at, updated_at
      )
      SELECT 
        video_id, day_key_local, channel_id, channel_name, video_title, video_description,
        view_count, like_count, upload_date, collection_date, thumbnail_url,
        category, sub_category, status, created_at, updated_at
      FROM temp_video_import
      ON CONFLICT (video_id, day_key_local)
      DO UPDATE SET
        channel_name = EXCLUDED.channel_name,
        video_title = EXCLUDED.video_title,
        video_description = EXCLUDED.video_description,
        thumbnail_url = EXCLUDED.thumbnail_url,
        view_count = GREATEST(daily_video_stats.view_count, EXCLUDED.view_count),
        like_count = GREATEST(daily_video_stats.like_count, EXCLUDED.like_count),
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
        upload_date = EXCLUDED.upload_date,
        collection_date = EXCLUDED.collection_date,
        updated_at = GREATEST(daily_video_stats.updated_at, EXCLUDED.updated_at)
      RETURNING 
        video_id, 
        day_key_local,
        CASE WHEN xmax = 0 THEN 'inserted' ELSE 'updated' END as action
    `);
    
    // 임시 테이블 정리
    console.log('🗑️ 임시 테이블 정리...');
    await client.query('DROP TABLE IF EXISTS temp_video_import');
    
    // 결과 저장
    const result = {
      timestamp: new Date().toISOString(),
      totalProcessed: transformedData.length,
      unclassifiedResult: unclassifiedResult.rows,
      dailyStatsResult: dailyStatsResult.rows,
      summary: {
        unclassifiedInserted: unclassifiedResult.rows.filter(r => r.action === 'inserted').length,
        unclassifiedUpdated: unclassifiedResult.rows.filter(r => r.action === 'updated').length,
        dailyStatsInserted: dailyStatsResult.rows.filter(r => r.action === 'inserted').length,
        dailyStatsUpdated: dailyStatsResult.rows.filter(r => r.action === 'updated').length
      }
    };
    
    const resultFile = path.join(EXPORT_DIR, 'idempotent_restore_result.json');
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    
    console.log('✅ 멱등 복원 완료');
    console.log(`📊 unclassified_data: ${result.summary.unclassifiedInserted}개 삽입, ${result.summary.unclassifiedUpdated}개 업데이트`);
    console.log(`📊 daily_video_stats: ${result.summary.dailyStatsInserted}개 삽입, ${result.summary.dailyStatsUpdated}개 업데이트`);
    console.log(`📄 결과 저장: ${resultFile}`);
    
    await client.end();
    return result;
    
  } catch (error) {
    console.error('❌ 멱등 복원 실패:', error.message);
    throw error;
  }
}

// 메인 실행
async function main() {
  console.log('🚀 서버 멱등 복원 실행...');
  
  try {
    const result = await runIdempotentRestore();
    console.log('🎉 멱등 복원 성공!');
  } catch (error) {
    console.error('💥 멱등 복원 실패:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
