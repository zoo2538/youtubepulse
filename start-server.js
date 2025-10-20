#!/usr/bin/env node

// Railway 배포용 최적화된 서버 시작 스크립트 (ESM 호환)
console.log('🚀 Railway 서버 시작 중...');

import fs from 'fs';

// 메모리 사용량 모니터링
const used = process.memoryUsage();
console.log('📊 메모리 사용량:', {
  rss: Math.round(used.rss / 1024 / 1024) + ' MB',
  heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
  heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
  external: Math.round(used.external / 1024 / 1024) + ' MB'
});

// 환경 변수 확인
console.log('🔍 환경 변수 확인:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '미설정');

// 서버 시작 - 전체 서버 우선 실행
console.log('🔍 전체 서버 파일 존재 확인:', fs.existsSync('./dist/server/index.js'));
console.log('🔍 간단한 서버 파일 존재 확인:', fs.existsSync('./simple-server.js'));

try {
  console.log('🚀 전체 서버 시작 시도...');
  await import('./dist/server/index.js');
  console.log('✅ 전체 서버 시작 성공');
} catch (error) {
  console.error('❌ 전체 서버 시작 실패:', error);
  console.error('❌ 오류 상세:', error.message);
  console.error('❌ 오류 스택:', error.stack);

  // 폴백: 간단한 서버 시도
  try {
    console.log('🔄 간단한 서버로 폴백 시도...');
    await import('./simple-server.js');
    console.log('✅ 간단한 서버 시작 성공 (폴백)');
  } catch (fallbackError) {
    console.error('❌ 간단한 서버도 실패:', fallbackError);
    process.exit(1);
  }
}
