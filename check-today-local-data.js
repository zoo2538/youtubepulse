// 오늘 로컬 IndexedDB 데이터 확인 스크립트
console.log('=== 오늘 로컬 데이터 수집 현황 확인 ===');

// 현재 시간 (Asia/Seoul 기준)
const now = new Date();
const seoulTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
const today = seoulTime.toISOString().split('T')[0];

console.log(`📅 오늘 날짜 (Asia/Seoul): ${today}`);
console.log(`⏰ 현재 시간: ${seoulTime.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}`);

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
        
        // 오늘 날짜 데이터 필터링
        const todayData = allData.filter(item => {
          const itemDate = item.dayKeyLocal || 
                          (item.collectionDate || item.uploadDate)?.split('T')[0] || 
                          item.date;
          return itemDate === today;
        });
        
        console.log(`📅 오늘(${today}) 수집된 데이터: ${todayData.length}개`);
        
        if (todayData.length > 0) {
          // 수집 타입별 통계
          const collectionTypeStats = {};
          todayData.forEach(item => {
            const type = item.collectionType || 'manual';
            collectionTypeStats[type] = (collectionTypeStats[type] || 0) + 1;
          });
          
          console.log('📊 수집 타입별 통계:', collectionTypeStats);
          
          // 자동 수집 데이터 확인
          const autoData = todayData.filter(item => item.collectionType === 'auto');
          console.log(`🤖 오늘 자동 수집된 데이터: ${autoData.length}개`);
          
          if (autoData.length > 0) {
            console.log('✅ 오늘 자동 수집이 실행되었습니다!');
            
            // 자동 수집 시간 확인
            const autoTimes = autoData.map(item => item.createdAt || item.timestamp).filter(Boolean);
            if (autoTimes.length > 0) {
              const latestAuto = new Date(Math.max(...autoTimes.map(t => new Date(t))));
              console.log(`⏰ 마지막 자동 수집 시간: ${latestAuto.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}`);
            }
          } else {
            console.log('❌ 오늘 자동 수집된 데이터가 없습니다.');
          }
          
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
            const date = new Date(seoulTime);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            last7Days.push(dateStr);
          }
          
          console.log('📅 최근 7일 데이터 현황:');
          last7Days.forEach(date => {
            const dateData = allData.filter(item => {
              const itemDate = item.dayKeyLocal || 
                              (item.collectionDate || item.uploadDate)?.split('T')[0] || 
                              item.date;
              return itemDate === date;
            });
            const autoCount = dateData.filter(item => item.collectionType === 'auto').length;
            const manualCount = dateData.filter(item => item.collectionType === 'manual').length;
            const dayLabel = i === 0 ? ' (오늘)' : '';
            console.log(`  ${date}${dayLabel}: 전체 ${dateData.length}개 (자동 ${autoCount}개, 수동 ${manualCount}개)`);
          });
          
          // 상위 조회수 영상들
          const topVideos = todayData
            .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
            .slice(0, 5);
          
          console.log('🏆 오늘 상위 조회수 영상 TOP 5:');
          topVideos.forEach((video, index) => {
            console.log(`  ${index + 1}. ${video.videoTitle} - ${(video.viewCount || 0).toLocaleString()}회`);
          });
        } else {
          console.log('❌ 오늘 수집된 데이터가 없습니다.');
        }
        
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
