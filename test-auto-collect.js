// 자동 수집 테스트 스크립트
import https from 'https';

async function testAutoCollect() {
  try {
    console.log('🤖 자동 수집 테스트 시작...\n');
    
    const options = {
      hostname: 'api.youthbepulse.com',
      port: 443,
      path: '/api/auto-collect',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
          console.log('📊 자동 수집 결과:');
          console.log('='.repeat(60));
          console.log(`✅ 성공: ${result.success}`);
          console.log(`📝 메시지: ${result.message}`);
          
          if (result.error) {
            console.log('\n❌ 오류 발생:');
            console.log(`  오류: ${result.error}`);
          }
          
          if (result.success) {
            console.log('\n🎉 자동 수집이 성공적으로 실행되었습니다!');
          } else {
            console.log('\n⚠️ 자동 수집에 문제가 있습니다.');
          }
          
        } catch (parseError) {
          console.error('❌ JSON 파싱 오류:', parseError.message);
          console.log('📄 원본 응답:', data);
          
          // HTML 응답인 경우 (GitHub Pages 리다이렉트)
          if (data.includes('<!DOCTYPE html>')) {
            console.log('\n⚠️ 서버가 아직 GitHub Pages로 리다이렉트되고 있습니다.');
            console.log('   Railway 배포가 완료될 때까지 기다려주세요.');
          }
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 자동 수집 요청 오류:', error.message);
    });

    req.setTimeout(30000, () => {
      console.error('❌ 자동 수집 요청 시간 초과 (30초)');
      req.destroy();
    });

    req.end();
    
  } catch (error) {
    console.error('❌ 자동 수집 테스트 스크립트 오류:', error.message);
  }
}

testAutoCollect();
