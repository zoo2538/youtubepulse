#!/usr/bin/env node

/**
 * 빠른 중복 정리 스크립트 (콘솔용)
 * 복사해서 붙여넣기 가능한 간단한 버전
 */

// 이 스크립트를 브라우저 콘솔에서 실행하세요
const quickCleanupScript = `
// 1. IndexedDB 중복 정리
async function cleanupIndexedDB() {
  console.log('🧹 IndexedDB 중복 정리 시작...');
  
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  const transaction = db.transaction(['unclassifiedData'], 'readwrite');
  const store = transaction.objectStore('unclassifiedData');
  const videoDayIndex = store.index('videoDay');
  
  // 모든 데이터 가져오기
  const allData = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  console.log(\`📊 총 데이터: \${allData.length}개\`);
  
  // 중복 그룹별로 최대값만 유지
  const cleanedData = [];
  const groups = {};
  
  allData.forEach(item => {
    const key = \`\${item.videoId}-\${item.dayKeyLocal || item.collectionDate?.split('T')[0]}\`;
    if (!groups[key] || item.viewCount > groups[key].viewCount) {
      groups[key] = item;
    }
  });
  
  Object.values(groups).forEach(item => {
    cleanedData.push(item);
  });
  
  console.log(\`✅ 정리된 데이터: \${cleanedData.length}개\`);
  console.log(\`🗑️ 제거된 중복: \${allData.length - cleanedData.length}개\`);
  
  // 기존 데이터 삭제
  await new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  
  // 정리된 데이터 추가
  for (const item of cleanedData) {
    await new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  console.log('🎉 IndexedDB 중복 정리 완료!');
}

// 2. 서버 데이터 중복 정리 (API 호출)
async function cleanupServerData() {
  console.log('🔄 서버 데이터 중복 정리 요청...');
  
  try {
    const response = await fetch('/api/cleanup-duplicates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 서버 중복 정리 완료!');
      console.log(\`   - 총 레코드: \${result.stats.total}개\`);
      console.log(\`   - 정리된 중복: \${result.stats.removed}개\`);
      console.log(\`   - 남은 레코드: \${result.stats.remaining}개\`);
    } else {
      console.error('❌ 서버 중복 정리 실패:', result.error);
    }
  } catch (error) {
    console.error('❌ 서버 연결 실패:', error);
  }
}

// 3. 전체 정리 실행
async function runFullCleanup() {
  console.log('🚀 전체 중복 정리 시작...');
  
  try {
    await cleanupIndexedDB();
    await cleanupServerData();
    console.log('🎉 모든 중복 정리가 완료되었습니다!');
  } catch (error) {
    console.error('❌ 정리 중 오류 발생:', error);
  }
}

// 실행
runFullCleanup();
`;

console.log('📋 브라우저 콘솔에서 실행할 스크립트:');
console.log('=====================================');
console.log(quickCleanupScript);
console.log('=====================================');
console.log('💡 사용법:');
console.log('1. 브라우저에서 F12를 눌러 개발자 도구 열기');
console.log('2. Console 탭으로 이동');
console.log('3. 위 스크립트를 복사해서 붙여넣기');
console.log('4. Enter 키를 눌러 실행');
