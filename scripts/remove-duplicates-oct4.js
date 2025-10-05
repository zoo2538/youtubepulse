/**
 * 10월 4일 중복 영상 삭제 스크립트
 * IndexedDB에서 중복된 영상을 찾아서 조회수가 높은 것만 유지
 */

// IndexedDB 연결 및 중복 제거 함수
async function removeDuplicatesForOct4() {
  console.log('🔍 10월 4일 중복 영상 검사 시작...');
  
  try {
    // IndexedDB 열기
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('YouTubePulseDB', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const transaction = db.transaction(['unclassifiedData'], 'readwrite');
    const store = transaction.objectStore('unclassifiedData');
    const getAllRequest = store.getAll();
    
    const allData = await new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
    
    console.log(`📊 전체 데이터: ${allData.length}개`);
    
    // 10월 4일 데이터 필터링
    const oct4Data = allData.filter(item => {
      const dateKey = item.dayKeyLocal || item.collectionDate?.split('T')[0] || item.uploadDate?.split('T')[0];
      return dateKey === '2025-10-04' || dateKey === '2024-10-04';
    });
    
    console.log(`📅 10월 4일 데이터: ${oct4Data.length}개`);
    
    if (oct4Data.length === 0) {
      console.log('❌ 10월 4일 데이터가 없습니다.');
      return;
    }
    
    // videoId별로 그룹화
    const groupedData = {};
    oct4Data.forEach(item => {
      const videoId = item.videoId;
      if (!groupedData[videoId]) {
        groupedData[videoId] = [];
      }
      groupedData[videoId].push(item);
    });
    
    console.log(`🎬 고유 영상 수: ${Object.keys(groupedData).length}개`);
    
    // 중복이 있는 영상 찾기
    const duplicates = Object.entries(groupedData)
      .filter(([videoId, items]) => items.length > 1)
      .map(([videoId, items]) => ({
        videoId,
        count: items.length,
        items: items.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)) // 조회수 높은 순으로 정렬
      }));
    
    console.log(`🔄 중복 영상: ${duplicates.length}개`);
    
    if (duplicates.length === 0) {
      console.log('✅ 중복 영상이 없습니다.');
      return;
    }
    
    // 중복 영상 처리
    let deletedCount = 0;
    let keptCount = 0;
    
    for (const duplicate of duplicates) {
      const { videoId, items } = duplicate;
      console.log(`🎬 영상 ID: ${videoId}, 중복 수: ${items.length}개`);
      
      // 조회수가 가장 높은 것만 유지 (첫 번째)
      const keepItem = items[0];
      const deleteItems = items.slice(1);
      
      console.log(`  ✅ 유지: 조회수 ${keepItem.viewCount || 0}, 좋아요 ${keepItem.likeCount || 0}`);
      
      // 삭제할 항목들 제거
      for (const deleteItem of deleteItems) {
        try {
          await new Promise((resolve, reject) => {
            const deleteRequest = store.delete(deleteItem.id);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              console.log(`  🗑️ 삭제: ID ${deleteItem.id}, 조회수 ${deleteItem.viewCount || 0}`);
              resolve();
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        } catch (error) {
          console.error(`❌ 삭제 실패 (ID: ${deleteItem.id}):`, error);
        }
      }
      
      keptCount++;
    }
    
    console.log('\n📊 중복 제거 결과:');
    console.log(`✅ 유지된 영상: ${keptCount}개`);
    console.log(`🗑️ 삭제된 중복: ${deletedCount}개`);
    console.log(`📈 정리율: ${Math.round((deletedCount / (keptCount + deletedCount)) * 100)}%`);
    
    // 최종 데이터 확인
    const finalData = await new Promise((resolve, reject) => {
      const finalRequest = store.getAll();
      finalRequest.onsuccess = () => resolve(finalRequest.result);
      finalRequest.onerror = () => reject(finalRequest.error);
    });
    
    const finalOct4Data = finalData.filter(item => {
      const dateKey = item.dayKeyLocal || item.collectionDate?.split('T')[0] || item.uploadDate?.split('T')[0];
      return dateKey === '2025-10-04' || dateKey === '2024-10-04';
    });
    
    console.log(`\n🎯 최종 10월 4일 데이터: ${finalOct4Data.length}개`);
    
    return {
      success: true,
      total: oct4Data.length,
      duplicates: duplicates.length,
      deleted: deletedCount,
      kept: keptCount,
      final: finalOct4Data.length
    };
    
  } catch (error) {
    console.error('❌ 중복 제거 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 실행
removeDuplicatesForOct4().then(result => {
  if (result.success) {
    console.log('🎉 10월 4일 중복 영상 제거 완료!');
    console.log(`📊 결과: ${result.deleted}개 삭제, ${result.kept}개 유지`);
  } else {
    console.error('❌ 중복 제거 실패:', result.error);
  }
});
