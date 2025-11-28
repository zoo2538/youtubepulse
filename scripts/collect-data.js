#!/usr/bin/env node

/**
 * YouTube Pulse 자동 데이터 수집 스크립트
 * GitHub Actions에서 매일 자정에 실행
 */

import { collectDailyData } from '../src/lib/youtube-api-service.js';
// ✅ 추가:
import { postgresqlService } from '../src/lib/postgresql-service.js'; // PostgreSQL 서비스 (가정)

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






