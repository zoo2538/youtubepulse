// 완전한 백업 복원 스크립트 (JSON 데이터 포함)
(async function completeRestore() {
  console.log('🔄 완전한 백업 복원 시작...');
  
  try {
    // 백업 JSON 파일 내용 (실제 파일 내용)
    const backupData = {
      "exportDate": "2025-10-02T16:20:36.624Z",
      "exportType": "dateRange",
      "dateRange": {
        "from": "2025-09-27",
        "to": "2025-10-03"
      },
      "totalDates": 7,
      "totalVideos": 19788,
      "totalClassified": 14508,
      "totalUnclassified": 5280,
      "dailyData": [
        {
          "date": "2025-10-03",
          "total": 190,
          "classified": 45,
          "unclassified": 145,
          "progress": 24,
          "data": [
            {
              "id": "1759421625378_07prjheu1_18994",
              "channelId": "UCy2fRv1YU0uDaw6gkIjhbag",
              "channelName": "슈샤's",
              "description": "U111D8@AICOMPANY",
              "videoId": "dkHBrnxPUao",
              "videoTitle": "야구 경기 중 나온 더블 실수!!feat 조수행 #야구 #스포츠 #이슈 #shorts",
              "videoDescription": "*구독,좋아요,알림설정은 필수!*\n   KBO 및 프로야구 및 모든 스포츠에 대한 \n   정보와 이슈를 유익하고 재미있게 전달해드리겠습니다 !\n===============================================\n#프로야구 #kbo리그 #야구하이라이트 #최강야구 #이슈 #스포츠 #shorts",
              "viewCount": 19042,
              "uploadDate": "2025-01-13",
              "collectionDate": "2025-10-03",
              "thumbnailUrl": "https://i.ytimg.com/vi/dkHBrnxPUao/hqdefault.jpg",
              "category": "",
              "subCategory": "",
              "status": "unclassified"
            }
            // 여기에 나머지 데이터들이 들어갑니다
            // 실제로는 전체 JSON 파일의 dailyData 배열을 여기에 붙여넣어야 합니다
          ]
        }
        // 다른 날짜들의 데이터도 여기에 추가됩니다
      ]
    };
    
    console.log('📊 백업 데이터 요약:');
    console.log(`- 내보내기 날짜: ${backupData.exportDate}`);
    console.log(`- 날짜 범위: ${backupData.dateRange.from} ~ ${backupData.dateRange.to}`);
    console.log(`- 총 영상: ${backupData.totalVideos}개`);
    console.log(`- 분류된 영상: ${backupData.totalClassified}개`);
    console.log(`- 미분류 영상: ${backupData.totalUnclassified}개`);
    console.log(`- 일별 데이터: ${backupData.dailyData.length}일`);
    
    // IndexedDB에 데이터 저장
    await restoreToIndexedDB(backupData);
    
    console.log('🎉 완전한 백업 복원 완료!');
    console.log('🔄 페이지를 새로고침하면 복원된 데이터를 확인할 수 있습니다.');
    
  } catch (error) {
    console.error('❌ 복원 실패:', error);
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
  backupData.dailyData.forEach(dayData => {
    console.log(`📅 ${dayData.date} 처리 중: ${dayData.total}개 영상`);
    
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
    dayData.data.forEach(video => {
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
}

// IndexedDB에 데이터 저장하는 함수
async function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('YouTubePulseDB');
    
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
