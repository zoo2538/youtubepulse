#!/usr/bin/env node

/**
 * API + DB 상태 확인 스크립트
 * - API 서버 헬스체크
 * - 데이터베이스 연결 상태 확인
 */

// import fetch from 'node-fetch'; // Node.js 18+ 내장 fetch 사용

const args = process.argv.slice(2);
const apiBase = args.find(arg => arg.startsWith('--api='))?.split('=')[1] || 'https://api.youthbepulse.com';

console.log('🔍 API + DB 상태 확인 시작');
console.log(`📋 API 베이스: ${apiBase}`);

async function checkApiHealth() {
  console.log('🔍 1단계: API 서버 헬스체크');
  
  try {
    const response = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const health = await response.json();
    console.log('✅ API 서버 응답 성공');
    console.log(`📊 상태: ${health.status}`);
    console.log(`📊 메시지: ${health.message}`);
    console.log(`📊 데이터베이스: ${health.database}`);
    console.log(`📊 풀 존재: ${health.poolExists}`);
    console.log(`📊 연결 상태: ${health.isConnected}`);
    console.log(`📊 DB URL: ${health.databaseUrl}`);
    
    if (health.database === 'Connected' && health.isConnected === true) {
      console.log('✅ 데이터베이스 연결 정상');
      return true;
    } else {
      console.log('❌ 데이터베이스 연결 실패');
      return false;
    }
  } catch (error) {
    console.log('❌ API 헬스체크 실패:', error.message);
    return false;
  }
}

async function checkDatabaseEndpoints() {
  console.log('🔍 2단계: 데이터베이스 엔드포인트 확인');
  
  const endpoints = [
    '/api/classified',
    '/api/unclassified',
    '/api/health-sql'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 테스트: ${endpoint}`);
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      if (response.ok) {
        console.log(`✅ ${endpoint} 응답 성공 (${response.status})`);
      } else {
        console.log(`⚠️ ${endpoint} 응답 실패 (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} 요청 실패:`, error.message);
    }
  }
}

async function main() {
  try {
    const apiHealthy = await checkApiHealth();
    await checkDatabaseEndpoints();
    
    if (apiHealthy) {
      console.log('🎉 API + DB 상태 확인 완료 - 정상');
      process.exit(0);
    } else {
      console.log('❌ API + DB 상태 확인 실패');
      console.log('💡 해결방법:');
      console.log('   - Railway 서버 재배포');
      console.log('   - DATABASE_URL 환경변수 확인');
      console.log('   - PostgreSQL 서비스 상태 확인');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ 확인 과정에서 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
