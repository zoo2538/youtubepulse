// 하이브리드 설정 통합 실행 스크립트
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import config from './hybrid-sync-config.js';

const EXPORT_DIR = config.EXPORT_DIR;
const API_BASE = config.API_BASE;

console.log('🚀 하이브리드 설정 통합 실행...');

// 단계별 실행 함수
async function runStep(stepName, stepFunction) {
  console.log(`\n[${stepName}] 시작...`);
  try {
    const result = await stepFunction();
    console.log(`✅ [${stepName}] 완료`);
    return result;
  } catch (error) {
    console.error(`❌ [${stepName}] 실패:`, error.message);
    throw error;
  }
}

// 1단계: 증분 동기화
async function step1_incrementalSync() {
  console.log('📡 서버↔로컬 증분 동기화...');
  
  // 서버에서 다운로드
  const serverResponse = await fetch(`${API_BASE}/api/sync/download?since=${encodeURIComponent(config.SINCE_TS)}`);
  if (!serverResponse.ok) {
    throw new Error(`서버 다운로드 실패: ${serverResponse.status}`);
  }
  const serverData = await serverResponse.json();
  
  const serverFile = path.join(EXPORT_DIR, 'server_since.json');
  fs.writeFileSync(serverFile, JSON.stringify(serverData, null, 2));
  console.log(`📥 서버 데이터 저장: ${serverData.length || 0}개 항목`);
  
  // 로컬 변경사항 업로드 (시뮬레이션)
  const localChanges = [];
  const localFile = path.join(EXPORT_DIR, 'local_changes.json');
  fs.writeFileSync(localFile, JSON.stringify(localChanges, null, 2));
  
  try {
    const uploadResponse = await fetch(`${API_BASE}/api/sync/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localChanges)
    });
    
    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      const uploadFile = path.join(EXPORT_DIR, 'upload_result.json');
      fs.writeFileSync(uploadFile, JSON.stringify(uploadResult, null, 2));
      console.log(`📤 업로드 결과 저장: ${uploadFile}`);
    } else {
      console.log('⚠️ 업로드 실패 (계속 진행)');
    }
  } catch (error) {
    console.log('⚠️ 업로드 실패:', error.message);
  }
  
  return { serverData, localChanges };
}

// 2단계: 키 기준 검증
async function step2_keyVerification() {
  console.log('🔍 키 기준 일치 검증...');
  
  try {
    execSync('node scripts/verify-key-consistency.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 키 기준 검증 실패:', error.message);
    return false;
  }
}

// 3단계: 충돌 해소
async function step3_conflictResolution() {
  console.log('🔧 충돌 자동 해소...');
  
  try {
    execSync('node scripts/resolve-conflicts.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 충돌 해소 실패:', error.message);
    return false;
  }
}

// 4단계: IndexedDB 압축
async function step4_indexeddbCompression() {
  console.log('🗜️ IndexedDB 압축/청소...');
  
  try {
    execSync('node scripts/compress-indexeddb.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ IndexedDB 압축 실패:', error.message);
    return false;
  }
}

// 5단계: 서버 멱등 복원
async function step5_idempotentRestore() {
  console.log('🔄 서버 멱등 복원...');
  
  try {
    execSync('node scripts/run-idempotent-restore.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 서버 멱등 복원 실패:', error.message);
    return false;
  }
}

// 6단계: 검증 리포트 생성
async function step6_generateReport() {
  console.log('📊 검증 리포트 생성...');
  
  const report = {
    timestamp: new Date().toISOString(),
    steps: {
      incrementalSync: true,
      keyVerification: false,
      conflictResolution: false,
      indexeddbCompression: false,
      idempotentRestore: false
    },
    files: {
      serverData: path.join(EXPORT_DIR, 'server_since.json'),
      localChanges: path.join(EXPORT_DIR, 'local_changes.json'),
      consistencyReport: path.join(EXPORT_DIR, 'consistency_report.json'),
      resolvedChanges: path.join(EXPORT_DIR, 'resolved_changes.json'),
      compressionSimulation: path.join(EXPORT_DIR, 'compression_simulation.json'),
      idempotentResult: path.join(EXPORT_DIR, 'idempotent_restore_result.json')
    },
    summary: {
      totalSteps: 6,
      completedSteps: 1,
      successRate: '16.67%'
    }
  };
  
  // 파일 존재 여부 확인
  for (const [key, filePath] of Object.entries(report.files)) {
    if (fs.existsSync(filePath)) {
      report.steps[key] = true;
    }
  }
  
  // 완료된 단계 수 계산
  const completedSteps = Object.values(report.steps).filter(Boolean).length;
  report.summary.completedSteps = completedSteps;
  report.summary.successRate = `${(completedSteps / report.summary.totalSteps * 100).toFixed(2)}%`;
  
  const reportFile = path.join(EXPORT_DIR, 'hybrid_setup_report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`📄 리포트 저장: ${reportFile}`);
  return report;
}

// 메인 실행
async function main() {
  console.log('🚀 하이브리드 설정 통합 실행 시작...');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log(`⏰ Since: ${config.SINCE_TS}`);
  
  const results = {};
  
  try {
    // 1단계: 증분 동기화
    results.step1 = await runStep('1/6 증분 동기화', step1_incrementalSync);
    
    // 2단계: 키 기준 검증
    results.step2 = await runStep('2/6 키 기준 검증', step2_keyVerification);
    
    // 3단계: 충돌 해소
    results.step3 = await runStep('3/6 충돌 해소', step3_conflictResolution);
    
    // 4단계: IndexedDB 압축
    results.step4 = await runStep('4/6 IndexedDB 압축', step4_indexeddbCompression);
    
    // 5단계: 서버 멱등 복원
    results.step5 = await runStep('5/6 서버 멱등 복원', step5_idempotentRestore);
    
    // 6단계: 검증 리포트 생성
    results.step6 = await runStep('6/6 검증 리포트 생성', step6_generateReport);
    
    console.log('\n🎉 하이브리드 설정 통합 실행 완료!');
    console.log('\n📊 실행 결과:');
    console.log(`  ✅ 증분 동기화: ${results.step1 ? '성공' : '실패'}`);
    console.log(`  ✅ 키 기준 검증: ${results.step2 ? '성공' : '실패'}`);
    console.log(`  ✅ 충돌 해소: ${results.step3 ? '성공' : '실패'}`);
    console.log(`  ✅ IndexedDB 압축: ${results.step4 ? '성공' : '실패'}`);
    console.log(`  ✅ 서버 멱등 복원: ${results.step5 ? '성공' : '실패'}`);
    console.log(`  ✅ 검증 리포트: ${results.step6 ? '성공' : '실패'}`);
    
    console.log('\n📁 생성된 파일들:');
    const files = fs.readdirSync(EXPORT_DIR);
    files.forEach(file => {
      const filePath = path.join(EXPORT_DIR, file);
      const stats = fs.statSync(filePath);
      console.log(`  📄 ${file} (${stats.size} bytes)`);
    });
    
  } catch (error) {
    console.error('\n💥 하이브리드 설정 실행 실패:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
