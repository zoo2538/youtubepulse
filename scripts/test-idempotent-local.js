#!/usr/bin/env node

/**
 * 로컬에서 멱등 복원 시스템 테스트
 * Railway 배포 전에 로컬에서 기능 검증
 */

// 1. IndexedDB 멱등 복원 테스트
async function testIndexedDBIdempotency() {
  console.log('🧪 IndexedDB 멱등 복원 테스트 시작...');
  
  // IndexedDB 열기
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB', 10);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  // 테스트 데이터
  const testData = [
    {
      videoId: 'test-video-1',
      dayKeyLocal: '2025-10-05',
      viewCount: 1000,
      likeCount: 50,
      channelName: 'Test Channel',
      videoTitle: 'Test Video 1'
    },
    {
      videoId: 'test-video-1', // 같은 영상, 같은 날짜
      dayKeyLocal: '2025-10-05',
      viewCount: 1500, // 더 높은 조회수
      likeCount: 75,
      channelName: 'Test Channel',
      videoTitle: 'Test Video 1 Updated'
    },
    {
      videoId: 'test-video-1', // 같은 영상, 다른 날짜
      dayKeyLocal: '2025-10-06',
      viewCount: 2000,
      likeCount: 100,
      channelName: 'Test Channel',
      videoTitle: 'Test Video 1 Next Day'
    }
  ];
  
  // 첫 번째 복원
  console.log('📥 첫 번째 복원 실행...');
  const result1 = await batchIdempotentRestore(testData);
  console.log('첫 번째 복원 결과:', result1);
  
  // 두 번째 복원 (같은 데이터)
  console.log('📥 두 번째 복원 실행 (같은 데이터)...');
  const result2 = await batchIdempotentRestore(testData);
  console.log('두 번째 복원 결과:', result2);
  
  // 멱등성 검증
  const isIdempotent = result1.success === result2.success && 
                      result1.merged === result2.merged && 
                      result1.new === result2.new;
  
  console.log(`멱등성 테스트 결과: ${isIdempotent ? '✅ 통과' : '❌ 실패'}`);
  
  // 중복 검사
  const duplicateCheck = await checkDuplicates();
  console.log('중복 검사 결과:', duplicateCheck);
  
  return {
    firstRestore: result1,
    secondRestore: result2,
    isIdempotent,
    duplicateCheck
  };
}

// 2. 배치 멱등 복원 함수
async function batchIdempotentRestore(data) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB', 10);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  const transaction = db.transaction(['unclassifiedData'], 'readwrite');
  const store = transaction.objectStore('unclassifiedData');
  const videoDayIndex = store.index('videoDay');
  
  let successCount = 0;
  let mergedCount = 0;
  let newCount = 0;
  
  for (const item of data) {
    try {
      const key = [item.videoId, item.dayKeyLocal];
      const getRequest = videoDayIndex.get(key);
      
      await new Promise((resolve, reject) => {
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            // 기존 레코드가 있으면 최대값으로 병합
            const existing = getRequest.result;
            const merged = {
              ...existing,
              viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
              likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
              channelName: item.channelName || existing.channelName,
              videoTitle: item.videoTitle || existing.videoTitle,
              updatedAt: new Date().toISOString()
            };
            
            const putRequest = store.put(merged);
            putRequest.onsuccess = () => {
              mergedCount++;
              successCount++;
              resolve();
            };
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            // 새 레코드 추가
            const newItem = {
              ...item,
              id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            const addRequest = store.add(newItem);
            addRequest.onsuccess = () => {
              newCount++;
              successCount++;
              resolve();
            };
            addRequest.onerror = () => reject(addRequest.error);
          }
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error(`❌ 레코드 처리 실패 ${item.videoId}:`, error);
    }
  }
  
  return {
    total: data.length,
    success: successCount,
    merged: mergedCount,
    new: newCount
  };
}

// 3. 중복 검사 함수
async function checkDuplicates() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB', 10);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  const transaction = db.transaction(['unclassifiedData'], 'readonly');
  const store = transaction.objectStore('unclassifiedData');
  const getAllRequest = store.getAll();
  
  return new Promise((resolve, reject) => {
    getAllRequest.onsuccess = () => {
      const allData = getAllRequest.result;
      const groups = {};
      
      allData.forEach(item => {
        const key = `${item.videoId}-${item.dayKeyLocal || item.collectionDate?.split('T')[0]}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
      });
      
      const duplicates = Object.entries(groups)
        .filter(([key, items]) => items.length > 1)
        .map(([key, items]) => ({
          key,
          count: items.length,
          items: items.map(item => ({
            id: item.id,
            viewCount: item.viewCount,
            createdAt: item.createdAt
          }))
        }));
      
      resolve({
        total: allData.length,
        unique: Object.keys(groups).length,
        duplicates: duplicates.length,
        duplicateDetails: duplicates
      });
    };
    
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

// 4. 서버 API 시뮬레이션 테스트
async function testServerAPISimulation() {
  console.log('🌐 서버 API 시뮬레이션 테스트 시작...');
  
  // 멱등 복원 API 시뮬레이션
  const mockServerData = [
    {
      videoId: 'server-video-1',
      dayKeyLocal: '2025-10-05',
      viewCount: 2000,
      likeCount: 100,
      channelName: 'Server Channel',
      videoTitle: 'Server Video 1'
    },
    {
      videoId: 'server-video-1', // 같은 영상, 같은 날짜, 더 높은 조회수
      dayKeyLocal: '2025-10-05',
      viewCount: 2500,
      likeCount: 125,
      channelName: 'Server Channel',
      videoTitle: 'Server Video 1 Updated'
    }
  ];
  
  console.log('📤 서버→로컬 동기화 시뮬레이션...');
  const syncResult = await batchIdempotentRestore(mockServerData);
  console.log('동기화 결과:', syncResult);
  
  return syncResult;
}

// 5. 전체 테스트 실행
async function runAllTests() {
  console.log('🚀 멱등 복원 시스템 전체 테스트 시작...');
  
  try {
    // IndexedDB 멱등성 테스트
    const idbTest = await testIndexedDBIdempotency();
    
    // 서버 API 시뮬레이션 테스트
    const apiTest = await testServerAPISimulation();
    
    // 최종 결과
    console.log('\n📊 테스트 결과 요약:');
    console.log('✅ IndexedDB 멱등성:', idbTest.isIdempotent ? '통과' : '실패');
    console.log('✅ 서버 API 시뮬레이션:', apiTest.success > 0 ? '성공' : '실패');
    console.log('✅ 중복 검사:', idbTest.duplicateCheck.duplicates === 0 ? '통과' : '실패');
    
    return {
      idbTest,
      apiTest,
      overallSuccess: idbTest.isIdempotent && apiTest.success > 0 && idbTest.duplicateCheck.duplicates === 0
    };
  } catch (error) {
    console.error('❌ 테스트 실행 실패:', error);
    return { error: error.message };
  }
}

// 6. 브라우저 환경에서 실행
if (typeof window !== 'undefined') {
  // 브라우저 환경
  window.testIdempotentSystem = runAllTests;
  console.log('🧪 멱등 복원 시스템 테스트 준비 완료');
  console.log('브라우저 콘솔에서 testIdempotentSystem() 실행하세요');
} else {
  // Node.js 환경
  console.log('❌ 이 스크립트는 브라우저 환경에서 실행해야 합니다');
  console.log('브라우저에서 F12 → Console → testIdempotentSystem() 실행하세요');
}
