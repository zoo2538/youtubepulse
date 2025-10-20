#!/usr/bin/env node

// Railway 배포용 최적화된 서버 시작 스크립트
console.log('🚀 Railway 서버 시작 중...');

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

// 서버 시작
try {
  require('./dist/server/index.js');
  console.log('✅ 서버 시작 성공');
} catch (error) {
  console.error('❌ 서버 시작 실패:', error);
  process.exit(1);
}
