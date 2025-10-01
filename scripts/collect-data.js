#!/usr/bin/env node

/**
 * YouTube Pulse 자동 데이터 수집 스크립트
 * GitHub Actions에서 매일 자정에 실행
 */

// import { collectDailyData } from '../src/lib/youtube-api-service.ts';
// import { initializeDatabase, saveToDatabase } from '../src/lib/database-schema.ts';

console.log('🚀 YouTube Pulse 자동 데이터 수집 시작...');
console.log(`⏰ 실행 시간: ${new Date().toLocaleString('ko-KR')}`);

try {
  console.log('⚠️ collect-data.js 스크립트는 현재 비활성화됨');
  console.log('📡 자동 수집은 서버 내부 함수로 처리됩니다');
  console.log('🔗 API 엔드포인트: /api/auto-collect');
  
  // 수집 완료 시간 저장
  const completionTime = new Date().toISOString();
  console.log(`⏰ 완료 시간: ${completionTime}`);
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ 데이터 수집 실패:', error);
  process.exit(1);
}






