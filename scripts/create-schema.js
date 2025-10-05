#!/usr/bin/env node

/**
 * PostgreSQL 스키마 생성 스크립트
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createSchema() {
  console.log('🔧 PostgreSQL 스키마 생성 시작');
  
  try {
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // unclassified_data 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS unclassified_data (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(255) NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        description TEXT,
        video_id VARCHAR(255) NOT NULL,
        video_title TEXT NOT NULL,
        video_description TEXT,
        view_count INTEGER DEFAULT 0,
        upload_date DATE,
        collection_date DATE NOT NULL,
        thumbnail_url TEXT,
        category VARCHAR(100),
        sub_category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'unclassified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, collection_date)
      )
    `);
    console.log('✅ unclassified_data 테이블 생성 완료');
    
    // classified_data 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS classified_data (
        id SERIAL PRIMARY KEY,
        channel_id VARCHAR(255) NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        description TEXT,
        video_id VARCHAR(255) NOT NULL,
        video_title TEXT NOT NULL,
        video_description TEXT,
        view_count INTEGER DEFAULT 0,
        upload_date DATE,
        collection_date DATE NOT NULL,
        thumbnail_url TEXT,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'classified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ classified_data 테이블 생성 완료');
    
    // 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_unclassified_video_id ON unclassified_data(video_id);
      CREATE INDEX IF NOT EXISTS idx_unclassified_collection_date ON unclassified_data(collection_date);
      CREATE INDEX IF NOT EXISTS idx_classified_video_id ON classified_data(video_id);
      CREATE INDEX IF NOT EXISTS idx_classified_collection_date ON classified_data(collection_date);
    `);
    console.log('✅ 인덱스 생성 완료');
    
    client.release();
    console.log('🎉 스키마 생성 완료');
    
  } catch (error) {
    console.error('❌ 스키마 생성 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSchema();
