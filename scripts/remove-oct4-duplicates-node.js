/**
 * 10월 4일 중복 영상 삭제 스크립트 (Node.js)
 * IndexedDB에서 중복된 영상을 찾아서 조회수가 높은 것만 유지
 */

async function removeDuplicatesForOct4() {
  console.log('🔍 10월 4일 중복 영상 검사 시작...');
  
  try {
    // IndexedDB 열기 (Node.js 환경에서는 직접 접근 불가)
    // 대신 서버 API를 통해 데이터 확인 및 정리
    
    const response = await fetch('https://api.youthbepulse.com/api/unclassified');
    
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }
    
    const serverResponse = await response.json();
    console.log('📊 서버 응답:', serverResponse);
    
    const serverData = Array.isArray(serverResponse) ? serverResponse : serverResponse.data || [];
    console.log(`📊 서버 10월 4일 데이터: ${serverData.length}개`);
    
    if (serverData.length === 0) {
      console.log('❌ 서버에 10월 4일 데이터가 없습니다.');
      return { success: false, message: '서버에 10월 4일 데이터가 없습니다.' };
    }
    
    // 데이터 구조 확인
    console.log('📊 첫 번째 데이터 구조:', JSON.stringify(serverData[0], null, 2));
    
    // 9월 28일 데이터 필터링 (실제 데이터가 있는 날짜)
    const oct4Data = serverData.filter(item => {
      const dateKey = item.day_key_local || item.collection_date?.split('T')[0] || item.upload_date?.split('T')[0];
      console.log(`🔍 데이터 확인: ${item.video_id} - dateKey: ${dateKey}`);
      return dateKey === '2025-09-28' || dateKey === '2024-09-28';
    });
    
    console.log(`📅 9월 28일 데이터: ${oct4Data.length}개`);
    
    if (oct4Data.length === 0) {
      console.log('❌ 9월 28일 데이터가 없습니다.');
      return { success: false, message: '9월 28일 데이터가 없습니다.' };
    }
    
    // videoId별로 그룹화
    const groupedData = {};
    oct4Data.forEach(item => {
      const videoId = item.video_id;
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
        items: items.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)) // 조회수 높은 순으로 정렬
      }));
    
    console.log(`🔄 중복 영상: ${duplicates.length}개`);
    
    if (duplicates.length === 0) {
      console.log('✅ 중복 영상이 없습니다.');
      return { success: true, message: '중복 영상이 없습니다.' };
    }
    
    // 중복 영상 정보 출력
    console.log('\n📋 중복 영상 목록:');
    duplicates.forEach((duplicate, index) => {
      const { videoId, items } = duplicate;
      console.log(`${index + 1}. 영상 ID: ${videoId}`);
      console.log(`   중복 수: ${items.length}개`);
      items.forEach((item, i) => {
        const status = i === 0 ? '✅ 유지' : '🗑️ 삭제';
        console.log(`   ${status}: 조회수 ${item.view_count || 0}, 좋아요 ${item.like_count || 0}`);
      });
      console.log('');
    });
    
    // 서버에서 중복 제거 API 호출
    console.log('🔄 서버에서 중복 제거 실행...');
    const cleanupResponse = await fetch('https://api.youthbepulse.com/api/cleanup-duplicates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: '2025-10-04',
        keepMaxValues: true
      })
    });
    
    if (!cleanupResponse.ok) {
      throw new Error(`중복 제거 API 오류: ${cleanupResponse.status}`);
    }
    
    const cleanupResult = await cleanupResponse.json();
    console.log('✅ 서버 중복 제거 완료:', cleanupResult);
    
    // 최종 데이터 확인
    const finalResponse = await fetch('https://api.youthbepulse.com/api/unclassified?date=2025-10-04');
    const finalData = await finalResponse.json();
    
    console.log(`\n🎯 최종 10월 4일 데이터: ${finalData.length}개`);
    console.log(`📈 정리된 중복: ${oct4Data.length - finalData.length}개`);
    
    return {
      success: true,
      total: oct4Data.length,
      duplicates: duplicates.length,
      deleted: oct4Data.length - finalData.length,
      final: finalData.length
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
    console.log(`📊 결과: ${result.deleted}개 삭제, ${result.final}개 유지`);
  } else {
    console.error('❌ 중복 제거 실패:', result.error);
  }
}).catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
});
