// 일자별 중복 영상 제거 스크립트 (브라우저 콘솔용)
// 같은 날짜에서 같은 영상 이름 중 조회수가 높은 것만 남기고 삭제

console.log('🗑️ 일자별 중복 영상 제거 시작...');

// 브라우저에서 실행할 IndexedDB 중복 제거 스크립트
const browserRemoveDuplicatesScript = `
// 브라우저 콘솔에서 실행할 일자별 중복 영상 제거 스크립트
(async function removeDuplicatesByDate() {
  try {
    console.log('🗑️ 일자별 중복 영상 제거 시작...');
    
    // IndexedDB 열기 (버전 2 사용)
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('YouTubePulseDB', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    // 트랜잭션 시작
    const transaction = db.transaction(['unclassifiedData'], 'readwrite');
    const store = transaction.objectStore('unclassifiedData');
    
    // 모든 데이터 가져오기
    const allData = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    console.log(\`📊 전체 데이터: \${allData.length}개 항목\`);
    
    // 일자별로 그룹핑
    const dateGroups = new Map();
    for (const item of allData) {
      const dateKey = item.dayKeyLocal || item.collectionDate || 'unknown';
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey).push(item);
    }
    
    console.log(\`📅 일자별 그룹: \${dateGroups.size}개\`);
    
    let totalRemoved = 0;
    const results = [];
    
    // 각 일자별로 처리
    for (const [dateKey, items] of dateGroups) {
      console.log(\`\\n📅 처리 중: \${dateKey} (\${items.length}개 항목)\`);
      
      // 같은 영상 제목으로 그룹핑
      const titleGroups = new Map();
      for (const item of items) {
        const title = item.videoTitle || item.video_title || 'Unknown Title';
        if (!titleGroups.has(title)) {
          titleGroups.set(title, []);
        }
        titleGroups.get(title).push(item);
      }
      
      let dateRemoved = 0;
      const dateResults = [];
      
      // 같은 제목의 영상들 중 조회수가 높은 것만 남기기
      for (const [title, titleItems] of titleGroups) {
        if (titleItems.length > 1) {
          console.log(\`  🎬 "\${title}" - \${titleItems.length}개 중복 발견\`);
          
          // 조회수 기준으로 정렬 (높은 순)
          titleItems.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
          
          // 가장 높은 조회수 항목만 유지
          const keepItem = titleItems[0];
          const removeItems = titleItems.slice(1);
          
          console.log(\`    ✅ 유지: \${keepItem.viewCount || 0} 조회수\`);
          console.log(\`    🗑️ 삭제: \${removeItems.length}개 항목\`);
          
          // 삭제할 항목들을 IndexedDB에서 제거
          for (const removeItem of removeItems) {
            await new Promise((resolve, reject) => {
              const request = store.delete(removeItem.id);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => resolve(request.result);
            });
          }
          
          dateRemoved += removeItems.length;
          dateResults.push({
            title,
            kept: 1,
            removed: removeItems.length,
            maxViews: keepItem.viewCount || 0
          });
        }
      }
      
      totalRemoved += dateRemoved;
      results.push({
        date: dateKey,
        totalItems: items.length,
        removed: dateRemoved,
        remaining: items.length - dateRemoved,
        details: dateResults
      });
      
      console.log(\`  📊 \${dateKey}: \${dateRemoved}개 제거, \${items.length - dateRemoved}개 유지\`);
    }
    
    console.log('\\n🎉 일자별 중복 영상 제거 완료!');
    console.log(\`📊 총 제거: \${totalRemoved}개 항목\`);
    console.log(\`📊 남은 항목: \${allData.length - totalRemoved}개 항목\`);
    
    // 결과 상세 출력
    console.log('\\n📋 일자별 결과:');
    results.forEach(result => {
      if (result.removed > 0) {
        console.log(\`  📅 \${result.date}: \${result.removed}개 제거\`);
        result.details.forEach(detail => {
          console.log(\`    🎬 "\${detail.title}": \${detail.removed}개 제거, \${detail.maxViews} 조회수 유지\`);
        });
      }
    });
    
    return {
      totalRemoved,
      remaining: allData.length - totalRemoved,
      dateResults: results,
      compressionRate: ((totalRemoved / allData.length) * 100).toFixed(2) + '%'
    };
    
  } catch (error) {
    console.error('❌ 일자별 중복 제거 실패:', error);
    return null;
  }
})();
`;

// 브라우저 스크립트를 파일로 저장
import fs from 'fs';
import path from 'path';

const browserScriptFile = path.join('.tmp', 'browser-remove-duplicates-by-date.js');
fs.writeFileSync(browserScriptFile, browserRemoveDuplicatesScript);

