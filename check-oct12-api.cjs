async function checkOct12Data() {
  try {
    console.log('\n=== 10월 12일 서버 데이터 확인 (API) ===\n');
    
    // API를 통해 10월 12일 데이터 조회
    const response = await fetch('https://api.youthbepulse.com/api/unclassified?days=7');
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('API 응답 실패');
    }
    
    const allData = result.data;
    
    // 10월 12일 데이터만 필터링
    const oct12Data = allData.filter(item => {
      const dayKey = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      return dayKey && dayKey.startsWith('2025-10-12');
    });
    
    console.log(`📊 전체 데이터: ${oct12Data.length}개`);
    
    // collection_type별 분포
    const typeCount = {};
    oct12Data.forEach(item => {
      const type = item.collectionType || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    console.log('\n📈 수집 타입별 분포:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}개`);
    });
    
    // 수동수집 데이터 확인
    const manualData = oct12Data.filter(item => item.collectionType === 'manual');
    console.log(`\n✋ 수동수집 데이터: ${manualData.length}개`);
    
    if (manualData.length > 0) {
      // 키워드별 분포
      const keywordCount = {};
      manualData.forEach(item => {
        const keyword = item.keyword || item.searchKeyword || '(트렌드)';
        keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
      });
      
      console.log('\n🔍 수동수집 키워드 TOP 10:');
      const sortedKeywords = Object.entries(keywordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      sortedKeywords.forEach(([keyword, count]) => {
        console.log(`  - ${keyword}: ${count}개`);
      });
      
      // 샘플 데이터
      console.log('\n📺 수동수집 샘플 데이터 (조회수 높은 순 5개):');
      const sortedByViews = [...manualData]
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 5);
      
      sortedByViews.forEach((item, idx) => {
        const title = item.title || '(제목 없음)';
        console.log(`\n  ${idx + 1}. ${title.substring(0, 50)}...`);
        console.log(`     비디오ID: ${item.videoId}`);
        console.log(`     조회수: ${(item.viewCount || 0).toLocaleString()}`);
        console.log(`     키워드: ${item.keyword || item.searchKeyword || '(트렌드)'}`);
      });
    } else {
      console.log('⚠️ 수동수집 데이터가 없습니다!');
    }
    
    // 자동수집 데이터 확인
    const autoData = oct12Data.filter(item => item.collectionType === 'auto');
    console.log(`\n🤖 자동수집 데이터: ${autoData.length}개`);
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

checkOct12Data();

