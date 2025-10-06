// 10월 6일 데이터의 고유 ID를 새로운 형식으로 업데이트하는 스크립트
const { openDB } = require('idb');

async function updateOctober6DataIds() {
  console.log('🔄 10월 6일 데이터 ID 업데이트 시작...');
  
  try {
    // IndexedDB 연결
    const db = await openDB('YouTubePulseDB', 1);
    
    // 10월 6일 데이터 조회
    const transaction = db.transaction(['unclassifiedData'], 'readonly');
    const store = transaction.objectStore('unclassifiedData');
    const allData = await store.getAll();
    
    // 10월 6일 데이터 필터링
    const october6Data = allData.filter(item => {
      const collectionDate = item.collectionDate || item.uploadDate;
      return collectionDate && collectionDate.includes('2025-10-06');
    });
    
    console.log(`📊 10월 6일 데이터 발견: ${october6Data.length}개`);
    
    if (october6Data.length === 0) {
      console.log('⚠️ 10월 6일 데이터가 없습니다.');
      return;
    }
    
    // 새로운 ID 형식으로 업데이트
    const updatedData = october6Data.map((item, index) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const videoIdPrefix = item.videoId ? item.videoId.substring(0, 8) : 'unknown';
      
      // 새로운 ID 생성: videoId_${timestamp}_${random}
      const newId = `${videoIdPrefix}_${timestamp}_${random}`;
      
      console.log(`🔄 ID 업데이트: ${item.id} → ${newId}`);
      
      return {
        ...item,
        id: newId,
        updatedAt: new Date().toISOString()
      };
    });
    
    // 업데이트된 데이터 저장
    const updateTransaction = db.transaction(['unclassifiedData'], 'readwrite');
    const updateStore = updateTransaction.objectStore('unclassifiedData');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of updatedData) {
      try {
        await updateStore.put(item);
        successCount++;
        console.log(`✅ ID 업데이트 완료: ${item.videoTitle} (${item.id})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ ID 업데이트 실패: ${item.videoTitle}`, error);
      }
    }
    
    console.log(`🎉 10월 6일 데이터 ID 업데이트 완료!`);
    console.log(`   - 성공: ${successCount}개`);
    console.log(`   - 실패: ${errorCount}개`);
    console.log(`   - 총 처리: ${updatedData.length}개`);
    
    // 업데이트된 데이터 확인
    const verifyTransaction = db.transaction(['unclassifiedData'], 'readonly');
    const verifyStore = verifyTransaction.objectStore('unclassifiedData');
    const verifyData = await verifyStore.getAll();
    
    const updatedOctober6Data = verifyData.filter(item => {
      const collectionDate = item.collectionDate || item.uploadDate;
      return collectionDate && collectionDate.includes('2025-10-06');
    });
    
    console.log(`📊 업데이트 후 10월 6일 데이터: ${updatedOctober6Data.length}개`);
    console.log(`📊 새로운 ID 형식 확인:`);
    updatedOctober6Data.slice(0, 5).forEach(item => {
      console.log(`   - ${item.videoTitle}: ${item.id}`);
    });
    
  } catch (error) {
    console.error('❌ ID 업데이트 실패:', error);
  }
}

// 스크립트 실행
if (typeof window !== 'undefined') {
  // 브라우저 환경에서 실행
  updateOctober6DataIds();
} else {
  // Node.js 환경에서 실행
  module.exports = { updateOctober6DataIds };
}
