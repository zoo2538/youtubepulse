#!/usr/bin/env node

/**
 * YouTube Pulse 자동 데이터 수집 스크립트
 * GitHub Actions에서 매일 자정에 실행
 */

import { collectDailyData } from '../src/lib/youtube-api-service.js';
import { initializeDatabase, saveToDatabase } from '../src/lib/database-schema.js';

console.log('🚀 YouTube Pulse 자동 데이터 수집 시작...');
console.log(`⏰ 실행 시간: ${new Date().toLocaleString('ko-KR')}`);

try {
  // 데이터베이스 초기화
  console.log('📊 데이터베이스 초기화 중...');
  const db = initializeDatabase();
  
  // 데이터 수집 실행
  console.log('📥 YouTube 데이터 수집 중...');
  const result = await collectDailyData(db);
  
  // 데이터베이스 저장
  console.log('💾 데이터베이스 저장 중...');
  saveToDatabase(db);
  
  console.log('✅ 데이터 수집 완료!');
  console.log(`📈 수집 결과:`);
  console.log(`   - 새 채널: ${result.newChannels}개`);
  console.log(`   - 새 비디오: ${result.newVideos}개`);
  console.log(`   - 일별 통계: ${result.newDailyStats}개`);
  
  // 수집 완료 시간 저장
  const completionTime = new Date().toISOString();
  console.log(`⏰ 완료 시간: ${completionTime}`);
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ 데이터 수집 실패:', error);
  process.exit(1);
}






