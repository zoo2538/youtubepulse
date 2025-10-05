// 검증 리포트 생성 스크립트
import fs from 'fs';
import path from 'path';
import config from './hybrid-sync-config.js';

const EXPORT_DIR = config.EXPORT_DIR;

console.log('📊 검증 리포트 생성...');

// 파일 로드 함수
function loadFile(filename) {
  try {
    const filePath = path.join(EXPORT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`❌ 파일 로드 실패 (${filename}):`, error.message);
    return null;
  }
}

// 서버 데이터 분석
function analyzeServerData(serverData) {
  if (!serverData || !Array.isArray(serverData)) {
    return { total: 0, categories: {}, channels: {}, status: {} };
  }
  
  const analysis = {
    total: serverData.length,
    categories: {},
    channels: {},
    status: {},
    dateRange: { min: null, max: null }
  };
  
  for (const item of serverData) {
    // 카테고리 분석
    const category = item.category || '미분류';
    analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    
    // 채널 분석
    const channel = item.channelName || item.channel_name || '알 수 없음';
    analysis.channels[channel] = (analysis.channels[channel] || 0) + 1;
    
    // 상태 분석
    const status = item.status || 'unclassified';
    analysis.status[status] = (analysis.status[status] || 0) + 1;
    
    // 날짜 범위 분석
    const date = item.collectionDate || item.collection_date;
    if (date) {
      const dateObj = new Date(date);
      if (!analysis.dateRange.min || dateObj < analysis.dateRange.min) {
        analysis.dateRange.min = dateObj;
      }
      if (!analysis.dateRange.max || dateObj > analysis.dateRange.max) {
        analysis.dateRange.max = dateObj;
      }
    }
  }
  
  return analysis;
}

// 로컬 데이터 분석
function analyzeLocalData(localData) {
  if (!localData || !Array.isArray(localData)) {
    return { total: 0, changes: 0 };
  }
  
  return {
    total: localData.length,
    changes: localData.filter(item => item.operation === 'create' || item.operation === 'update').length
  };
}

// 충돌 분석
function analyzeConflicts(conflicts) {
  if (!conflicts || !Array.isArray(conflicts)) {
    return { total: 0, types: {} };
  }
  
  const analysis = {
    total: conflicts.length,
    types: {}
  };
  
  for (const conflict of conflicts) {
    const type = conflict.conflictType || 'unknown';
    analysis.types[type] = (analysis.types[type] || 0) + 1;
  }
  
  return analysis;
}

// 압축 분석
function analyzeCompression(compressionData) {
  if (!compressionData) {
    return { before: 0, after: 0, duplicatesRemoved: 0, compressionRate: 0 };
  }
  
  return {
    before: compressionData.before || 0,
    after: compressionData.after || 0,
    duplicatesRemoved: compressionData.duplicatesRemoved || 0,
    compressionRate: compressionData.compressionRate || 0
  };
}

// 멱등 복원 분석
function analyzeIdempotentRestore(restoreData) {
  if (!restoreData) {
    return { totalProcessed: 0, inserted: 0, updated: 0 };
  }
  
  return {
    totalProcessed: restoreData.totalProcessed || 0,
    inserted: restoreData.summary?.unclassifiedInserted + restoreData.summary?.dailyStatsInserted || 0,
    updated: restoreData.summary?.unclassifiedUpdated + restoreData.summary?.dailyStatsUpdated || 0
  };
}

