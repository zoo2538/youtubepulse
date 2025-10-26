/**
 * IndexedDB 마이그레이션 스니펫
 * 복합 키와 Math.max 병합 로직으로 멱등 복원 보장
 */

// 1. IndexedDB 스키마 업그레이드
const dbReq = indexedDB.open('YouTubePulseDB', 10); // 버전 증가
dbReq.onupgradeneeded = (event) => {
  const db = event.target.result;
  
  // 기존 저장소 확인 및 업그레이드
  if (!db.objectStoreNames.contains('unclassifiedData')) {
    const store = db.createObjectStore('unclassifiedData', { 
      keyPath: 'id' // 기본 키는 id 유지
    });
    
    // 인덱스 생성
    store.createIndex('videoId', 'videoId', { unique: false });
    store.createIndex('dayKeyLocal', 'dayKeyLocal', { unique: false });
    store.createIndex('status', 'status', { unique: false });
    store.createIndex('category', 'category', { unique: false });
    
    // 복합 키 인덱스 (멱등 복원을 위한 핵심)
    store.createIndex('videoDay', ['videoId', 'dayKeyLocal'], { unique: true });
  } else {
    // 기존 저장소에 새로운 인덱스 추가
    const transaction = db.transaction(['unclassifiedData'], 'readwrite');
    const store = transaction.objectStore('unclassifiedData');
    
    if (!store.indexNames.contains('videoDay')) {
      store.createIndex('videoDay', ['videoId', 'dayKeyLocal'], { unique: true });
    }
  }
};

// 2. 멱등 복원용 업서트 함수
async function upsertLocal(item) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB', 10);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  const transaction = db.transaction(['unclassifiedData'], 'readwrite');
  const store = transaction.objectStore('unclassifiedData');
  const videoDayIndex = store.index('videoDay');
  
  // dayKeyLocal이 없으면 생성
  if (!item.dayKeyLocal && item.collectionDate) {
    const date = new Date(item.collectionDate);
    item.dayKeyLocal = date.toISOString().split('T')[0];
  }
  
  const key = [item.videoId, item.dayKeyLocal];
  
  return new Promise((resolve, reject) => {
    const getRequest = videoDayIndex.get(key);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        // 기존 레코드가 있으면 최대값으로 병합
        const existing = getRequest.result;
        const merged = {
          ...existing,
          viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
          likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
          // 사람 분류 등은 수동 우선 규칙 적용
          category: item.category || existing.category,
          subCategory: item.subCategory || existing.subCategory,
          status: item.status || existing.status,
          updatedAt: new Date().toISOString()
        };
        
        const putRequest = store.put(merged);
        putRequest.onsuccess = () => resolve({ action: 'merged', data: merged });
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
        addRequest.onsuccess = () => resolve({ action: 'new', data: newItem });
        addRequest.onerror = () => reject(addRequest.error);
      }
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// 3. 배치 멱등 복원 함수
async function batchIdempotentRestore(data) {
  console.log(`🔄 IndexedDB 멱등 복원 시작: ${data.length}개 레코드`);
  
  let successCount = 0;
  let mergedCount = 0;
  let newCount = 0;
  
  for (const item of data) {
    try {
      const result = await upsertLocal(item);
      successCount++;
      
      if (result.action === 'merged') {
        mergedCount++;
      } else {
        newCount++;
      }
    } catch (error) {
      console.error(`❌ 레코드 처리 실패 ${item.videoId}:`, error);
    }
  }
  
  console.log(`✅ IndexedDB 멱등 복원 완료: 성공 ${successCount}개, 병합 ${mergedCount}개, 신규 ${newCount}개`);
  
  return {
    total: data.length,
    success: successCount,
    merged: mergedCount,
    new: newCount
  };
}

// 4. 중복 검사 함수
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

// 5. 멱등성 테스트 함수
async function testIdempotency(testData) {
  console.log('🧪 IndexedDB 멱등성 테스트 시작...');
  
  // 첫 번째 복원
  const result1 = await batchIdempotentRestore(testData);
  console.log('첫 번째 복원 결과:', result1);
  
  // 두 번째 복원 (같은 데이터)
  const result2 = await batchIdempotentRestore(testData);
  console.log('두 번째 복원 결과:', result2);
  
  // 결과 비교
  const isIdempotent = result1.success === result2.success && 
                      result1.merged === result2.merged && 
                      result1.new === result2.new;
  
  console.log(`멱등성 테스트 결과: ${isIdempotent ? '✅ 통과' : '❌ 실패'}`);
  
  return {
    firstRestore: result1,
    secondRestore: result2,
    isIdempotent
  };
}

// 6. 사용 예시
async function exampleUsage() {
  // 중복 검사
  const duplicateCheck = await checkDuplicates();
  console.log('중복 검사 결과:', duplicateCheck);
  
  // 멱등성 테스트
  const testData = [
    {
      videoId: 'test-video-1',
      dayKeyLocal: '2025-10-05',
      viewCount: 1000,
      likeCount: 50,
      channelName: 'Test Channel',
      videoTitle: 'Test Video'
    }
  ];
  
  const testResult = await testIdempotency(testData);
  console.log('멱등성 테스트 결과:', testResult);
}

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    upsertLocal,
    batchIdempotentRestore,
    checkDuplicates,
    testIdempotency
  };
}
