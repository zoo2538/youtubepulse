// YouTube API 키 사용량 확인 스크립트
import https from 'https';

async function checkApiUsage() {
  try {
    console.log('🔍 YouTube API 키 사용량 확인 중...\n');
    
    // Google Cloud Console API 사용량 확인
    // 참고: 실제로는 Google Cloud Console에서 확인해야 함
    console.log('📊 API 사용량 확인 방법:');
    console.log('='.repeat(60));
    console.log('1. Google Cloud Console 접속:');
    console.log('   https://console.cloud.google.com/');
    console.log('');
    console.log('2. 프로젝트 선택 후 "APIs & Services" → "Quotas"');
    console.log('');
    console.log('3. YouTube Data API v3 검색');
    console.log('');
    console.log('4. "Queries per day" 메트릭 확인');
    console.log('   - 현재 사용량: X / 10,000 units');
    console.log('   - 리셋 시간: UTC 00:00 (한국시간 09:00)');
    console.log('');
    
    // 자동수집 코드에서 예상 사용량 계산
    console.log('📈 자동수집 예상 API 사용량:');
    console.log('-'.repeat(40));
    
    // 1. 트렌딩 비디오 (4페이지)
    const trendingCalls = 4;
    const trendingUnits = trendingCalls * 1; // videos.list = 1 unit per call
    console.log(`1. 트렌딩 비디오: ${trendingCalls} calls × 1 unit = ${trendingUnits} units`);
    
    // 2. 키워드 검색 (75개 키워드)
    const keywordCount = 75;
    const searchUnits = keywordCount * 100; // search.list = 100 units per call
    const videoDetailUnits = keywordCount * 1; // videos.list = 1 unit per call
    const keywordTotal = searchUnits + videoDetailUnits;
    console.log(`2. 키워드 검색: ${keywordCount} keywords`);
    console.log(`   - search.list: ${keywordCount} × 100 units = ${searchUnits} units`);
    console.log(`   - videos.list: ${keywordCount} × 1 unit = ${videoDetailUnits} units`);
    console.log(`   - 키워드 총합: ${keywordTotal} units`);
    
    // 3. 채널 정보 (추정)
    const channelCalls = 15; // 50개씩 배치로 처리
    const channelUnits = channelCalls * 1; // channels.list = 1 unit per call
    console.log(`3. 채널 정보: ${channelCalls} calls × 1 unit = ${channelUnits} units`);
    
    // 총 사용량
    const totalUnits = trendingUnits + keywordTotal + channelUnits;
    const percentage = ((totalUnits / 10000) * 100).toFixed(1);
    
    console.log('');
    console.log('📊 총 예상 사용량:');
    console.log('='.repeat(40));
    console.log(`총 API Units: ${totalUnits.toLocaleString()} / 10,000`);
    console.log(`사용률: ${percentage}%`);
    console.log(`남은 할당량: ${(10000 - totalUnits).toLocaleString()} units`);
    
    if (totalUnits > 10000) {
      console.log('🚨 경고: 할당량 초과! (10,000 units 초과)');
    } else if (totalUnits > 8000) {
      console.log('⚠️ 주의: 할당량 80% 이상 사용');
    } else {
      console.log('✅ 정상: 할당량 여유 있음');
    }
    
    console.log('');
    console.log('🕐 할당량 리셋 시간:');
    console.log('-'.repeat(30));
    console.log('UTC: 00:00 (매일)');
    console.log('한국시간: 09:00 (매일)');
    console.log('다음 리셋까지: 약 X시간 남음');
    
    console.log('');
    console.log('💡 최적화 제안:');
    console.log('-'.repeat(30));
    console.log('1. 키워드 수 줄이기: 75개 → 20개 (73% 절감)');
    console.log('2. 배치 분산: 요일별로 다른 키워드 그룹 사용');
    console.log('3. 캐싱 도입: 중복 검색 결과 캐싱');
    console.log('4. 새 API 키 추가: 할당량 2배 확보');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

checkApiUsage();
