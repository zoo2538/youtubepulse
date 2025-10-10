// 브라우저 개발자 도구 콘솔에서 이 스크립트를 실행하세요
// https://youthbepulse.com 에서 F12를 누르고 콘솔 탭에서 실행

(async function syncServerToLocal() {
  console.log('🔄 서버 → 로컬 동기화 시작...\n');
  
  try {
    // 1. 서버에서 분류된 데이터 가져오기
    console.log('📥 서버에서 분류된 데이터 가져오는 중...');
    const classifiedResponse = await fetch('https://api.youthbepulse.com/api/classified');
    const classifiedData = await classifiedResponse.json();
    
    console.log(`✅ 서버에서 ${classifiedData.length}개의 분류 데이터 가져옴`);
    
    // 2. 서버에서 미분류 데이터 가져오기
    console.log('📥 서버에서 미분류 데이터 가져오는 중...');
    const unclassifiedResponse = await fetch('https://api.youthbepulse.com/api/unclassified');
    const unclassifiedData = await unclassifiedResponse.json();
    
    console.log(`✅ 서버에서 ${unclassifiedData.length}개의 미분류 데이터 가져옴`);
    
    // 3. IndexedDB 열기
    const dbRequest = indexedDB.open('YouTubePulseDB');
    
    dbRequest.onsuccess = async () => {
      const db = dbRequest.result;
      console.log('✅ IndexedDB 연결 성공');
      
      // 4. 미분류 데이터를 IndexedDB에 저장
      console.log('\n💾 IndexedDB에 데이터 저장 중...');
      
      const transaction = db.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      let savedCount = 0;
      let errorCount = 0;
      
      for (const item of unclassifiedData) {
        try {
          // 데이터 정규화
          const normalizedItem = {
            id: item.id || `${item.videoId}_${item.dayKeyLocal}`,
            videoId: item.videoId,
            channelId: item.channelId,
            channelName: item.channelName,
            videoTitle: item.videoTitle,
            videoDescription: item.videoDescription,
            viewCount: item.viewCount,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            uploadDate: item.uploadDate,
            collectionDate: item.collectionDate,
            thumbnailUrl: item.thumbnailUrl,
            category: item.category,
            subCategory: item.subCategory,
            status: item.status,
            dayKeyLocal: item.dayKeyLocal,
            collectionType: item.collectionType || 'manual',
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          };
          
          // put을 사용하여 기존 데이터 덮어쓰기 (upsert)
          store.put(normalizedItem);
          savedCount++;
          
          if (savedCount % 100 === 0) {
            console.log(`진행 중... ${savedCount}/${unclassifiedData.length}`);
          }
        } catch (error) {
          console.error(`❌ 데이터 저장 실패:`, item.id, error);
          errorCount++;
        }
      }
      
      transaction.oncomplete = () => {
        console.log(`\n✅ 동기화 완료!`);
        console.log(`   저장 성공: ${savedCount}개`);
        console.log(`   저장 실패: ${errorCount}개`);
        
        // 5. 동기화 후 데이터 확인
        checkData(db);
      };
      
      transaction.onerror = () => {
        console.error('❌ 트랜잭션 실패:', transaction.error);
      };
    };
    
    dbRequest.onerror = () => {
      console.error('❌ IndexedDB 연결 실패:', dbRequest.error);
    };
    
  } catch (error) {
    console.error('❌ 동기화 실패:', error);
  }
})();

function checkData(db) {
  console.log('\n📊 동기화 후 데이터 확인 중...');
  
  const transaction = db.transaction(['unclassifiedData'], 'readonly');
  const store = transaction.objectStore('unclassifiedData');
  const getAllRequest = store.getAll();
  
  getAllRequest.onsuccess = () => {
    const data = getAllRequest.result;
    
    // 날짜별, 수집타입별 통계
    const dateStats = {};
    
    data.forEach(item => {
      const dateKey = item.dayKeyLocal || 'unknown';
      const collectionType = item.collectionType || 'manual';
      
      if (!dateStats[dateKey]) {
        dateStats[dateKey] = { manual: 0, auto: 0, total: 0 };
      }
      
      if (collectionType === 'auto') {
        dateStats[dateKey].auto++;
      } else {
        dateStats[dateKey].manual++;
      }
      
      dateStats[dateKey].total++;
    });
    
    console.log(`\n전체 데이터: ${data.length.toLocaleString()}개`);
    
    const sortedDates = Object.keys(dateStats).sort((a, b) => b.localeCompare(a));
    
    const tableData = sortedDates.slice(0, 10).map(date => {
      const stat = dateStats[date];
      return {
        '날짜': date,
        '수동': stat.manual.toLocaleString(),
        '자동': stat.auto.toLocaleString(),
        '전체': stat.total.toLocaleString()
      };
    });
    
    console.table(tableData);
    
    console.log('\n✅ 페이지를 새로고침(F5)하면 최신 데이터가 반영됩니다!');
  };
}

