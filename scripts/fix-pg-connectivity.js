#!/usr/bin/env node

/**
 * PostgreSQL 연결 복구 스크립트
 * - ENV 정합성 점검 및 수정
 * - 포트/방화벽 연결 확인
 * - SSL 설정 통일
 */

import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const args = process.argv.slice(2);
const target = args.find(arg => arg.startsWith('--target='))?.split('=')[1] || 'railway';
const sslmode = args.find(arg => arg.startsWith('--sslmode='))?.split('=')[1] || 'disable';

console.log('🔧 PostgreSQL 연결 복구 시작');
console.log(`📋 설정: target=${target}, sslmode=${sslmode}`);

async function fixEnvironmentVariables() {
  console.log('🔍 1단계: 환경변수 정합성 점검');
  
  const currentUrl = process.env.DATABASE_URL;
  console.log(`현재 DATABASE_URL: ${currentUrl ? '설정됨' : '미설정'}`);
  
  if (target === 'railway') {
    // Railway 연결을 위한 DATABASE_URL 설정
    const railwayUrl = 'postgresql://postgres:BlGEBWGugDMYSVxHZXgXKOEoWpmXjyhy@api.youthbepulse.com:5432/railway';
    const finalUrl = sslmode === 'disable' 
      ? `${railwayUrl}?sslmode=disable`
      : `${railwayUrl}?sslmode=require`;
    
    process.env.DATABASE_URL = finalUrl;
    console.log(`✅ Railway DATABASE_URL 설정: ${finalUrl.replace(/:[^:]*@/, ':***@')}`);
  } else if (target === 'local') {
    // 로컬 연결을 위한 DATABASE_URL 설정
    const localUrl = 'postgresql://postgres:password@localhost:5432/youtubepulse';
    const finalUrl = sslmode === 'disable' 
      ? `${localUrl}?sslmode=disable`
      : `${localUrl}?sslmode=require`;
    
    process.env.DATABASE_URL = finalUrl;
    console.log(`✅ 로컬 DATABASE_URL 설정: ${finalUrl.replace(/:[^:]*@/, ':***@')}`);
  }
  
  // 중복 환경변수 정리
  const conflictingVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
  conflictingVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`🧹 중복 환경변수 제거: ${varName}`);
      delete process.env[varName];
    }
  });
}

async function checkPortConnectivity() {
  console.log('🔍 2단계: 포트 연결 확인');
  
  if (target === 'railway') {
    try {
      console.log('🌐 Railway 서버 연결 테스트...');
      const { stdout } = await execAsync('nslookup api.youthbepulse.com');
      console.log('✅ DNS 해석 성공');
      
      // 포트 연결 테스트 (PowerShell)
      try {
        const { stdout: testResult } = await execAsync('Test-NetConnection -ComputerName api.youthbepulse.com -Port 5432 -InformationLevel Quiet');
        if (testResult.trim() === 'True') {
          console.log('✅ Railway 포트 5432 연결 성공');
        } else {
          console.log('❌ Railway 포트 5432 연결 실패');
        }
      } catch (error) {
        console.log('⚠️ 포트 연결 테스트 실패 (방화벽/네트워크 정책)');
      }
    } catch (error) {
      console.log('❌ Railway 서버 DNS 해석 실패');
    }
  } else if (target === 'local') {
    try {
      console.log('🏠 로컬 PostgreSQL 서비스 확인...');
      const { stdout } = await execAsync('Get-Service -Name postgresql* -ErrorAction SilentlyContinue');
      if (stdout.includes('postgresql')) {
        console.log('✅ 로컬 PostgreSQL 서비스 실행 중');
      } else {
        console.log('❌ 로컬 PostgreSQL 서비스 미실행');
        console.log('💡 해결방법: PostgreSQL 설치 및 서비스 시작 필요');
      }
    } catch (error) {
      console.log('❌ 로컬 PostgreSQL 서비스 확인 실패');
    }
  }
}

async function testDatabaseConnection() {
  console.log('🔍 3단계: 데이터베이스 연결 테스트');
  
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslmode === 'require' ? { rejectUnauthorized: false } : false,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000
    });
    
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 간단한 쿼리 테스트
    const result = await client.query('SELECT 1 as test');
    console.log('✅ 쿼리 실행 성공:', result.rows[0]);
    
    client.release();
    await pool.end();
    
    console.log('✅ PostgreSQL 연결 복구 완료');
    return true;
  } catch (error) {
    console.log('❌ 데이터베이스 연결 실패:', error.message);
    console.log('💡 해결방법:');
    console.log('   - Railway: 서버 재배포 또는 DATABASE_URL 확인');
    console.log('   - 로컬: PostgreSQL 설치 및 서비스 시작');
    return false;
  }
}

async function main() {
  try {
    await fixEnvironmentVariables();
    await checkPortConnectivity();
    const success = await testDatabaseConnection();
    
    if (success) {
      console.log('🎉 PostgreSQL 연결 복구 성공!');
      process.exit(0);
    } else {
      console.log('❌ PostgreSQL 연결 복구 실패');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ 복구 과정에서 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
