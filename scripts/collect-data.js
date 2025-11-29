#!/usr/bin/env node

/**
 * YouTube Pulse 자동 데이터 수집 스크립트
 * GitHub Actions에서 매일 자정에 실행
 */

import { collectDailyData } from '../src/lib/youtube-api-service.js';
import { Pool } from 'pg';
import { createPostgreSQLService } from '../src/lib/postgresql-service-server.js';

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

// 서버용 PostgreSQL 서비스 생성
const postgresqlService = createPostgreSQLService(pool);

console.log('🚀 YouTube Pulse 자동 데이터 수집 시작...');
console.log(`⏰ 실행 시간: ${new Date().toLocaleString('ko-KR')}`);

try {
  // 데이터 수집 실행
  console.log('📥 YouTube 데이터 수집 중...');
  // collectDailyData는 수집 결과만 반환하도록 가정
  const result = await collectDailyData();
  
  // 💾 PostgreSQL에 직접 저장 (기준 데이터에 Write)
  console.log('💾 PostgreSQL에 저장 중...');

  // ✅ 추가: PostgreSQL 서비스의 저장 함수 호출 (save* 함수가 복수형 데이터를 받도록 가정)
  await postgresqlService.saveChannels(Object.values(result.channels));
  await postgresqlService.saveVideos(Object.values(result.videos));
  // await postgresqlService.saveDailyStats(Object.values(result.dailyStats)); // saveDailyStats 함수가 필요시 추가
  // await postgresqlService.saveTrendingData(Object.values(result.trendingData)); // trendingData도 필요시 추가
  
  console.log('💾 PostgreSQL에 저장 완료');
  
  // ✅ 추가: 14일 지난 데이터 삭제 (청소)
  try {
    console.log('🧹 오래된 데이터 정리 중...');
    await postgresqlService.cleanupOldData(14); 
  } catch (cleanupError) {
    console.warn('⚠️ 데이터 정리 실패 (수집은 성공):', cleanupError);
  }
  
  console.log('✅ 데이터 수집 완료!');
  console.log(`📈 수집 결과:`);
  console.log(`   - 새 채널: ${result.newChannels}개`);
  console.log(`   - 새 비디오: ${result.newVideos}개`);
  console.log(`   - 일별 통계: ${result.newDailyStats}개`);
  
  // 수집 완료 시간 저장
  const completionTime = new Date().toISOString();
  console.log(`⏰ 완료 시간: ${completionTime}`);
  
  console.log('✅ 9시 자동 수집 및 정리 완료!');
  
  await pool.end();
  process.exit(0);
  
} catch (error) {
  console.error('❌ 데이터 수집 실패:', error);
  await pool.end();
  process.exit(1);
}






