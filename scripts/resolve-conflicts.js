// 충돌 자동 해소 스크립트
import fs from 'fs';
import path from 'path';
import config from './hybrid-sync-config.js';

const EXPORT_DIR = config.EXPORT_DIR;

console.log('🔧 충돌 자동 해소 시작...');

// 충돌 해소 정책
const RESOLUTION_POLICIES = {
  // 조회수/좋아요는 최대값 유지
  viewCount: (server, local) => Math.max(server || 0, local || 0),
  likeCount: (server, local) => Math.max(server || 0, local || 0),
  
  // 수동 분류 필드는 로컬 우선 (사용자가 직접 설정한 값)
  category: (server, local) => local || server,
  subCategory: (server, local) => local || server,
  status: (server, local) => local || server,
  
  // 메타데이터는 서버 우선 (정본)
  videoTitle: (server, local) => server || local,
  videoDescription: (server, local) => server || local,
  channelName: (server, local) => server || local,
  thumbnailUrl: (server, local) => server || local,
  
  // 날짜는 최신값
  updatedAt: (server, local) => {
    const serverTime = server ? new Date(server).getTime() : 0;
    const localTime = local ? new Date(local).getTime() : 0;
    return serverTime > localTime ? server : local;
  }
};

// 충돌 해소 함수
function resolveConflict(serverItem, localItem) {
  const resolved = { ...serverItem };
  
  // 각 필드별로 충돌 해소 정책 적용
  for (const [field, policy] of Object.entries(RESOLUTION_POLICIES)) {
    const serverValue = serverItem[field];
    const localValue = localItem[field];
    
    if (serverValue !== undefined && localValue !== undefined && serverValue !== localValue) {
      resolved[field] = policy(serverValue, localValue);
    } else if (localValue !== undefined) {
      resolved[field] = localValue;
    }
  }
  
  // 해소된 항목에 메타데이터 추가
  resolved._resolved = true;
  resolved._resolutionTime = new Date().toISOString();
  resolved._originalServer = serverItem;
  resolved._originalLocal = localItem;
  
  return resolved;
}

// 일치성 보고서 로드
function loadConsistencyReport() {
  try {
    const reportFile = path.join(EXPORT_DIR, 'consistency_report.json');
    if (!fs.existsSync(reportFile)) {
      console.log('⚠️ 일치성 보고서가 없습니다:', reportFile);
      return null;
    }
    
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    console.log(`📥 일치성 보고서 로드: ${report.conflicts?.length || 0}개 충돌`);
    return report;
  } catch (error) {
    console.error('❌ 일치성 보고서 로드 실패:', error.message);
    return null;
  }
}

// 충돌 해소 실행
function resolveConflicts(report) {
  if (!report || !report.conflicts || report.conflicts.length === 0) {
    console.log('✅ 해결할 충돌이 없습니다.');
    return [];
  }
  
  console.log(`🔧 ${report.conflicts.length}개 충돌 해소 중...`);
  
  const resolvedChanges = [];
  
  for (const conflict of report.conflicts) {
    try {
      const resolved = resolveConflict(conflict.serverItem, conflict.localItem);
      resolvedChanges.push({
        operation: 'update',
        tableName: 'unclassified_data',
        recordId: conflict.key,
        payload: resolved,
        clientVersion: Date.now(),
        _resolution: {
          conflictType: conflict.conflictType,
          resolvedAt: new Date().toISOString(),
          policies: Object.keys(RESOLUTION_POLICIES)
        }
      });
    } catch (error) {
      console.error(`❌ 충돌 해소 실패 (${conflict.key}):`, error.message);
    }
  }
  
  console.log(`✅ ${resolvedChanges.length}개 충돌 해소 완료`);
  return resolvedChanges;
}

// 해소 결과 분석
function analyzeResolution(resolvedChanges) {
  const analysis = {
    totalResolved: resolvedChanges.length,
    fieldResolutions: {},
    policyUsage: {}
  };
  
  for (const change of resolvedChanges) {
    const resolution = change._resolution;
    
    // 필드별 해소 통계
    for (const field of resolution.policies) {
      if (!analysis.fieldResolutions[field]) {
        analysis.fieldResolutions[field] = 0;
      }
      analysis.fieldResolutions[field]++;
    }
  }
  
  return analysis;
}

// 메인 실행
async function main() {
  console.log('🚀 충돌 자동 해소 실행...');
  
  // 일치성 보고서 로드
  const report = loadConsistencyReport();
  if (!report) {
    console.log('⚠️ 일치성 보고서를 찾을 수 없습니다. 먼저 키 기준 검증을 실행하세요.');
    return;
  }
  
  // 충돌 해소 실행
  const resolvedChanges = resolveConflicts(report);
  
  if (resolvedChanges.length === 0) {
    console.log('✅ 해결할 충돌이 없습니다.');
    return;
  }
  
  // 해소 결과 분석
  const analysis = analyzeResolution(resolvedChanges);
  
  // 결과 저장
  const resolvedFile = path.join(EXPORT_DIR, 'resolved_changes.json');
  fs.writeFileSync(resolvedFile, JSON.stringify(resolvedChanges, null, 2));
  
  // 분석 결과 저장
  const analysisFile = path.join(EXPORT_DIR, 'resolution_analysis.json');
  fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
  
  // 결과 출력
  console.log('');
  console.log('📊 해소 결과:');
  console.log(`  총 해소된 충돌: ${analysis.totalResolved}개`);
  console.log(`  필드별 해소:`);
  
  for (const [field, count] of Object.entries(analysis.fieldResolutions)) {
    console.log(`    ${field}: ${count}회`);
  }
  
  console.log('');
  console.log(`✅ 해소 완료: ${resolvedFile}`);
  console.log(`📊 분석 결과: ${analysisFile}`);
  
  // 해소된 변경사항 미리보기
  if (resolvedChanges.length > 0) {
    console.log('');
    console.log('🔍 해소된 변경사항 미리보기:');
    resolvedChanges.slice(0, 3).forEach((change, index) => {
      console.log(`  ${index + 1}. ${change.recordId}`);
      console.log(`     조회수: ${change.payload.viewCount || 'N/A'}`);
      console.log(`     카테고리: ${change.payload.category || 'N/A'}`);
      console.log(`     상태: ${change.payload.status || 'N/A'}`);
    });
    
    if (resolvedChanges.length > 3) {
      console.log(`  ... 및 ${resolvedChanges.length - 3}개 더`);
    }
  }
}

main().catch(console.error);
