const https = require('https');

function checkDateRange() {
  const url = 'https://api.youthbepulse.com/api/classified';
  
  https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        
        if (result.success && result.data && Array.isArray(result.data)) {
          console.log('\n📅 서버 데이터 날짜 범위 확인\n');
          console.log('═════════════════════════════════════');
          
          // 날짜별 분포
          const dateDistribution = {};
          result.data.forEach(item => {
            const date = (item.dayKeyLocal || item.collectionDate || item.uploadDate || '').split('T')[0];
            if (date) {
              dateDistribution[date] = (dateDistribution[date] || 0) + 1;
            }
          });
          
          const sortedDates = Object.keys(dateDistribution).sort();
          
          console.log(`📦 총 데이터: ${result.data.length}개`);
          console.log(`📆 총 날짜 수: ${sortedDates.length}일\n`);
          
          if (sortedDates.length > 0) {
            console.log(`🔹 가장 오래된 날짜: ${sortedDates[0]} (${dateDistribution[sortedDates[0]]}개)`);
            console.log(`🔹 가장 최근 날짜: ${sortedDates[sortedDates.length - 1]} (${dateDistribution[sortedDates[sortedDates.length - 1]]}개)\n`);
            
            const firstDate = new Date(sortedDates[0]);
            const lastDate = new Date(sortedDates[sortedDates.length - 1]);
            const daysDiff = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
            
            console.log(`📊 날짜 범위: ${daysDiff + 1}일간\n`);
            
            console.log('📋 모든 날짜 목록:\n');
            sortedDates.forEach((date, index) => {
              const count = dateDistribution[date];
              const marker = index === sortedDates.length - 1 ? '🔥' : '  ';
              console.log(`${marker} ${date}: ${count.toLocaleString()}개`);
            });
          }
          
          console.log('\n═════════════════════════════════════\n');
        }
      } catch (error) {
        console.error('❌ JSON 파싱 오류:', error.message);
      }
    });
  }).on('error', (error) => {
    console.error('❌ API 호출 실패:', error.message);
  });
}

console.log('🔍 서버 데이터 날짜 범위 확인 중...\n');
checkDateRange();

