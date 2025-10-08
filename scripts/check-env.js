#!/usr/bin/env node
/**
 * Railway DATABASE_URL 진단 스크립트
 * 실행: node scripts/check-env.js
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'VITE_YOUTUBE_API_KEY',
  'NODE_ENV'
];

console.log('🔍 ENV 진단 시작...\n');

// 1. 필수 환경변수 확인
console.log('📋 필수 환경변수 확인:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: 설정되지 않음`);
  }
});

// 2. DATABASE_URL 상세 분석
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  console.log('\n🔗 DATABASE_URL 분석:');
  
  try {
    const url = new URL(databaseUrl);
    console.log(`✅ 프로토콜: ${url.protocol}`);
    console.log(`✅ 호스트: ${url.hostname}`);
    console.log(`✅ 포트: ${url.port || '기본값'}`);
    console.log(`✅ 데이터베이스: ${url.pathname.slice(1)}`);
    
    // SSL 파라미터 확인
    const params = url.searchParams;
    const sslMode = params.get('sslmode');
    console.log(`🔒 SSL 모드: ${sslMode || '미설정'}`);
    
    if (!sslMode || sslMode !== 'require') {
      console.log('⚠️  SSL 모드가 require로 설정되지 않음. Railway에서는 require 권장');
      console.log('💡 수정 방법: DATABASE_URL에 ?sslmode=require 추가');
    }
    
    // 연결 타임아웃 확인
    const connectTimeout = params.get('connect_timeout');
    console.log(`⏱️  연결 타임아웃: ${connectTimeout || '미설정'}`);
    
  } catch (error) {
    console.log('❌ DATABASE_URL 파싱 실패:', error.message);
  }
} else {
  console.log('\n❌ DATABASE_URL이 설정되지 않음');
}

// 3. Railway 환경 확인
console.log('\n🚂 Railway 환경 확인:');
console.log(`✅ RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || '로컬'}`);
console.log(`✅ RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME || '미설정'}`);
console.log(`✅ RAILWAY_PROJECT_ID: ${process.env.RAILWAY_PROJECT_ID || '미설정'}`);

// 4. 권장사항 출력
console.log('\n📝 권장사항:');
console.log('1. Railway 대시보드에서 DATABASE_URL 확인');
console.log('2. 자동수집 워커와 서버 프로세스 모두에 동일한 DATABASE_URL 설정');
console.log('3. DATABASE_URL에 ?sslmode=require&connect_timeout=30 추가 고려');
console.log('4. 환경변수 변경 후 서비스 재시작 필요');

console.log('\n✅ ENV 진단 완료');
