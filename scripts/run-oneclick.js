// Node.js 환경에서 실행할 원클릭 통합 스크립트
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import config from './hybrid-sync-config.js';

const API_BASE = config.API_BASE;
const SINCE_TS = config.SINCE_TS;

console.log('🚀 YouTube Pulse 하이브리드 시스템 원클릭 통합 실행...');

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

// 1단계: 서버→로컬 증분 다운로드
async function step1_downloadFromServer() {
  console.log('📡 서버→로컬 증분 다운로드...');
  
  const response = await fetch(`${API_BASE}/api/sync/download?since=${encodeURIComponent(SINCE_TS)}`);
  if (!response.ok) {
    throw new Error(`서버 다운로드 실패: ${response.status}`);
  }
  
  const serverData = await response.json();
  const serverFile = path.join('.tmp', 'server_since.json');
  fs.writeFileSync(serverFile, JSON.stringify(serverData, null, 2));
  
  const count = Array.isArray(serverData) ? serverData.length : serverData.data?.length || 0;
  console.log(`📥 서버 데이터 저장: ${count}개 항목`);
  
  return { serverData, count };
}

// 2단계: 로컬 스냅샷 생성
async function step2_createLocalSnapshot() {
  console.log('📱 로컬 스냅샷 생성...');
  
  const localFile = path.join('.tmp', 'local_snapshot.json');
  if (!fs.existsSync(localFile)) {
    fs.writeFileSync(localFile, JSON.stringify([]));
    console.log('⚠️ 로컬 스냅샷이 없습니다. 빈 배열로 생성합니다.');
    return { count: 0 };
  }
  
  const localData = JSON.parse(fs.readFileSync(localFile, 'utf8'));
  const count = Array.isArray(localData) ? localData.length : 0;
  console.log(`📥 로컬 스냅샷 로드: ${count}개 항목`);
  
  return { localData, count };
}

// 3단계: 키 기준 일치 검증
async function step3_verifyKeys() {
  console.log('🔍 키 기준 일치 검증...');
  
  try {
    execSync('node scripts/verify-key-consistency.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 키 기준 검증 실패:', error.message);
    return false;
  }
}

// 4단계: 충돌 자동 해소
async function step4_resolveConflicts() {
  console.log('🔧 충돌 자동 해소...');
  
  try {
    execSync('node scripts/resolve-conflicts.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 충돌 해소 실패:', error.message);
    return false;
  }
}

// 5단계: 로컬 중복 압축/청소
async function step5_cleanupIndexedDB() {
  console.log('🗜️ 로컬 중복 압축/청소...');
  
  try {
    execSync('node scripts/cleanup-indexeddb.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 로컬 압축/청소 실패:', error.message);
    return false;
  }
}

