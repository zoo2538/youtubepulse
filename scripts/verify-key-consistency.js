// 키 기준 일치 검증 스크립트
import fs from 'fs';
import path from 'path';
import config from './hybrid-sync-config.js';

const EXPORT_DIR = config.EXPORT_DIR;

console.log('🔍 키 기준 일치 검증 시작...');

// 서버 데이터 로드
function loadServerData() {
  try {
    const serverFile = path.join(EXPORT_DIR, 'server_since.json');
    if (!fs.existsSync(serverFile)) {
      console.log('⚠️ 서버 데이터 파일이 없습니다:', serverFile);
      return [];
    }
    
    const rawData = JSON.parse(fs.readFileSync(serverFile, 'utf8'));
    
    // 데이터가 객체인 경우 배열로 변환
    let data = rawData;
    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
      if (rawData.data && Array.isArray(rawData.data)) {
        data = rawData.data;
      } else if (rawData.records && Array.isArray(rawData.records)) {
        data = rawData.records;
      } else {
        data = [];
      }
    }
    
    if (!Array.isArray(data)) {
      console.log('⚠️ 서버 데이터가 배열 형태가 아닙니다:', typeof data);
      return [];
    }
    
    console.log(`📥 서버 데이터 로드: ${data.length || 0}개 항목`);
    return data;
  } catch (error) {
    console.error('❌ 서버 데이터 로드 실패:', error.message);
    return [];
  }
}

// 로컬 데이터 로드 (시뮬레이션)
function loadLocalData() {
  try {
    const localFile = path.join(EXPORT_DIR, 'local_snapshot.json');
    if (!fs.existsSync(localFile)) {
      console.log('⚠️ 로컬 데이터 파일이 없습니다. 서버 데이터를 기반으로 시뮬레이션합니다.');
      return [];
    }
    
    const data = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    console.log(`📥 로컬 데이터 로드: ${data.length || 0}개 항목`);
    return data;
  } catch (error) {
    console.error('❌ 로컬 데이터 로드 실패:', error.message);
    return [];
  }
}

// 키 생성 함수
function generateKey(item) {
  const videoId = item.videoId || item.video_id;
  const dayKey = item.dayKeyLocal || item.day_key_local || 
                 (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : null);
  
  if (!videoId || !dayKey) {
    return null;
  }
  
  return `${videoId}_${dayKey}`;
}

// 데이터 해시 생성
function generateHash(item) {
  const key = generateKey(item);
  if (!key) return null;
  
  // 중요한 필드들만 포함하여 해시 생성
  const hashData = {
    videoId: item.videoId || item.video_id,
    channelName: item.channelName || item.channel_name,
    videoTitle: item.videoTitle || item.video_title,
    viewCount: item.viewCount || item.view_count,
    category: item.category,
    status: item.status,
    dayKeyLocal: item.dayKeyLocal || item.day_key_local
  };
  
  return JSON.stringify(hashData);
}

// 키 기준 그룹핑
function groupByKey(data) {
  const groups = new Map();
  
  for (const item of data) {
    const key = generateKey(item);
    if (!key) continue;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  
  return groups;
}

// 일치성 검증
function verifyConsistency(serverGroups, localGroups) {
  const report = {
    totalServerKeys: serverGroups.size,
    totalLocalKeys: localGroups.size,
    commonKeys: 0,
    serverOnlyKeys: 0,
    localOnlyKeys: 0,
    conflicts: [],
    summary: {}
  };
  
  // 공통 키 확인
  for (const [key, serverItems] of serverGroups) {
    if (localGroups.has(key)) {
      report.commonKeys++;
      const localItems = localGroups.get(key);
      
      // 충돌 검사
      const serverHash = generateHash(serverItems[0]);
      const localHash = generateHash(localItems[0]);
      
      if (serverHash !== localHash) {
        report.conflicts.push({
          key,
          serverItem: serverItems[0],
          localItem: localItems[0],
          serverHash,
          localHash,
          conflictType: 'data_mismatch'
        });
      }
    } else {
      report.serverOnlyKeys++;
    }
  }
  
  // 로컬 전용 키 확인
  for (const [key] of localGroups) {
    if (!serverGroups.has(key)) {
      report.localOnlyKeys++;
    }
  }
  
  // 요약 통계
  report.summary = {
    totalKeys: report.totalServerKeys + report.totalLocalKeys - report.commonKeys,
    conflictRate: report.conflicts.length / Math.max(report.commonKeys, 1) * 100,
    consistencyRate: (report.commonKeys - report.conflicts.length) / Math.max(report.commonKeys, 1) * 100
  };
  
  return report;
}

// 메인 실행
async function main() {
  console.log('🚀 키 기준 일치 검증 실행...');
  
  // 데이터 로드
  const serverData = loadServerData();
  const localData = loadLocalData();
  
  if (serverData.length === 0 && localData.length === 0) {
    console.log('⚠️ 검증할 데이터가 없습니다.');
    return;
  }
  
  // 키 기준 그룹핑
  console.log('📊 키 기준 그룹핑...');
  const serverGroups = groupByKey(serverData);
  const localGroups = groupByKey(localData);
  
  console.log(`📥 서버 그룹: ${serverGroups.size}개 키`);
  console.log(`📥 로컬 그룹: ${localGroups.size}개 키`);
  
  // 일치성 검증
  console.log('🔍 일치성 검증...');
  const report = verifyConsistency(serverGroups, localGroups);
  
  // 결과 저장
  const reportFile = path.join(EXPORT_DIR, 'consistency_report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  // 결과 출력
  console.log('');
  console.log('📊 검증 결과:');
  console.log(`  총 서버 키: ${report.totalServerKeys}개`);
  console.log(`  총 로컬 키: ${report.totalLocalKeys}개`);
  console.log(`  공통 키: ${report.commonKeys}개`);
  console.log(`  서버 전용: ${report.serverOnlyKeys}개`);
  console.log(`  로컬 전용: ${report.localOnlyKeys}개`);
  console.log(`  충돌: ${report.conflicts.length}개`);
  console.log(`  일치율: ${report.summary.consistencyRate.toFixed(2)}%`);
  console.log(`  충돌율: ${report.summary.conflictRate.toFixed(2)}%`);
  
  if (report.conflicts.length > 0) {
    console.log('');
    console.log('⚠️ 충돌 상세:');
    report.conflicts.slice(0, 5).forEach((conflict, index) => {
      console.log(`  ${index + 1}. ${conflict.key}`);
      console.log(`     서버: ${conflict.serverItem.videoTitle || 'N/A'}`);
      console.log(`     로컬: ${conflict.localItem.videoTitle || 'N/A'}`);
    });
    
    if (report.conflicts.length > 5) {
      console.log(`  ... 및 ${report.conflicts.length - 5}개 더`);
    }
  }
  
  console.log('');
  console.log(`✅ 검증 완료: ${reportFile}`);
}

main().catch(console.error);
