// Railway 배포 상태 확인 스크립트
import https from 'https';

async function checkDeploymentStatus() {
  try {
    console.log('🔍 Railway 배포 상태 확인 중...\n');
    
    const options = {
      hostname: 'api.youthbepulse.com',
      port: 443,
      path: '/api/health',
      method: 'GET',
      headers: {
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
          console.log('✅ 서버 상태:', result);
          
          if (result.status === 'healthy') {
            console.log('\n🎉 Railway 배포 완료! 스키마 수정을 진행합니다...\n');
            fixDatabaseSchema();
          } else {
            console.log('\n⏳ 서버가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
          }
          
        } catch (parseError) {
          console.error('❌ JSON 파싱 오류:', parseError.message);
          console.log('📄 원본 응답:', data);
          console.log('\n⏳ 서버가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 요청 오류:', error.message);
      console.log('\n⏳ 서버가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
    });

    req.setTimeout(10000, () => {
      console.error('❌ 요청 시간 초과 (10초)');
      req.destroy();
    });

    req.end();
    
  } catch (error) {
    console.error('❌ 스크립트 오류:', error.message);
  }
}

async function fixDatabaseSchema() {
  try {
    console.log('🔧 데이터베이스 스키마 수정 시작...\n');
    
    const options = {
      hostname: 'api.youthbepulse.com',
      port: 443,
      path: '/api/database/fix-schema',
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
          console.log('📊 스키마 수정 결과:');
          console.log('='.repeat(60));
          console.log(`✅ 성공: ${result.success}`);
          console.log(`📝 메시지: ${result.message}`);
          
          if (result.changes) {
            console.log('\n🔧 적용된 변경사항:');
            result.changes.forEach((change, index) => {
              console.log(`  ${index + 1}. ${change}`);
            });
          }
          
          console.log('\n🎉 스키마 수정 완료! 이제 자동 수집이 정상 작동할 것입니다.');
          console.log('⏰ 다음 오전 9시에 자동 수집이 실행됩니다.');
          
        } catch (parseError) {
          console.error('❌ JSON 파싱 오류:', parseError.message);
          console.log('📄 원본 응답:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 스키마 수정 요청 오류:', error.message);
    });

    req.setTimeout(15000, () => {
      console.error('❌ 스키마 수정 요청 시간 초과 (15초)');
      req.destroy();
    });

    req.end();
    
  } catch (error) {
    console.error('❌ 스키마 수정 스크립트 오류:', error.message);
  }
}

checkDeploymentStatus();
