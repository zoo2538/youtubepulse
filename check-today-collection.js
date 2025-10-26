#!/usr/bin/env node

const https = require('https');

console.log('🔍 오늘(2025-10-26) 수집 데이터 확인 중...\n');

https.get('https://api.youthbepulse.com/api/unclassified?date=2025-10-26', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      console.log('═══════════════════════════════════════');
      console.log(`📊 수집된 데이터: ${result.length}개`);
      console.log('═══════════════════════════════════════\n');
      
      if (result.length === 0) {
        console.log('⚠️  오늘 수집된 데이터가 없습니다.');
        console.log('\n가능한 원인:');
        console.log('1. 크론잡이 아직 실행되지 않음 (09:00 KST)');
        console.log('2. YouTube API 할당량 초과');
        console.log('3. 데이터 수집 중 오류 발생');
      } else {
        console.log('✅ 다음은 수집된 데이터 샘플입니다:\n');
        result.slice(0, 5).forEach((item, index) => {
          console.log(`${index + 1}. ${item.channelName || item.channel_name || 'N/A'}`);
          console.log(`   제목: ${item.videoTitle || item.video_title || 'N/A'}`);
          console.log(`   조회수: ${item.viewCount || item.view_count || 0}`);
          console.log('');
        });
      }
      
      console.log('═══════════════════════════════════════');
    } catch (error) {
      console.error('❌ 응답 파싱 실패:', error.message);
      console.log('원본 응답:', data.substring(0, 500));
    }
  });
}).on('error', (error) => {
  console.error('❌ API 호출 실패:', error.message);
});
