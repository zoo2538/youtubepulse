// JSON 파일을 직접 읽어서 복원하는 스크립트
(async function restoreFromFile() {
  console.log('🔄 JSON 파일에서 직접 복원 시작...');
  
  try {
    // JSON 파일을 직접 읽기
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      console.log('📁 파일 선택됨:', file.name, file.size, 'bytes');
      
      // 파일을 텍스트로 읽기
      const text = await file.text();
      console.log('📖 파일 읽기 완료:', text.length, 'characters');
      
      // JSON 파싱
      const backupData = JSON.parse(text);
      console.log('📊 백업 데이터 요약:');
      console.log(`- 내보내기 날짜: ${backupData.exportDate}`);
      console.log(`- 날짜 범위: ${backupData.dateRange.from} ~ ${backupData.dateRange.to}`);
      console.log(`- 총 영상: ${backupData.totalVideos}개`);
      console.log(`- 분류된 영상: ${backupData.totalClassified}개`);
      console.log(`- 미분류 영상: ${backupData.totalUnclassified}개`);
      console.log(`- 일별 데이터: ${backupData.dailyData.length}일`);
      
      // IndexedDB에 직접 저장
      await restoreToIndexedDB(backupData);
    };
    
    // 파일 선택 다이얼로그 열기
    fileInput.click();
    
  } catch (error) {
    console.error('❌ 파일 읽기 실패:', error);
  }
})();

// IndexedDB에 백업 데이터 복원
async function restoreToIndexedDB(backupData) {
  console.log('🔄 IndexedDB에 데이터 저장 중...');
  
  // 데이터 배열 초기화
  const classifiedData = [];
  const unclassifiedData = [];
  const channelsData = [];
  const videosData = [];
  const dailyProgress = [];
  const dailySummary = [];
  
  // 일별 데이터 처리
  backupData.dailyData.forEach((dayData, dayIndex) => {
    console.log(`📅 ${dayData.date} 처리 중: ${dayData.total}개 영상 (${dayIndex + 1}/${backupData.dailyData.length})`);
    
    // 일별 진행률 저장
    dailyProgress.push({
      date: dayData.date,
      total: dayData.total,
      classified: dayData.classified,
      unclassified: dayData.unclassified,
      progress: dayData.progress
    });
    
    // 일별 요약 저장
    dailySummary.push({
      date: dayData.date,
      total: dayData.total,
      classified: dayData.classified,
      unclassified: dayData.unclassified,
      progress: dayData.progress
    });
    
    // 영상 데이터 분류
    dayData.data.forEach((video, videoIndex) => {
      // 채널 정보 수집 (중복 제거)
      const channelInfo = {
        channelId: video.channelId,
        channelName: video.channelName,
        description: video.description
      };
      
      if (!channelsData.find(c => c.channelId === video.channelId)) {
        channelsData.push(channelInfo);
      }
      
      // 영상 정보
      const videoInfo = {
        videoId: video.videoId,
        channelId: video.channelId,
        title: video.videoTitle,
        description: video.videoDescription,
        viewCount: video.viewCount,
        uploadDate: video.uploadDate,
        collectionDate: video.collectionDate,
        thumbnailUrl: video.thumbnailUrl,
        category: video.category,
        subCategory: video.subCategory,
        status: video.status
      };
      
      videosData.push(videoInfo);
      
      // 분류 상태에 따라 분류
      if (video.status === 'classified') {
        classifiedData.push(video);
      } else {
        unclassifiedData.push(video);
      }
      
      // 진행률 표시 (1000개마다)
      if (videoIndex % 1000 === 0) {
        console.log(`  📊 ${dayData.date} 영상 처리 중: ${videoIndex + 1}/${dayData.data.length}`);
      }
    });
  });
  
  console.log('📊 데이터 분류 완료:');
  console.log(`- 분류된 데이터: ${classifiedData.length}개`);
  console.log(`- 미분류 데이터: ${unclassifiedData.length}개`);
  console.log(`- 채널 데이터: ${channelsData.length}개`);
  console.log(`- 영상 데이터: ${videosData.length}개`);
  console.log(`- 일별 진행률: ${dailyProgress.length}일`);
  
  // IndexedDB에 저장
  await saveToIndexedDB('classifiedData', classifiedData);
  await saveToIndexedDB('unclassifiedData', unclassifiedData);
  await saveToIndexedDB('channels', channelsData);
  await saveToIndexedDB('videos', videosData);
  await saveToIndexedDB('dailyProgress', dailyProgress);
  await saveToIndexedDB('dailySummary', dailySummary);
  
  console.log('✅ 모든 데이터 IndexedDB에 저장 완료');
  console.log('🎉 백업 복원 완료!');
  console.log('🔄 페이지를 새로고침하면 복원된 데이터를 확인할 수 있습니다.');
}

// IndexedDB에 데이터 저장하는 함수
async function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB', 10);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      // 기존 데이터 삭제
      store.clear();
      
      // 새 데이터 추가
      if (Array.isArray(data)) {
        data.forEach(item => {
          store.add(item);
        });
      } else {
        store.add(data);
      }
      
      transaction.oncomplete = function() {
        console.log(`✅ ${storeName}에 ${Array.isArray(data) ? data.length : 1}개 데이터 저장 완료`);
        resolve();
      };
      
      transaction.onerror = function() {
        console.error(`❌ ${storeName} 저장 실패:`, transaction.error);
        reject(transaction.error);
      };
    };
    
    request.onerror = function() {
      console.error('❌ IndexedDB 열기 실패');
      reject(request.error);
    };
  });
}
