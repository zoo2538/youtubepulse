async function checkAllDates() {
  try {
    console.log('\n=== 서버 전체 날짜별 데이터 확인 ===\n');
    
    const response = await fetch('https://api.youthbepulse.com/api/unclassified?days=7');
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('API 응답 실패');
    }
    
    const allData = result.data;
    console.log(`📊 전체 데이터: ${allData.length}개\n`);
    
    // 날짜별 + 타입별 분포
    const dateTypeCount = {};
    allData.forEach(item => {
      const dayKey = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      if (dayKey) {
        const date = dayKey.split('T')[0];
        const type = item.collectionType || 'unknown';
        
        if (!dateTypeCount[date]) {
          dateTypeCount[date] = { manual: 0, auto: 0, total: 0 };
        }
        
        if (type === 'manual') {
          dateTypeCount[date].manual++;
        } else if (type === 'auto') {
          dateTypeCount[date].auto++;
        }
        dateTypeCount[date].total++;
      }
    });
    
    // 날짜순 정렬
    const sortedDates = Object.entries(dateTypeCount).sort((a, b) => b[0].localeCompare(a[0]));
    
    console.log('📅 날짜별 데이터 분포:\n');
    sortedDates.forEach(([date, counts]) => {
      console.log(`${date}:`);
      console.log(`  전체: ${counts.total}개`);
      console.log(`  🤖 자동: ${counts.auto}개`);
      console.log(`  ✋ 수동: ${counts.manual}개`);
      console.log('');
    });
    
    // 10월 12일 특별 확인
    if (dateTypeCount['2025-10-12']) {
      console.log('\n⚠️ 10월 12일 데이터 상세:');
      const oct12 = dateTypeCount['2025-10-12'];
      console.log(`  전체: ${oct12.total}개`);
      console.log(`  자동수집: ${oct12.auto}개`);
      console.log(`  수동수집: ${oct12.manual}개`);
      
      if (oct12.manual === 0) {
        console.log('\n❌ 10월 12일 수동수집 데이터가 서버에 없습니다!');
        console.log('   → 수동수집을 다시 하거나');
        console.log('   → 로컬(IndexedDB)에 데이터가 있다면 "진행률 일괄저장하기"를 클릭해주세요');
      }
    } else {
      console.log('\n❌ 10월 12일 데이터가 전혀 없습니다!');
    }
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

checkAllDates();

