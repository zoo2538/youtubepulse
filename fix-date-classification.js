// 기존 데이터의 날짜 분류 수정 스크립트
console.log('🔧 날짜 분류 수정 시작...');

const fixDateClassification = async () => {
  try {
    const dbName = 'YouTubePulseDB';
    const request = indexedDB.open(dbName, 2);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const allData = getAllRequest.result;
        console.log(`📊 전체 데이터: ${allData.length}개`);
        
        // 수집 시간 기준으로 날짜 재분류
        const today = '2025-10-02';
        let updatedCount = 0;
        
        for (const item of allData) {
          if (item.id && typeof item.id === 'string') {
            const timestamp = parseInt(item.id.split('_')[0]);
            if (!isNaN(timestamp)) {
              const itemDate = new Date(timestamp).toISOString().split('T')[0];
              
              // 오늘 수집된 데이터인데 다른 날짜로 분류된 경우 수정
              if (itemDate === today && item.collectionDate !== today) {
                item.collectionDate = today;
                item.date = today;
                
                // 데이터 업데이트
                const updateRequest = store.put(item);
                updateRequest.onsuccess = () => {
                  updatedCount++;
                };
                updateRequest.onerror = () => {
                  console.error('데이터 업데이트 실패:', item.id);
                };
              }
            }
          }
        }
        
        // 업데이트 완료 대기
        setTimeout(() => {
          console.log(`✅ 날짜 분류 수정 완료: ${updatedCount}개 데이터 수정됨`);
          
          // 수정된 데이터 확인
          const checkRequest = store.getAll();
          checkRequest.onsuccess = () => {
            const updatedData = checkRequest.result;
            const todayData = updatedData.filter(item => {
              const itemDate = item.collectionDate || item.date;
              return itemDate === today;
            });
            
            console.log(`📅 수정 후 오늘(${today}) 데이터: ${todayData.length}개`);
            
            // 날짜별 분포 재확인
            const dateStats = {};
            updatedData.forEach(item => {
              const date = item.collectionDate || item.date || 'unknown';
              dateStats[date] = (dateStats[date] || 0) + 1;
            });
            
            console.log('📅 수정된 날짜별 분포:');
            Object.entries(dateStats)
              .sort(([a], [b]) => b.localeCompare(a))
              .forEach(([date, count]) => {
                console.log(`  ${date}: ${count}개`);
              });
          };
        }, 1000);
      };
    };
    
    request.onerror = () => {
      console.error('IndexedDB 연결 실패:', request.error);
    };
  } catch (error) {
    console.error('스크립트 실행 오류:', error);
  }
};

fixDateClassification();
