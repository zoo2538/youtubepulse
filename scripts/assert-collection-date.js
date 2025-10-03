#!/usr/bin/env node

/**
 * 수집 날짜 규칙 검증 도구
 * collectionDate=today 규칙 위반을 검사하여 회귀 방지
 */

import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 명령행 인수 파싱
const args = process.argv.slice(2);
const targetDate = args.find(arg => arg.startsWith('--date='))?.split('=')[1] || new Date().toISOString().split('T')[0];
const expectMode = args.find(arg => arg.startsWith('--expect='))?.split('=')[1] || 'today-only';

console.log('🔍 수집 날짜 규칙 검증 시작');
console.log(`📋 설정: date=${targetDate}, expect=${expectMode}`);

// PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * 날짜별 데이터 통계 조회
 */
async function getDateStatistics() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        collection_date,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status = 'classified' THEN 1 END) as classified_count,
        COUNT(CASE WHEN status = 'unclassified' THEN 1 END) as unclassified_count,
        AVG(view_count) as avg_views,
        MAX(view_count) as max_views,
        MIN(view_count) as min_views
      FROM unclassified_data 
      WHERE collection_date >= $1
      GROUP BY collection_date
      ORDER BY collection_date DESC
    `, [targetDate]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * 오늘 날짜 외 데이터 증가 검사
 */
async function checkOtherDateIncreases(targetDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        collection_date,
        COUNT(*) as count,
        COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY collection_date) as increase
      FROM unclassified_data 
      WHERE collection_date < $1
      GROUP BY collection_date
      ORDER BY collection_date DESC
      LIMIT 7
    `, [targetDate]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * 중복 데이터 검사
 */
async function checkDuplicates(targetDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        video_id,
        collection_date,
        COUNT(*) as duplicate_count
      FROM unclassified_data 
      WHERE collection_date = $1
      GROUP BY video_id, collection_date
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `, [targetDate]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * 메인 검증 로직
 */
async function validateCollectionDateRules() {
  try {
    console.log('🔍 1단계: 날짜별 데이터 통계 조회');
    const dateStats = await getDateStatistics();
    
    console.log('\n📊 날짜별 데이터 통계:');
    dateStats.forEach(stat => {
      console.log(`   ${stat.collection_date}: ${stat.total_count}개 (분류: ${stat.classified_count}, 미분류: ${stat.unclassified_count})`);
      console.log(`     조회수: 평균 ${Math.round(stat.avg_views).toLocaleString()}회, 최대 ${stat.max_views.toLocaleString()}회`);
    });
    
    console.log('\n🔍 2단계: 다른 날짜 데이터 증가 검사');
    const otherDateStats = await checkOtherDateIncreases(targetDate);
    
    let otherDateIncreases = 0;
    otherDateStats.forEach(stat => {
      if (stat.increase > 0) {
        console.log(`⚠️ ${stat.collection_date}: ${stat.increase}개 증가 (규칙 위반!)`);
        otherDateIncreases += stat.increase;
      } else {
        console.log(`✅ ${stat.collection_date}: 변화 없음`);
      }
    });
    
    console.log('\n🔍 3단계: 중복 데이터 검사');
    const duplicates = await checkDuplicates(targetDate);
    
    if (duplicates.length > 0) {
      console.log(`⚠️ 중복 데이터 발견: ${duplicates.length}개 그룹`);
      duplicates.forEach(dup => {
        console.log(`   - ${dup.video_id} (${dup.collection_date}): ${dup.duplicate_count}개 중복`);
      });
    } else {
      console.log('✅ 중복 데이터 없음');
    }
    
    console.log('\n🔍 4단계: 규칙 검증 결과');
    
    // 규칙 1: 다른 날짜 데이터 증가 검사
    if (otherDateIncreases > 0) {
      console.log(`❌ 규칙 위반: 다른 날짜 데이터가 ${otherDateIncreases}개 증가`);
      console.log('   → 다른 날짜의 데이터는 절대 건드리지 않아야 함');
      return false;
    } else {
      console.log('✅ 규칙 준수: 다른 날짜 데이터 변화 없음');
    }
    
    // 규칙 2: 오늘 날짜 데이터만 증가 검사
    const todayStats = dateStats.find(stat => stat.collection_date === targetDate);
    if (todayStats) {
      console.log(`✅ 오늘 날짜 데이터: ${todayStats.total_count}개`);
    } else {
      console.log('⚠️ 오늘 날짜 데이터가 없습니다');
    }
    
    // 규칙 3: 중복 데이터 검사
    if (duplicates.length > 0) {
      console.log(`❌ 규칙 위반: 중복 데이터 ${duplicates.length}개 그룹 발견`);
      console.log('   → 같은 날짜의 같은 영상은 조회수 높은 것만 유지되어야 함');
      return false;
    } else {
      console.log('✅ 규칙 준수: 중복 데이터 없음');
    }
    
    console.log('\n✅ 모든 규칙 검증 통과!');
    return true;
    
  } catch (error) {
    console.error('❌ 검증 실패:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// 메인 실행
validateCollectionDateRules().then(success => {
  if (!success) {
    console.log('\n❌ 규칙 검증 실패 - 다음 단계로 진행할 수 없습니다');
    process.exit(1);
  } else {
    console.log('\n✅ 규칙 검증 성공 - 다음 단계로 진행 가능');
    process.exit(0);
  }
});
