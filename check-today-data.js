// 오늘 데이터 수집 현황 확인 스크립트
console.log('=== 오늘 데이터 수집 현황 확인 ===');

// IndexedDB에서 오늘 데이터 조회
const checkTodayData = async () => {
  try {
    const dbName = 'YouTubePulseDB';
    const request = indexedDB.open(dbName, 2);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['unclassifiedData'], 'readonly');
      const store = transaction.objectStore('unclassifiedData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allData = getAllRequest.result;
        console.log(`📊 전체 미분류 데이터: ${allData.length}개`);
        
        // 오늘 날짜 (2025-10-02) 데이터 필터링
        const today = '2025-10-02';
        const todayData = allData.filter(item => {
          const itemDate = item.collectionDate || item.uploadDate || item.date;
          return itemDate === today;
        });
        
        console.log(`📅 오늘(${today}) 수집된 데이터: ${todayData.length}개`);
        
        // 키워드별 통계
        const keywordStats = {};
        todayData.forEach(item => {
          const keyword = item.keyword || item.source || 'unknown';
          keywordStats[keyword] = (keywordStats[keyword] || 0) + 1;
        });
        
        console.log('🔍 키워드별 통계:', keywordStats);
        
        // 소스별 통계 (trending vs keyword)
        const sourceStats = {};
        todayData.forEach(item => {
          const source = item.source || 'unknown';
          sourceStats[source] = (sourceStats[source] || 0) + 1;
        });
        
        console.log('📊 소스별 통계:', sourceStats);
        
        // 최근 7일 데이터 확인
        const last7Days = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          last7Days.push(dateStr);
        }
        
        console.log('📅 최근 7일 데이터 현황:');
        last7Days.forEach(date => {
          const dateData = allData.filter(item => {
            const itemDate = item.collectionDate || item.uploadDate || item.date;
            return itemDate === date;
          });
          console.log(`  ${date}: ${dateData.length}개`);
        });
        
        // 상위 조회수 영상들
        const topVideos = todayData
          .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
          .slice(0, 10);
        
        console.log('🏆 오늘 상위 조회수 영상 TOP 10:');
        topVideos.forEach((video, index) => {
          console.log(`  ${index + 1}. ${video.videoTitle} - ${(video.viewCount || 0).toLocaleString()}회`);
        });
        
        db.close();
      };
      
      getAllRequest.onerror = () => {
        console.error('데이터 조회 실패:', getAllRequest.error);
        db.close();
      };
    };
    
    request.onerror = () => {
      console.error('IndexedDB 연결 실패:', request.error);
    };
  } catch (error) {
    console.error('스크립트 실행 오류:', error);
  }
};

// 실행
checkTodayData();
