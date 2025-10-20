// API 테스트 스크립트

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 API 테스트 시작...');
  
  try {
    // 1. 헬스체크 테스트
    console.log('1️⃣ 헬스체크 테스트...');
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ 헬스체크 성공:', healthData);
    
    // 2. GET 엔드포인트 테스트
    console.log('2️⃣ GET /api/unclassified 테스트...');
    const getResponse = await fetch(`${BASE_URL}/api/unclassified`);
    const getData = await getResponse.json();
    console.log('✅ GET 성공:', getData);
    
    // 3. POST 엔드포인트 테스트
    console.log('3️⃣ POST /api/unclassified 테스트...');
    const testData = [{
      videoId: 'test123',
      channelId: 'test_channel',
      videoTitle: 'Test Video',
      viewCount: 1000,
      dayKeyLocal: '2025-10-20'
    }];
    
    const postResponse = await fetch(`${BASE_URL}/api/unclassified`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const postData = await postResponse.json();
    console.log('✅ POST 성공:', postData);
    
    console.log('🎉 모든 API 테스트 완료!');
    
  } catch (error) {
    console.error('❌ API 테스트 실패:', error.message);
  }
}

testAPI();
