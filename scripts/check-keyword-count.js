#!/usr/bin/env node

/**
 * 특정 키워드로 수집된 영상 수 조회 스크립트
 * 사용법: node scripts/check-keyword-count.js "사연"
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

const keyword = process.argv[2] || '사연';

async function checkKeywordCount() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    console.log(`🔍 "${keyword}" 키워드로 수집된 영상 조회 중...\n`);
    
    // keyword 필드로 조회
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM unclassified_data
      WHERE keyword = $1
    `, [keyword]);
    
    const totalCount = parseInt(countResult.rows[0].total);
    console.log(`📊 keyword 필드 기준: ${totalCount.toLocaleString()}개\n`);
    
    // video_title이나 video_description에 키워드가 포함된 경우도 조회
    const titleCountResult = await client.query(`
      SELECT COUNT(*) as total
      FROM unclassified_data
      WHERE (video_title ILIKE $1 OR video_description ILIKE $1)
        AND collection_type = 'auto'
    `, [`%${keyword}%`]);
    
    const titleCount = parseInt(titleCountResult.rows[0].total);
    console.log(`📊 제목/설명에 "${keyword}" 포함 (자동수집): ${titleCount.toLocaleString()}개\n`);
    
    // 전체 자동 수집 데이터 확인
    const allAutoResult = await client.query(`
      SELECT COUNT(*) as total
      FROM unclassified_data
      WHERE collection_type = 'auto'
    `);
    
    const allAutoCount = parseInt(allAutoResult.rows[0].total);
    console.log(`📊 전체 자동 수집 데이터: ${allAutoCount.toLocaleString()}개\n`);
    
    // keyword 필드가 있는 데이터 확인
    const keywordFieldResult = await client.query(`
      SELECT COUNT(*) as total
      FROM unclassified_data
      WHERE keyword IS NOT NULL AND keyword != ''
    `);
    
    const keywordFieldCount = parseInt(keywordFieldResult.rows[0].total);
    console.log(`📊 keyword 필드가 있는 데이터: ${keywordFieldCount.toLocaleString()}개\n`);
    
    // 키워드별 통계 (상위 10개)
    const keywordStatsResult = await client.query(`
      SELECT 
        keyword,
        COUNT(*) as count
      FROM unclassified_data
      WHERE keyword IS NOT NULL AND keyword != ''
      GROUP BY keyword
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (keywordStatsResult.rows.length > 0) {
      console.log('📊 키워드별 수집 현황 (상위 10개):');
      keywordStatsResult.rows.forEach(row => {
        const keywordValue = JSON.stringify(row.keyword); // 정확한 값 확인
        console.log(`  ${keywordValue}: ${parseInt(row.count).toLocaleString()}개`);
      });
    }
    
    // "사연"과 유사한 키워드 확인
    const similarKeywordResult = await client.query(`
      SELECT 
        keyword,
        COUNT(*) as count
      FROM unclassified_data
      WHERE keyword ILIKE $1
      GROUP BY keyword
      ORDER BY count DESC
    `, [`%${keyword}%`]);
    
    if (similarKeywordResult.rows.length > 0) {
      console.log(`\n📊 "${keyword}"와 유사한 키워드:`);
      similarKeywordResult.rows.forEach(row => {
        const keywordValue = JSON.stringify(row.keyword);
        console.log(`  ${keywordValue}: ${parseInt(row.count).toLocaleString()}개`);
      });
    }
    
    // 실제 "사연" 키워드 샘플 데이터 확인
    const sampleKeywordResult = await client.query(`
      SELECT 
        keyword,
        video_title,
        channel_name,
        collection_date
      FROM unclassified_data
      WHERE keyword LIKE '%사연%' OR keyword LIKE '%${keyword}%'
      LIMIT 5
    `);
    
    if (sampleKeywordResult.rows.length > 0) {
      console.log(`\n📺 "사연" 키워드 샘플 데이터:`);
      sampleKeywordResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. keyword: "${row.keyword}"`);
        console.log(`     제목: ${row.video_title}`);
        console.log(`     채널: ${row.channel_name}`);
        console.log(`     수집일: ${row.collection_date}`);
        console.log('');
      });
    }
    
    // keyword 필드로 정확히 매칭되는 경우와 TRIM 후 매칭되는 경우 모두 확인
    const exactMatchResult = await client.query(`
      SELECT COUNT(*) as total
      FROM unclassified_data
      WHERE TRIM(keyword) = $1
    `, [keyword]);
    
    const exactMatchCount = parseInt(exactMatchResult.rows[0].total);
    console.log(`📊 keyword 필드 정확 매칭 (TRIM 후): ${exactMatchCount.toLocaleString()}개\n`);
    
    if (exactMatchCount > 0 || titleCount > 0) {
      const targetCount = exactMatchCount > 0 ? exactMatchCount : titleCount;
      
      // 날짜별 통계
      const dateStats = await client.query(`
        SELECT 
          day_key_local as date,
          COUNT(*) as count
        FROM unclassified_data
        WHERE TRIM(keyword) = $1 OR (keyword IS NULL AND (video_title ILIKE $2 OR video_description ILIKE $2) AND collection_type = 'auto')
        GROUP BY day_key_local
        ORDER BY day_key_local DESC
        LIMIT 14
      `, [keyword, `%${keyword}%`]);
      
      console.log('📅 최근 14일 날짜별 수집 현황:');
      dateStats.rows.forEach(row => {
        console.log(`  ${row.date}: ${parseInt(row.count).toLocaleString()}개`);
      });
      
      console.log('\n');
      
      // 최근 수집된 영상 샘플 (5개)
      const sampleResult = await client.query(`
        SELECT 
          video_title,
          channel_name,
          view_count,
          day_key_local,
          collection_date
        FROM unclassified_data
        WHERE keyword = $1
        ORDER BY collection_date DESC, view_count DESC
        LIMIT 5
      `, [keyword]);
      
      console.log('📺 최근 수집된 영상 샘플 (상위 5개):');
      sampleResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.video_title}`);
        console.log(`     채널: ${row.channel_name}`);
        console.log(`     조회수: ${parseInt(row.view_count || 0).toLocaleString()}회`);
        console.log(`     수집일: ${row.collection_date || row.day_key_local}`);
        console.log('');
      });
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ 조회 실패:', error);
    process.exit(1);
  }
}

checkKeywordCount();

