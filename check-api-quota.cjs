#!/usr/bin/env node

const https = require('https');

// 환경 변수에서 API 키 가져오기 (로컬 테스트용)
const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyAPfuItH_nh45ErxJRgP0j6_pQPBZUsVY4';

console.log('🔍 YouTube API 할당량 확인 중...\n');
console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...\n`);

// 간단한 검색 요청으로 할당량 확인
const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${apiKey}`;

console.log('📡 API 테스트 요청 전송...');
const startTime = Date.now();

https.get(testUrl, (res) => {
  const endTime = Date.now();
  let data = '';

  res.on('data', (chunk) => data += chunk);
  
  res.on('end', () => {
    const duration = endTime - startTime;
    
    console.log('═══════════════════════════════════════');
    console.log(`📊 응답 시간: ${duration}ms`);
    console.log(`📊 HTTP 상태: ${res.statusCode} ${res.statusMessage}`);
    console.log('═══════════════════════════════════════\n');
    
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        console.log('✅ API 정상 작동 중입니다!');
        console.log('✅ 할당량이 소진되지 않았습니다.\n');
      } catch (e) {
        console.log('⚠️  응답 파싱 실패');
      }
    } else if (res.statusCode === 403) {
      console.log('❌ 403 Forbidden - API 키 문제 발생!\n');
      console.log('가능한 원인:');
      console.log('1. API 키가 제한되어 있음 (IP/Domain 제한)');
      console.log('2. YouTube Data API v3가 활성화되지 않음');
      console.log('3. API 키가 만료되었거나 잘못됨\n');
      
      try {
        const result = JSON.parse(data);
        if (result.error) {
          console.log('상세 오류:', result.error.message);
        }
      } catch (e) {
        console.log('원본 응답:', data.substring(0, 500));
      }
    } else if (res.statusCode === 429) {
      console.log('❌ 429 Too Many Requests - 할당량 초과!\n');
      console.log('✅ YouTube API 할당량(10,000)을 모두 사용했습니다.');
      console.log('⏰ 할당량은 UTC 기준 자정(한국시간 오전 9시)에 리셋됩니다.');
    } else {
      console.log(`⚠️  예상치 못한 상태 코드: ${res.statusCode}`);
      console.log('응답:', data.substring(0, 500));
    }
    
    console.log('\n═══════════════════════════════════════');
  });
}).on('error', (error) => {
  console.error('❌ 네트워크 오류:', error.message);
});