console.log('📝 브라우저 중복 제거 스크립트 생성:', browserScriptFile);
console.log('');
console.log('🔧 사용 방법:');
console.log('1. 웹 브라우저에서 데이터 분류 페이지 열기');
console.log('2. 개발자 도구 콘솔 열기 (F12)');
console.log('3. 다음 스크립트를 복사해서 실행:');
console.log('');
console.log('```javascript');
console.log(browserRemoveDuplicatesScript);
console.log('```');
console.log('');
console.log('4. 중복 제거 결과를 확인하고 필요시 백업');

// Node.js 환경에서는 시뮬레이션만 실행
function simulateRemoveDuplicates() {
  console.log('🧪 일자별 중복 제거 시뮬레이션...');
  
  // 서버 데이터를 기반으로 시뮬레이션
  const serverFile = path.join('.tmp', 'server_since.json');
  if (!fs.existsSync(serverFile)) {
    console.log('⚠️ 서버 데이터 파일이 없습니다.');
    return;
  }
  
  const serverData = JSON.parse(fs.readFileSync(serverFile, 'utf8'));
  const data = Array.isArray(serverData) ? serverData : serverData.data || [];
  
  console.log(`📊 시뮬레이션 데이터: ${data.length}개 항목`);
  
  // 일자별 그룹핑
  const dateGroups = new Map();
  for (const item of data) {
    const dateKey = item.dayKeyLocal || item.day_key_local || item.collectionDate || 'unknown';
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey).push(item);
  }
  
  console.log(`📅 일자별 그룹: ${dateGroups.size}개`);
  
  let totalRemoved = 0;
  const results = [];
  
  // 각 일자별로 시뮬레이션
  for (const [dateKey, items] of dateGroups) {
    // 같은 영상 제목으로 그룹핑
    const titleGroups = new Map();
    for (const item of items) {
      const title = item.videoTitle || item.video_title || 'Unknown Title';
      if (!titleGroups.has(title)) {
        titleGroups.set(title, []);
      }
      titleGroups.get(title).push(item);
    }
    
    let dateRemoved = 0;
    const dateResults = [];
    
    // 같은 제목의 영상들 중 조회수가 높은 것만 남기기
    for (const [title, titleItems] of titleGroups) {
      if (titleItems.length > 1) {
        // 조회수 기준으로 정렬 (높은 순)
        titleItems.sort((a, b) => (b.viewCount || b.view_count || 0) - (a.viewCount || a.view_count || 0));
        
        // 가장 높은 조회수 항목만 유지
        const keepItem = titleItems[0];
        const removeItems = titleItems.slice(1);
        
        dateRemoved += removeItems.length;
        dateResults.push({
          title,
          kept: 1,
          removed: removeItems.length,
          maxViews: keepItem.viewCount || keepItem.view_count || 0
        });
      }
    }
    
    totalRemoved += dateRemoved;
    results.push({
      date: dateKey,
      totalItems: items.length,
      removed: dateRemoved,
      remaining: items.length - dateRemoved,
      details: dateResults
    });
  }
  
  const compressionRate = ((totalRemoved / data.length) * 100).toFixed(2);
  
  console.log(`🗑️ 시뮬레이션 중복 제거: ${totalRemoved}개`);
  console.log(`📊 압축 후: ${data.length - totalRemoved}개 항목`);
  console.log(`📊 압축률: ${compressionRate}%`);
  
  // 시뮬레이션 결과 저장
  const simulationFile = path.join('.tmp', 'remove_duplicates_by_date_simulation.json');
  fs.writeFileSync(simulationFile, JSON.stringify({
    totalRemoved,
    remaining: data.length - totalRemoved,
    dateResults: results,
    compressionRate: parseFloat(compressionRate),
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log(`✅ 시뮬레이션 완료: ${simulationFile}`);
  
  // 결과 상세 출력
  console.log('\n📋 일자별 시뮬레이션 결과:');
  results.forEach(result => {
    if (result.removed > 0) {
      console.log(`  📅 ${result.date}: ${result.removed}개 제거`);
      result.details.forEach(detail => {
        console.log(`    🎬 "${detail.title}": ${detail.removed}개 제거, ${detail.maxViews} 조회수 유지`);
      });
    }
  });
}

// 메인 실행
async function main() {
  console.log('🚀 일자별 중복 영상 제거 실행...');
  
  // 브라우저 스크립트 생성
  console.log('📝 브라우저 중복 제거 스크립트 생성 완료');
  
  // 시뮬레이션 실행
  simulateRemoveDuplicates();
  
  console.log('');
  console.log('📋 다음 단계:');
  console.log('1. 브라우저에서 중복 제거 스크립트 실행');
  console.log('2. 중복 제거 결과 확인');
  console.log('3. 필요시 백업 생성');
}

main().catch(console.error);
