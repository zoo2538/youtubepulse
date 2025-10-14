const https = require('https');

function triggerAutoCollect() {
  const options = {
    hostname: 'api.youthbepulse.com',
    path: '/api/auto-collect',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('\n📊 자동 수집 실행 결과\n');
        console.log('═════════════════════════════════════');
        console.log('✅ 응답:', JSON.stringify(result, null, 2));
        console.log('═════════════════════════════════════\n');
      } catch (error) {
        console.error('❌ JSON 파싱 오류:', error.message);
        console.log('📄 응답 데이터:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ API 호출 실패:', error.message);
  });
  
  // 요청 본문 (빈 객체)
  req.write(JSON.stringify({}));
  req.end();
}

console.log('🚀 자동 수집 수동 실행 중...\n');
console.log('⚠️ 이 작업은 몇 분 정도 걸릴 수 있습니다.\n');

triggerAutoCollect();

