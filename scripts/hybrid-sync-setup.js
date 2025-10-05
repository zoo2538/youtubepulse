#!/usr/bin/env node

/**
 * 하이브리드 동기화 설정 스크립트
 * 서버(PostgreSQL)와 로컬(IndexedDB) 간 안전한 동기화 구축
 */

import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 1. 현재 상태 백업
async function backupCurrentState() {
  console.log('🔄 현재 상태 백업 시작...');
  
  try {
    const client = await pool.connect();
    
    // 서버 데이터 백업
    const serverData = await client.query(`
      SELECT 
        id, video_id, channel_id, channel_name, video_title,
        video_description, view_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status, created_at, updated_at
      FROM unclassified_data 
      ORDER BY collection_date DESC
    `);
    
    const backupData = {
      timestamp: new Date().toISOString(),
      serverData: serverData.rows,
      totalRecords: serverData.rows.length
    };
    
    await fs.writeFile(
      `backup_server_${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(backupData, null, 2)
    );
    
    console.log(`✅ 서버 데이터 백업 완료: ${serverData.rows.length}개 레코드`);
    client.release();
    
    return backupData;
    
  } catch (error) {
    console.error('❌ 백업 실패:', error.message);
    throw error;
  }
}

// 2. 스키마 정합성 확인
async function checkSchemaConsistency() {
  console.log('🔍 스키마 정합성 확인...');
  
  try {
    const client = await pool.connect();
    
    // 서버 스키마 확인
    const schemaResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'unclassified_data'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 서버 스키마:');
    schemaResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 필수 필드 확인
    const requiredFields = ['id', 'video_id', 'collection_date', 'view_count', 'created_at', 'updated_at'];
    const serverFields = schemaResult.rows.map(row => row.column_name);
    
    const missingFields = requiredFields.filter(field => !serverFields.includes(field));
    if (missingFields.length > 0) {
      console.warn(`⚠️  누락된 필수 필드: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ 필수 필드 모두 존재');
    }
    
    client.release();
    return { schema: schemaResult.rows, missingFields };
    
  } catch (error) {
    console.error('❌ 스키마 확인 실패:', error.message);
    throw error;
  }
}

// 3. 동기화 큐 테이블 생성
async function setupSyncInfrastructure() {
  console.log('🔧 동기화 인프라 구축...');
  
  try {
    const client = await pool.connect();
    
    // 동기화 큐 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id SERIAL PRIMARY KEY,
        operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
        table_name VARCHAR(50) NOT NULL,
        record_id VARCHAR(255) NOT NULL,
        payload JSONB,
        client_version VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'processing', 'completed', 'failed'
      )
    `);
    
    // 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status 
      ON sync_queue(status, created_at)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_record 
      ON sync_queue(table_name, record_id)
    `);
    
    // 동기화 메타데이터 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(255) UNIQUE NOT NULL,
        last_sync_at TIMESTAMP,
        server_version VARCHAR(50),
        client_version VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ 동기화 인프라 구축 완료');
    client.release();
    
  } catch (error) {
    console.error('❌ 동기화 인프라 구축 실패:', error.message);
    throw error;
  }
}

// 4. 초기 동기화 데이터 준비
async function prepareInitialSync() {
  console.log('📦 초기 동기화 데이터 준비...');
  
  try {
    const client = await pool.connect();
    
    // 서버 데이터를 IndexedDB 형식으로 변환
    const result = await client.query(`
      SELECT 
        id, video_id, channel_id, channel_name, video_title,
        video_description, view_count, upload_date, collection_date,
        thumbnail_url, category, sub_category, status, created_at, updated_at,
        TO_CHAR(collection_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') as day_key_local
      FROM unclassified_data 
      ORDER BY collection_date DESC
    `);
    
    // IndexedDB용 데이터 형식으로 변환
    const indexedDBData = result.rows.map(row => ({
      id: row.id,
      videoId: row.video_id,
      channelId: row.channel_id,
      channelName: row.channel_name,
      videoTitle: row.video_title,
      videoDescription: row.video_description,
      viewCount: row.view_count,
      uploadDate: row.upload_date,
      collectionDate: row.collection_date,
      dayKeyLocal: row.day_key_local,
      thumbnailUrl: row.thumbnail_url,
      category: row.category || '',
      subCategory: row.sub_category || '',
      status: row.status || 'unclassified',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: 'server'
    }));
    
    // 분류별 그룹화
    const groupedData = indexedDBData.reduce((acc, item) => {
      const dayKey = item.dayKeyLocal || item.collectionDate?.split('T')[0] || 'unknown';
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(item);
      return acc;
    }, {});
    
    console.log(`✅ 동기화 데이터 준비 완료: ${indexedDBData.length}개 레코드, ${Object.keys(groupedData).length}개 일자`);
    
    // 파일로 저장
    await fs.writeFile(
      'sync_data_initial.json',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalRecords: indexedDBData.length,
        groupedData,
        flatData: indexedDBData
      }, null, 2)
    );
    
    client.release();
    return { groupedData, flatData: indexedDBData };
    
  } catch (error) {
    console.error('❌ 초기 동기화 데이터 준비 실패:', error.message);
    throw error;
  }
}

// 메인 실행
async function main() {
  console.log('🚀 하이브리드 동기화 설정 시작');
  
  try {
    // 1. 현재 상태 백업
    await backupCurrentState();
    
    // 2. 스키마 정합성 확인
    const schemaCheck = await checkSchemaConsistency();
    
    // 3. 동기화 인프라 구축
    await setupSyncInfrastructure();
    
    // 4. 초기 동기화 데이터 준비
    const syncData = await prepareInitialSync();
    
    console.log('✅ 하이브리드 동기화 설정 완료');
    console.log(`📊 결과:`);
    console.log(`   - 서버 데이터: ${syncData.flatData.length}개 레코드`);
    console.log(`   - 일자별 그룹: ${Object.keys(syncData.groupedData).length}개`);
    console.log(`   - 스키마 필드: ${schemaCheck.schema.length}개`);
    
  } catch (error) {
    console.error('❌ 하이브리드 동기화 설정 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
