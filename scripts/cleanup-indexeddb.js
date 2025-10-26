// IndexedDB 중복 압축/청소 스크립트 (Node.js 환경)
import fs from 'fs';
import path from 'path';

console.log('🗜️ IndexedDB 중복 압축/청소 시작...');

// 브라우저에서 실행할 IndexedDB 압축 스크립트 생성
const browserCompressScript = `
// 브라우저 콘솔에서 실행할 IndexedDB 압축 스크립트
(async function cleanupIndexedDB() {
  try {
    console.log('🗜️ IndexedDB 중복 압축/청소 시작...');
    
    // IndexedDB 열기
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('YouTubePulseDB', 10);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    // 트랜잭션 시작
    const transaction = db.transaction(['unclassifiedData'], 'readwrite');
    const store = transaction.objectStore('unclassifiedData');
    const videoDayIndex = store.index('videoDay');
    
    // 모든 데이터 가져오기
    const allData = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    console.log(\`📊 압축 전: \${allData.length}개 항목\`);
    
    // 키 기준으로 그룹핑 (videoId + dayKeyLocal)
    const groups = new Map();
    for (const item of allData) {
      const key = \`\${item.videoId}_\${item.dayKeyLocal || item.collectionDate}\`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    }
    
    console.log(\`📊 그룹 수: \${groups.size}개\`);
    
    // 각 그룹에서 최대값 보존 및 중복 제거
    const compressedData = [];
    let duplicatesRemoved = 0;
    
    for (const [key, items] of groups) {
      if (items.length === 1) {
        // 중복이 없는 경우
        compressedData.push(items[0]);
      } else {
        // 중복이 있는 경우 - 최대값 보존
        const merged = items.reduce((acc, item) => {
          return {
            ...acc,
            viewCount: Math.max(acc.viewCount || 0, item.viewCount || 0),
            likeCount: Math.max(acc.likeCount || 0, item.likeCount || 0),
            // 수동 분류 필드는 최신값 우선
            category: item.category || acc.category,
            subCategory: item.subCategory || acc.subCategory,
            status: item.status || acc.status,
            // 메타데이터는 최신값
            updatedAt: new Date(Math.max(
              new Date(acc.updatedAt || 0).getTime(),
              new Date(item.updatedAt || 0).getTime()
            )).toISOString()
          };
        });
        
        compressedData.push(merged);
        duplicatesRemoved += items.length - 1;
      }
    }
    
    console.log(\`🗑️ 중복 제거: \${duplicatesRemoved}개\`);
    console.log(\`📊 압축 후: \${compressedData.length}개 항목\`);
    
    // 기존 데이터 삭제
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    // 압축된 데이터 저장
    for (const item of compressedData) {
      await new Promise((resolve, reject) => {
        const request = store.add(item);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }
    
    console.log('✅ IndexedDB 압축 완료');
    console.log(\`📊 압축률: \${((allData.length - compressedData.length) / allData.length * 100).toFixed(2)}%\`);
    
    return {
      before: allData.length,
      after: compressedData.length,
      duplicatesRemoved,
      compressionRate: ((allData.length - compressedData.length) / allData.length * 100).toFixed(2)
    };
  } catch (error) {
    console.error('❌ IndexedDB 압축 실패:', error);
    return null;
  }
})();
`;

// 브라우저 스크립트를 파일로 저장
const browserScriptFile = path.join('.tmp', 'browser-cleanup-script.js');
fs.writeFileSync(browserScriptFile, browserCompressScript);

console.log('📝 브라우저 압축 스크립트 생성:', browserScriptFile);
console.log('');
console.log('🔧 사용 방법:');
console.log('1. 웹 브라우저에서 데이터 분류 페이지 열기');
console.log('2. 개발자 도구 콘솔 열기 (F12)');
console.log('3. 다음 스크립트를 복사해서 실행:');
console.log('');
console.log('```javascript');
console.log(browserCompressScript);
console.log('```');
console.log('');
console.log('4. 압축 결과를 확인하고 필요시 백업');

// Node.js 환경에서는 시뮬레이션만 실행
function simulateCleanup() {
  console.log('🧪 IndexedDB 압축 시뮬레이션...');
  
  // 서버 데이터를 기반으로 시뮬레이션
  const serverFile = path.join('.tmp', 'server_since.json');
  if (!fs.existsSync(serverFile)) {
    console.log('⚠️ 서버 데이터 파일이 없습니다.');
    return;
  }
  
  const serverData = JSON.parse(fs.readFileSync(serverFile, 'utf8'));
  const data = Array.isArray(serverData) ? serverData : serverData.data || [];
  
  console.log(`📊 시뮬레이션 데이터: ${data.length}개 항목`);
  
  // 키 기준 그룹핑
  const groups = new Map();
  for (const item of data) {
    const key = `${item.videoId || item.video_id}_${item.dayKeyLocal || item.day_key_local || item.collectionDate}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  
  // 압축 시뮬레이션
  let duplicatesRemoved = 0;
  const compressedData = [];
  
  for (const [key, items] of groups) {
    if (items.length === 1) {
      compressedData.push(items[0]);
    } else {
      // 중복 제거 시뮬레이션
      const merged = items.reduce((acc, item) => {
        return {
          ...acc,
          viewCount: Math.max(acc.viewCount || 0, item.viewCount || 0),
          likeCount: Math.max(acc.likeCount || 0, item.likeCount || 0)
        };
      });
      compressedData.push(merged);
      duplicatesRemoved += items.length - 1;
    }
  }
  
  const compressionRate = ((data.length - compressedData.length) / data.length * 100).toFixed(2);
  
  console.log(`🗑️ 시뮬레이션 중복 제거: ${duplicatesRemoved}개`);
  console.log(`📊 압축 후: ${compressedData.length}개 항목`);
  console.log(`📊 압축률: ${compressionRate}%`);
  
  // 시뮬레이션 결과 저장
  const simulationFile = path.join('.tmp', 'indexeddb_cleanup_simulation.json');
  fs.writeFileSync(simulationFile, JSON.stringify({
    before: data.length,
    after: compressedData.length,
    duplicatesRemoved,
    compressionRate: parseFloat(compressionRate),
    groups: groups.size,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log(`✅ 시뮬레이션 완료: ${simulationFile}`);
}

// 메인 실행
async function main() {
  console.log('🚀 IndexedDB 중복 압축/청소 실행...');
  
  // 브라우저 스크립트 생성
  console.log('📝 브라우저 압축 스크립트 생성 완료');
  
  // 압축 시뮬레이션
  simulateCleanup();
  
  console.log('');
  console.log('📋 다음 단계:');
  console.log('1. 브라우저에서 압축 스크립트 실행');
  console.log('2. 압축 결과 확인');
  console.log('3. 필요시 백업 생성');
}

main().catch(console.error);