// 6단계: 로컬→서버 업서트
async function step6_uploadToServer() {
  console.log('📤 로컬→서버 업서트...');
  
  const resolvedFile = path.join('.tmp', 'resolved_changes.json');
  if (!fs.existsSync(resolvedFile) || fs.statSync(resolvedFile).size <= 2) {
    console.log('⚠️ 해소된 변경사항이 없습니다.');
    return { uploaded: 0 };
  }
  
  const resolvedData = JSON.parse(fs.readFileSync(resolvedFile, 'utf8'));
  
  try {
    const response = await fetch(`${API_BASE}/api/sync/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolvedData)
    });
    
    if (response.ok) {
      const result = await response.json();
      const uploadFile = path.join('.tmp', 'upload_result.json');
      fs.writeFileSync(uploadFile, JSON.stringify(result, null, 2));
      console.log('✅ 해소된 변경사항 업로드 완료');
      return result;
    } else {
      console.log('⚠️ 업로드 실패:', response.status);
      return { uploaded: 0 };
    }
  } catch (error) {
    console.log('⚠️ 업로드 실패:', error.message);
    return { uploaded: 0 };
  }
}

// 7단계: 서버 멱등 복원/검증
async function step7_idempotentRestore() {
  console.log('🔄 서버 멱등 복원/검증...');
  
  try {
    execSync('node scripts/run-idempotent-restore.js', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log('⚠️ 서버 멱등 복원 실패:', error.message);
    return false;
  }
}

// 결과 리포트 생성
function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    steps: {
      download: results.step1?.count || 0,
      localSnapshot: results.step2?.count || 0,
      keyVerification: results.step3,
      conflictResolution: results.step4,
      indexeddbCleanup: results.step5,
      upload: results.step6?.uploaded || 0,
      idempotentRestore: results.step7
    },
    summary: {
      totalSteps: 7,
      completedSteps: Object.values(results).filter(Boolean).length,
      successRate: 0
    }
  };
  
  report.summary.successRate = `${(report.summary.completedSteps / report.summary.totalSteps * 100).toFixed(2)}%`;
  
  const reportFile = path.join('.tmp', 'oneclick_report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  return { report, reportFile };
}

// 메인 실행
async function main() {
  console.log('🚀 하이브리드 시스템 원클릭 통합 실행 시작...');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log(`⏰ Since: ${SINCE_TS}`);
  
  const results = {};
  
  try {
    // 1단계: 서버→로컬 증분 다운로드
    results.step1 = await runStep('1/7 서버→로컬 증분 다운로드', step1_downloadFromServer);
    
    // 2단계: 로컬 스냅샷 생성
    results.step2 = await runStep('2/7 로컬 스냅샷 생성', step2_createLocalSnapshot);
    
    // 3단계: 키 기준 일치 검증
    results.step3 = await runStep('3/7 키 기준 일치 검증', step3_verifyKeys);
    
    // 4단계: 충돌 자동 해소
    results.step4 = await runStep('4/7 충돌 자동 해소', step4_resolveConflicts);
    
    // 5단계: 로컬 중복 압축/청소
    results.step5 = await runStep('5/7 로컬 중복 압축/청소', step5_cleanupIndexedDB);
    
    // 6단계: 로컬→서버 업서트
    results.step6 = await runStep('6/7 로컬→서버 업서트', step6_uploadToServer);
    
    // 7단계: 서버 멱등 복원/검증
    results.step7 = await runStep('7/7 서버 멱등 복원/검증', step7_idempotentRestore);
    
    // 결과 리포트 생성
    const { report, reportFile } = generateReport(results);
    
    console.log('\n🎉 하이브리드 시스템 원클릭 통합 실행 완료!');
    console.log('\n📊 실행 결과:');
    console.log(`  ✅ 서버 데이터: ${report.steps.download}개 항목`);
    console.log(`  ✅ 로컬 스냅샷: ${report.steps.localSnapshot}개 항목`);
    console.log(`  ✅ 키 기준 검증: ${report.steps.keyVerification ? '성공' : '실패'}`);
    console.log(`  ✅ 충돌 해소: ${report.steps.conflictResolution ? '성공' : '실패'}`);
    console.log(`  ✅ IndexedDB 압축: ${report.steps.indexeddbCleanup ? '성공' : '실패'}`);
    console.log(`  ✅ 서버 업로드: ${report.steps.upload}개 항목`);
    console.log(`  ✅ 멱등 복원: ${report.steps.idempotentRestore ? '성공' : '실패'}`);
    console.log(`  ✅ 성공률: ${report.summary.successRate}`);
    
    console.log('\n📁 생성된 파일들:');
    const files = fs.readdirSync('.tmp');
    files.forEach(file => {
      const filePath = path.join('.tmp', file);
      const stats = fs.statSync(filePath);
      console.log(`  📄 ${file} (${stats.size} bytes)`);
    });
    
    console.log(`\n📄 상세 리포트: ${reportFile}`);
    
  } catch (error) {
    console.error('\n💥 하이브리드 시스템 실행 실패:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
