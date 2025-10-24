// 서버 크론잡 히스토리 확인 스크립트
import https from 'https';

async function checkCronHistory() {
  try {
    console.log('🔍 서버 크론잡 히스토리 확인 중...\n');
    
    const options = {
      hostname: 'youthbepulse.com',
      port: 443,
      path: '/api/cron/history',
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
          console.log('📊 크론잡 히스토리 결과:');
          console.log('='.repeat(60));
          console.log(`✅ 서버 상태: ${result.success ? '정상' : '오류'}`);
          console.log(`📅 서버 시작 시간: ${result.serverStartTime}`);
          console.log(`⏰ 현재 시간 (KST): ${result.currentTimeKST}`);
          console.log(`📋 크론 스케줄: ${result.cronSchedule}`);
          console.log(`⏭️  다음 실행 예정: ${result.nextRunKST}`);
          console.log(`📊 히스토리 개수: ${result.historyCount}개`);
          console.log('='.repeat(60));
          
          if (result.history && result.history.length > 0) {
            console.log('\n📋 최근 자동수집 실행 이력:');
            console.log('-'.repeat(60));
            result.history.forEach((entry, index) => {
              const time = new Date(entry.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
              const status = entry.status === 'success' ? '✅' : 
                           entry.status === 'failed' ? '❌' : 
                           entry.status === 'started' ? '🔄' : '⏭️';
              console.log(`${index + 1}. ${status} ${entry.status.toUpperCase()}`);
              console.log(`   시간: ${time}`);
              console.log(`   메시지: ${entry.message}`);
              if (entry.error) {
                console.log(`   오류: ${entry.error}`);
              }
              console.log('');
            });
          } else {
            console.log('\n⚠️  자동수집 실행 이력이 없습니다.');
            console.log('   - 서버가 최근에 재시작되었거나');
            console.log('   - 자동수집이 한 번도 실행되지 않았을 수 있습니다.');
          }
          
          // 분석 결과
          console.log('\n🔍 분석 결과:');
          console.log('-'.repeat(40));
          
          if (result.historyCount === 0) {
            console.log('❌ 자동수집이 한 번도 실행되지 않았습니다.');
            console.log('   → 서버 재시작 후 크론잡이 초기화되었거나');
            console.log('   → 크론잡 설정에 문제가 있을 수 있습니다.');
          } else {
            const successCount = result.history.filter(h => h.status === 'success').length;
            const failedCount = result.history.filter(h => h.status === 'failed').length;
            const startedCount = result.history.filter(h => h.status === 'started').length;
            
            console.log(`📊 실행 통계:`);
            console.log(`   - 성공: ${successCount}회`);
            console.log(`   - 실패: ${failedCount}회`);
            console.log(`   - 시작: ${startedCount}회`);
            
            if (successCount > 0) {
              console.log('✅ 자동수집이 정상적으로 실행된 적이 있습니다.');
            } else {
              console.log('❌ 자동수집이 성공한 적이 없습니다.');
            }
          }
          
        } catch (parseError) {
          console.error('❌ JSON 파싱 오류:', parseError.message);
          console.log('📄 원본 응답:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 요청 오류:', error.message);
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

checkCronHistory();
