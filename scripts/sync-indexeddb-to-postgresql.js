// IndexedDB에서 PostgreSQL로 일괄 동기화 스크립트
// 브라우저 콘솔에서 실행하세요

(async function syncIndexedDBToPostgreSQL() {
  console.log('🔄 IndexedDB → PostgreSQL 동기화 시작...');
  
  try {
    // 1. IndexedDB 연결
    const request = indexedDB.open('YouTubePulseDB');
    
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log('✅ IndexedDB 연결 성공');
    
    // 2. 미분류 데이터 조회
    const transaction = db.transaction(['unclassifiedData'], 'readonly');
    const store = transaction.objectStore('unclassifiedData');
    const allData = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 IndexedDB 데이터: ${allData.length}개`);
    
    if (allData.length === 0) {
      console.log('❌ 동기화할 데이터가 없습니다.');
      return;
    }
    
    // 3. 분류된 데이터 조회
    const classifiedTransaction = db.transaction(['classifiedData'], 'readonly');
    const classifiedStore = classifiedTransaction.objectStore('classifiedData');
    const classifiedData = await new Promise((resolve, reject) => {
      const request = classifiedStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 분류된 데이터: ${classifiedData.length}개`);
    
    // 4. 채널 데이터 조회
    const channelTransaction = db.transaction(['channels'], 'readonly');
    const channelStore = channelTransaction.objectStore('channels');
    const channelData = await new Promise((resolve, reject) => {
      const request = channelStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 채널 데이터: ${channelData.length}개`);
    
    // 5. 사용자 확인
    const totalData = allData.length + classifiedData.length + channelData.length;
    const confirmSync = confirm(
      `⚠️ PostgreSQL 동기화 확인\n\n` +
      `📊 동기화할 데이터:\n` +
      `  - 미분류 데이터: ${allData.length}개\n` +
      `  - 분류된 데이터: ${classifiedData.length}개\n` +
      `  - 채널 데이터: ${channelData.length}개\n` +
      `  - 총 데이터: ${totalData}개\n\n` +
      `계속하시겠습니까?`
    );
    
    if (!confirmSync) {
      console.log('❌ 사용자가 취소했습니다.');
      return;
    }
    
    // 6. API 서버 상태 확인
    console.log('🔍 API 서버 상태 확인 중...');
    const healthResponse = await fetch('https://api.youthbepulse.com/api/health');
    const healthData = await healthResponse.json();
    
    console.log('📊 API 서버 상태:', healthData);
    
    if (healthData.database !== 'Connected') {
      console.error('❌ PostgreSQL이 연결되지 않았습니다.');
      console.error('❌ 서버 상태:', healthData);
      return;
    }
    
    console.log('✅ PostgreSQL 연결 확인됨');
    
    // 7. 채널 데이터 동기화
    if (channelData.length > 0) {
      console.log('🔄 채널 데이터 동기화 중...');
      
      for (let i = 0; i < channelData.length; i += 100) {
        const batch = channelData.slice(i, i + 100);
        
        try {
          const response = await fetch('https://api.youthbepulse.com/api/sync/channels', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
          });
          
          if (response.ok) {
            console.log(`✅ 채널 배치 ${i + 1}~${i + batch.length} 동기화 성공`);
          } else {
            const errorText = await response.text();
            console.error(`❌ 채널 배치 ${i + 1}~${i + batch.length} 동기화 실패:`, errorText);
          }
        } catch (error) {
          console.error(`❌ 채널 배치 ${i + 1}~${i + batch.length} 동기화 에러:`, error);
        }
      }
    }
    
    // 8. 비디오 데이터 동기화
    if (allData.length > 0) {
      console.log('🔄 비디오 데이터 동기화 중...');
      
      for (let i = 0; i < allData.length; i += 100) {
        const batch = allData.slice(i, i + 100);
        
        try {
          const response = await fetch('https://api.youthbepulse.com/api/sync/videos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
          });
          
          if (response.ok) {
            console.log(`✅ 비디오 배치 ${i + 1}~${i + batch.length} 동기화 성공`);
          } else {
            const errorText = await response.text();
            console.error(`❌ 비디오 배치 ${i + 1}~${i + batch.length} 동기화 실패:`, errorText);
          }
        } catch (error) {
          console.error(`❌ 비디오 배치 ${i + 1}~${i + batch.length} 동기화 에러:`, error);
        }
      }
    }
    
    // 9. 분류 데이터 동기화
    if (classifiedData.length > 0) {
      console.log('🔄 분류 데이터 동기화 중...');
      
      for (let i = 0; i < classifiedData.length; i += 100) {
        const batch = classifiedData.slice(i, i + 100);
        
        try {
          const response = await fetch('https://api.youthbepulse.com/api/sync/classification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch),
          });
          
          if (response.ok) {
            console.log(`✅ 분류 배치 ${i + 1}~${i + batch.length} 동기화 성공`);
          } else {
            const errorText = await response.text();
            console.error(`❌ 분류 배치 ${i + 1}~${i + batch.length} 동기화 실패:`, errorText);
          }
        } catch (error) {
          console.error(`❌ 분류 배치 ${i + 1}~${i + batch.length} 동기화 에러:`, error);
        }
      }
    }
    
    console.log('🎉 IndexedDB → PostgreSQL 동기화 완료!');
    console.log(`📊 동기화된 데이터:`);
    console.log(`  - 채널: ${channelData.length}개`);
    console.log(`  - 비디오: ${allData.length}개`);
    console.log(`  - 분류: ${classifiedData.length}개`);
    console.log(`  - 총계: ${totalData}개`);
    
  } catch (error) {
    console.error('❌ 동기화 실패:', error);
  }
})();
