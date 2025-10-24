// 수동 자동수집 트리거 스크립트
const https = require('https');

const options = {
  hostname: 'youthbepulse.com',
  port: 443,
  path: '/api/auto-collect',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': 2
  }
};

console.log('🚀 수동 자동수집 트리거 시작...');

const req = https.request(options, (res) => {
  console.log(`📊 응답 상태: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📋 응답 데이터:', data);
    if (res.statusCode === 200) {
      console.log('✅ 자동수집 성공!');
    } else {
      console.log('❌ 자동수집 실패');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 요청 실패:', error);
});

req.write('{}');
req.end();
