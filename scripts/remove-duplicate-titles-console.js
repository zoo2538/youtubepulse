// 10월 2일 데이터에서 같은 제목의 영상 삭제 스크립트
// 브라우저 콘솔에서 실행하세요

(async function removeDuplicateTitlesByDate() {
  console.log('🔍 10월 2일 데이터에서 중복 제목 영상 삭제 시작...');
  
  try {
    // IndexedDB 연결 (버전 자동 감지)
    const request = indexedDB.open('YouTubePulseDB');
    
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        console.log('🔄 IndexedDB 업그레이드 중...');
      };
    });
    
    // 10월 2일 데이터 조회
    const transaction = db.transaction(['unclassifiedData'], 'readonly');
    const store = transaction.objectStore('unclassifiedData');
    const allData = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log(`📊 전체 데이터: ${allData.length}개`);
    
    // 10월 2일 데이터 필터링
    const october2Data = allData.filter(item => {
      const itemDate = item.collectionDate || item.date || item.uploadDate;
      return itemDate && itemDate.includes('2025-10-02');
    });
    
    console.log(`📅 10월 2일 데이터: ${october2Data.length}개`);
    
    if (october2Data.length === 0) {
      console.log('❌ 10월 2일 데이터가 없습니다.');
      return;
    }
    
    // 제목별 그룹화
    const titleGroups = {};
    october2Data.forEach(item => {
      const title = item.videoTitle || item.title;
      if (!titleGroups[title]) {
        titleGroups[title] = [];
      }
      titleGroups[title].push(item);
    });
    
    // 중복 제목 찾기
    const duplicateTitles = Object.keys(titleGroups).filter(title => titleGroups[title].length > 1);
    
    console.log(`🔍 중복 제목: ${duplicateTitles.length}개`);
    
    if (duplicateTitles.length === 0) {
      console.log('✅ 중복 제목이 없습니다.');
      return;
    }
    
    // 중복 제목별 삭제할 항목 결정
    const itemsToDelete = [];
    const itemsToKeep = [];
    
    duplicateTitles.forEach(title => {
      const items = titleGroups[title];
      console.log(`\n📝 "${title}" - ${items.length}개 중복`);
      
      // 정렬: 분류된 것 우선, 조회수 높은 것 우선
      items.sort((a, b) => {
        // 1. 분류 상태 우선 (classified > unclassified)
        if (a.classified !== b.classified) {
          return a.classified ? -1 : 1;
        }
        // 2. 조회수 높은 것 우선
        const aViews = parseInt(a.viewCount || a.views || 0);
        const bViews = parseInt(b.viewCount || b.views || 0);
        return bViews - aViews;
      });
      
      // 첫 번째 항목만 유지, 나머지는 삭제 대상
      itemsToKeep.push(items[0]);
      itemsToDelete.push(...items.slice(1));
      
      console.log(`  ✅ 유지: ${items[0].viewCount || 0}회 조회수`);
      items.slice(1).forEach((item, index) => {
        console.log(`  ❌ 삭제 ${index + 1}: ${item.viewCount || 0}회 조회수`);
      });
    });
    
    console.log(`\n📊 삭제 대상: ${itemsToDelete.length}개`);
    console.log(`📊 유지할 항목: ${itemsToKeep.length}개`);
    
    // 사용자 확인
    const confirmDelete = confirm(
      `⚠️ 중복 제목 영상 삭제 확인\n\n` +
      `🗑️ 삭제할 영상: ${itemsToDelete.length}개\n` +
      `✅ 유지할 영상: ${itemsToKeep.length}개\n\n` +
      `계속하시겠습니까?`
    );
    
    if (!confirmDelete) {
      console.log('❌ 사용자가 취소했습니다.');
      return;
    }
    
    // 삭제 실행
    console.log('🗑️ 중복 영상 삭제 중...');
    
    const deleteTransaction = db.transaction(['unclassifiedData'], 'readwrite');
    const deleteStore = deleteTransaction.objectStore('unclassifiedData');
    
    let deletedCount = 0;
    for (const item of itemsToDelete) {
      try {
        await new Promise((resolve, reject) => {
          const deleteRequest = deleteStore.delete(item.id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
        deletedCount++;
        console.log(`✅ 삭제됨: ${item.videoTitle || item.title}`);
      } catch (error) {
        console.error(`❌ 삭제 실패: ${item.videoTitle || item.title}`, error);
      }
    }
    
    console.log(`\n🎉 중복 제목 삭제 완료!`);
    console.log(`🗑️ 삭제된 영상: ${deletedCount}개`);
    console.log(`✅ 남은 영상: ${october2Data.length - deletedCount}개`);
    
    // 결과 요약
    console.log('\n📋 삭제된 중복 제목들:');
    duplicateTitles.forEach(title => {
      const deletedForTitle = itemsToDelete.filter(item => 
        (item.videoTitle || item.title) === title
      ).length;
      console.log(`  - "${title}": ${deletedForTitle}개 삭제`);
    });
    
  } catch (error) {
    console.error('❌ 중복 제목 삭제 실패:', error);
  }
})();