// 마크다운 리포트 생성
function generateMarkdownReport(analysis) {
  const timestamp = new Date().toISOString();
  
  return `# 하이브리드 동기화 검증 리포트

생성 시간: ${timestamp}

## 📊 전체 요약

- **서버 데이터**: ${analysis.server.total}개 항목
- **로컬 변경사항**: ${analysis.local.total}개 항목
- **충돌**: ${analysis.conflicts.total}개
- **압축률**: ${analysis.compression.compressionRate}%
- **멱등 복원**: ${analysis.restore.totalProcessed}개 처리

## 🔍 서버 데이터 분석

### 기본 통계
- 총 항목 수: ${analysis.server.total}개
- 날짜 범위: ${analysis.server.dateRange?.min ? analysis.server.dateRange.min.toISOString().split('T')[0] : 'N/A'} ~ ${analysis.server.dateRange?.max ? analysis.server.dateRange.max.toISOString().split('T')[0] : 'N/A'}

### 카테고리별 분포
${Object.entries(analysis.server.categories)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([category, count]) => `- ${category}: ${count}개`)
  .join('\n')}

### 채널별 분포 (상위 10개)
${Object.entries(analysis.server.channels)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([channel, count]) => `- ${channel}: ${count}개`)
  .join('\n')}

### 상태별 분포
${Object.entries(analysis.server.status)
  .map(([status, count]) => `- ${status}: ${count}개`)
  .join('\n')}

## 📱 로컬 데이터 분석

- 총 변경사항: ${analysis.local.total}개
- 실제 변경: ${analysis.local.changes}개

## ⚠️ 충돌 분석

- 총 충돌 수: ${analysis.conflicts.total}개
- 충돌 유형:
${Object.entries(analysis.conflicts.types)
  .map(([type, count]) => `  - ${type}: ${count}개`)
  .join('\n')}

## 🗜️ 압축 분석

- 압축 전: ${analysis.compression.before}개 항목
- 압축 후: ${analysis.compression.after}개 항목
- 중복 제거: ${analysis.compression.duplicatesRemoved}개
- 압축률: ${analysis.compression.compressionRate}%

## 🔄 멱등 복원 분석

- 총 처리: ${analysis.restore.totalProcessed}개 항목
- 삽입: ${analysis.restore.inserted}개
- 업데이트: ${analysis.restore.updated}개

## 📁 생성된 파일들

- 서버 데이터: \`server_since.json\`
- 로컬 변경사항: \`local_changes.json\`
- 일치성 보고서: \`consistency_report.json\`
- 해소된 변경사항: \`resolved_changes.json\`
- 압축 시뮬레이션: \`compression_simulation.json\`
- 멱등 복원 결과: \`idempotent_restore_result.json\`

## 🎯 권장사항

1. **데이터 일관성**: 서버와 로컬 데이터 간 일치율을 정기적으로 모니터링하세요.
2. **충돌 해결**: 자동 충돌 해소 정책을 검토하고 필요시 조정하세요.
3. **압축 최적화**: IndexedDB 압축을 정기적으로 실행하여 성능을 유지하세요.
4. **백업 전략**: 멱등 복원 기능을 활용하여 안전한 백업/복원을 수행하세요.

---
*이 리포트는 하이브리드 동기화 시스템에 의해 자동 생성되었습니다.*
`;
}

// 메인 실행
async function main() {
  console.log('🚀 검증 리포트 생성 시작...');
  
  // 데이터 로드
  const serverData = loadFile('server_since.json');
  const localData = loadFile('local_changes.json');
  const consistencyReport = loadFile('consistency_report.json');
  const resolvedChanges = loadFile('resolved_changes.json');
  const compressionData = loadFile('compression_simulation.json');
  const restoreData = loadFile('idempotent_restore_result.json');
  
  // 분석 수행
  const analysis = {
    server: analyzeServerData(serverData),
    local: analyzeLocalData(localData),
    conflicts: analyzeConflicts(consistencyReport?.conflicts || []),
    compression: analyzeCompression(compressionData),
    restore: analyzeIdempotentRestore(restoreData)
  };
  
  // 마크다운 리포트 생성
  const markdownReport = generateMarkdownReport(analysis);
  
  // 리포트 저장
  const reportFile = path.join(EXPORT_DIR, 'sync_report.md');
  fs.writeFileSync(reportFile, markdownReport);
  
  // JSON 리포트도 저장
  const jsonReport = {
    timestamp: new Date().toISOString(),
    analysis,
    files: {
      serverData: serverData ? 'loaded' : 'not_found',
      localData: localData ? 'loaded' : 'not_found',
      consistencyReport: consistencyReport ? 'loaded' : 'not_found',
      resolvedChanges: resolvedChanges ? 'loaded' : 'not_found',
      compressionData: compressionData ? 'loaded' : 'not_found',
      restoreData: restoreData ? 'loaded' : 'not_found'
    }
  };
  
  const jsonReportFile = path.join(EXPORT_DIR, 'sync_report.json');
  fs.writeFileSync(jsonReportFile, JSON.stringify(jsonReport, null, 2));
  
  // 결과 출력
  console.log('✅ 검증 리포트 생성 완료');
  console.log(`📄 마크다운 리포트: ${reportFile}`);
  console.log(`📄 JSON 리포트: ${jsonReportFile}`);
  
  console.log('\n📊 리포트 요약:');
  console.log(`  서버 데이터: ${analysis.server.total}개 항목`);
  console.log(`  로컬 변경사항: ${analysis.local.total}개 항목`);
  console.log(`  충돌: ${analysis.conflicts.total}개`);
  console.log(`  압축률: ${analysis.compression.compressionRate}%`);
  console.log(`  멱등 복원: ${analysis.restore.totalProcessed}개 처리`);
  
  // 상위 카테고리 출력
  const topCategories = Object.entries(analysis.server.categories)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  if (topCategories.length > 0) {
    console.log('\n🏆 상위 카테고리:');
    topCategories.forEach(([category, count]) => {
      console.log(`  ${category}: ${count}개`);
    });
  }
}

main().catch(console.error);
