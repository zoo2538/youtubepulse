// IndexedDB에서 데이터 복원 스크립트
(async function restoreFromIndexedDB() {
  console.log('🔄 IndexedDB 데이터 복원 시작...');
  
  try {
    // IndexedDB 연결
    const dbName = 'YouTubePulseDB';
    const dbVersion = 1;
    
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onerror = (event) => {
      console.error('❌ IndexedDB 열기 실패:', event);
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      console.log('✅ IndexedDB 연결 성공');
      
      // 각 저장소에서 데이터 가져오기
      const stores = [
        'unclassifiedData',
        'classifiedData', 
        'channelsData',
        'videosData',
        'autoCollectedData'
      ];
      
      const allData = {};
      
      stores.forEach(storeName => {
        try {
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            allData[storeName] = getAllRequest.result;
            console.log(`📊 ${storeName}: ${getAllRequest.result.length}개 데이터`);
            
            // 모든 데이터 수집 완료 후 처리
            if (Object.keys(allData).length === stores.length) {
              processRestoredData(allData);
            }
          };
          
          getAllRequest.onerror = () => {
            console.log(`⚠️ ${storeName} 데이터 없음`);
            allData[storeName] = [];
            
            if (Object.keys(allData).length === stores.length) {
              processRestoredData(allData);
            }
          };
        } catch (error) {
          console.log(`⚠️ ${storeName} 저장소 없음`);
          allData[storeName] = [];
          
          if (Object.keys(allData).length === stores.length) {
            processRestoredData(allData);
          }
        }
      });
    };
    
    function processRestoredData(data) {
      console.log('📋 복원된 데이터 요약:');
      console.log(`- 미분류 데이터: ${data.unclassifiedData?.length || 0}개`);
      console.log(`- 분류된 데이터: ${data.classifiedData?.length || 0}개`);
      console.log(`- 채널 데이터: ${data.channelsData?.length || 0}개`);
      console.log(`- 영상 데이터: ${data.videosData?.length || 0}개`);
      console.log(`- 자동수집 데이터: ${data.autoCollectedData?.length || 0}개`);
      
      // API 서버 상태 확인
      checkAPIServerStatus(data);
    }
    
    async function checkAPIServerStatus(data) {
      try {
        console.log('🔍 API 서버 상태 확인 중...');
        const response = await fetch('https://api.youthbepulse.com/api/health');
        const status = await response.json();
        console.log('📊 API 서버 상태:', status);
        
        if (status.database === 'Connected') {
          console.log('✅ PostgreSQL 연결됨 - 서버로 동기화 시도');
          await syncToServer(data);
        } else {
          console.log('❌ PostgreSQL 연결 안됨 - 로컬에서만 복원');
          showLocalData(data);
        }
      } catch (error) {
        console.error('❌ API 서버 연결 실패:', error);
        console.log('🔄 로컬 데이터만 복원');
        showLocalData(data);
      }
    }
    
    async function syncToServer(data) {
      console.log('🔄 서버로 데이터 동기화 중...');
      
      // 분류된 데이터 동기화
      if (data.classifiedData && data.classifiedData.length > 0) {
        try {
          const response = await fetch('https://api.youthbepulse.com/api/classified', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.classifiedData)
          });
          
          if (response.ok) {
            console.log('✅ 분류된 데이터 서버 동기화 완료');
          } else {
            console.error('❌ 분류된 데이터 동기화 실패:', await response.text());
          }
        } catch (error) {
          console.error('❌ 분류된 데이터 동기화 오류:', error);
        }
      }
      
      // 미분류 데이터 동기화
      if (data.unclassifiedData && data.unclassifiedData.length > 0) {
        try {
          const response = await fetch('https://api.youthbepulse.com/api/unclassified', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.unclassifiedData)
          });
          
          if (response.ok) {
            console.log('✅ 미분류 데이터 서버 동기화 완료');
          } else {
            console.error('❌ 미분류 데이터 동기화 실패:', await response.text());
          }
        } catch (error) {
          console.error('❌ 미분류 데이터 동기화 오류:', error);
        }
      }
      
      // 채널 데이터 동기화
      if (data.channelsData && data.channelsData.length > 0) {
        try {
          const response = await fetch('https://api.youthbepulse.com/api/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channels: data.channelsData })
          });
          
          if (response.ok) {
            console.log('✅ 채널 데이터 서버 동기화 완료');
          } else {
            console.error('❌ 채널 데이터 동기화 실패:', await response.text());
          }
        } catch (error) {
          console.error('❌ 채널 데이터 동기화 오류:', error);
        }
      }
      
      // 자동수집 데이터 동기화
      if (data.autoCollectedData && data.autoCollectedData.length > 0) {
        try {
          const response = await fetch('https://api.youthbepulse.com/api/auto-classified', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.autoCollectedData)
          });
          
          if (response.ok) {
            console.log('✅ 자동수집 데이터 서버 동기화 완료');
          } else {
            console.error('❌ 자동수집 데이터 동기화 실패:', await response.text());
          }
        } catch (error) {
          console.error('❌ 자동수집 데이터 동기화 오류:', error);
        }
      }
      
      console.log('🎉 IndexedDB → PostgreSQL 동기화 완료!');
    }
    
    function showLocalData(data) {
      console.log('📱 로컬 데이터 복원 완료:');
      
      // 분류된 데이터가 있으면 표시
      if (data.classifiedData && data.classifiedData.length > 0) {
        console.log('✅ 분류된 데이터 복원됨:', data.classifiedData.length, '개');
      }
      
      // 미분류 데이터가 있으면 표시
      if (data.unclassifiedData && data.unclassifiedData.length > 0) {
        console.log('✅ 미분류 데이터 복원됨:', data.unclassifiedData.length, '개');
      }
      
      // 채널 데이터가 있으면 표시
      if (data.channelsData && data.channelsData.length > 0) {
        console.log('✅ 채널 데이터 복원됨:', data.channelsData.length, '개');
      }
      
      console.log('🔄 페이지를 새로고침하면 복원된 데이터를 확인할 수 있습니다.');
    }
    
  } catch (error) {
    console.error('❌ IndexedDB 복원 실패:', error);
  }
})();
