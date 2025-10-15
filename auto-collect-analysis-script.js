/**
 * 자동수집 로그 및 중복 호출 분석 스크립트
 */

console.log('🔍 자동수집 분석 시작...\n');

// 1. 서버에서 자동수집 데이터 가져오기
async function analyzeAutoCollection() {
  try {
    console.log('📊 1. 자동수집 데이터 조회 중...');
    const response = await fetch('https://api.youthbepulse.com/api/auto-collected');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('데이터 조회 실패');
    }
    
    const data = result.data;
    console.log(`✅ 총 ${data.length}개 데이터 로드\n`);
    
    // 2. 날짜별 그룹화
    console.log('📅 2. 날짜별 분석...');
    const dateGroups = {};
    data.forEach(item => {
      const date = item.day_key_local || item.collection_date || 'unknown';
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(item);
    });
    
    const dates = Object.keys(dateGroups).sort().reverse();
    console.log(`✅ ${dates.length}개 날짜 발견\n`);
    
    // 최근 3일만 분석
    const recentDates = dates.slice(0, 3);
    
    for (const date of recentDates) {
      const dateData = dateGroups[date];
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📅 날짜: ${date}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // 3. videoId 중복 확인
      const videoIds = dateData.map(item => item.video_id);
      const uniqueVideoIds = new Set(videoIds);
      const duplicates = videoIds.length - uniqueVideoIds.size;
      
      console.log(`\n📹 비디오 중복 분석:`);
      console.log(`  - 전체 레코드: ${videoIds.length}개`);
      console.log(`  - 고유 비디오: ${uniqueVideoIds.size}개`);
      console.log(`  - 중복 건수: ${duplicates}개`);
      
      if (duplicates > 0) {
        console.log(`  ⚠️ 중복이 ${duplicates}개 발견됨!`);
        
        // 중복된 비디오 찾기
        const videoIdCount = {};
        videoIds.forEach(id => {
          videoIdCount[id] = (videoIdCount[id] || 0) + 1;
        });
        
        const duplicatedVideos = Object.entries(videoIdCount)
          .filter(([id, count]) => count > 1)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        console.log(`\n  🔍 중복 TOP 5:`);
        duplicatedVideos.forEach(([videoId, count]) => {
          const video = dateData.find(item => item.video_id === videoId);
          console.log(`    - ${videoId} (${count}회): ${video?.video_title?.substring(0, 30)}...`);
        });
      } else {
        console.log(`  ✅ 중복 없음!`);
      }
      
      // 4. 키워드 분석
      console.log(`\n🔍 키워드 분석:`);
      const keywords = {};
      dateData.forEach(item => {
        const keyword = item.keyword || item.searchKeyword || 'trending';
        keywords[keyword] = (keywords[keyword] || 0) + 1;
      });
      
      const keywordList = Object.entries(keywords)
        .sort((a, b) => b[1] - a[1]);
      
      console.log(`  - 사용된 키워드 수: ${keywordList.length}개`);
      console.log(`  - 예상 키워드 수: 75개 (+ trending)`);
      
      if (keywordList.length < 50) {
        console.log(`  ⚠️ 키워드가 ${75 - keywordList.length + 1}개 부족함!`);
      } else {
        console.log(`  ✅ 대부분의 키워드가 실행됨`);
      }
      
      console.log(`\n  🏆 TOP 10 키워드:`);
      keywordList.slice(0, 10).forEach(([keyword, count]) => {
        console.log(`    - ${keyword}: ${count}개`);
      });
      
      // 5. 수집 타입 확인
      console.log(`\n📦 수집 타입:`);
      const collectionTypes = {};
      dateData.forEach(item => {
        const type = item.collection_type || 'unknown';
        collectionTypes[type] = (collectionTypes[type] || 0) + 1;
      });
      
      Object.entries(collectionTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}개`);
      });
      
      // 6. API 요청 수 추정
      console.log(`\n📊 API 요청 수 추정:`);
      const estimatedSearchCalls = keywordList.length - 1; // trending 제외
      const estimatedVideosCalls = keywordList.length; // 모든 키워드 + trending
      const estimatedChannelCalls = Math.ceil([...new Set(dateData.map(item => item.channel_id))].length / 50);
      
      console.log(`  - search.list: ~${estimatedSearchCalls}회 (${estimatedSearchCalls * 100} units)`);
      console.log(`  - videos.list: ~${estimatedVideosCalls}회 (${estimatedVideosCalls} units)`);
      console.log(`  - channels.list: ~${estimatedChannelCalls}회 (${estimatedChannelCalls} units)`);
      
      const totalUnits = (estimatedSearchCalls * 100) + estimatedVideosCalls + estimatedChannelCalls;
      console.log(`  ────────────────────────────────`);
      console.log(`  📊 총 예상 할당량: ~${totalUnits} units`);
      console.log(`  📊 일일 할당량 비율: ${Math.round(totalUnits / 10000 * 100)}%`);
    }
    
    // 7. 전체 요약
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 전체 요약`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`총 데이터: ${data.length}개`);
    console.log(`날짜 범위: ${dates[dates.length - 1]} ~ ${dates[0]}`);
    console.log(`분석 날짜: ${recentDates.length}개 (최근 3일)`);
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
  }
}

// 실행
analyzeAutoCollection().then(() => {
  console.log('\n✅ 분석 완료');
}).catch(error => {
  console.error('❌ 오류:', error);
});

