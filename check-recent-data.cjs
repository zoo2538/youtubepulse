#!/usr/bin/env node

const https = require('https');

console.log('🔍 최근 데이터 확인 중...\n');

https.get('https://api.youthbepulse.com/api/unclassified?days=7', (res) => {
  let data = '';
  
  res.on('data', (chunk) => data += chunk);
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      const dataArray = result.data || result;
      
      console.log('═══════════════════════════════════════');
      console.log(`📊 총 데이터: ${dataArray.length}개`);
      console.log('═══════════════════════════════════════\n');
      
      if (dataArray.length === 0) {
        console.log('⚠️  데이터가 없습니다.');
        return;
      }
      
      // 날짜별로 그룹화
      const byDate = {};
      dataArray.forEach(item => {
        const date = item.collectionDate || item.collection_date || item.dayKeyLocal || 'unknown';
        const dateStr = date.includes('T') ? date.split('T')[0] : date;
        byDate[dateStr] = (byDate[dateStr] || 0) + 1;
      });
      
      console.log('📅 날짜별 데이터 분포:\n');
      Object.entries(byDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([date, count]) => {
          console.log(`  ${date}: ${count}개`);
        });
      
      console.log('═══════════════════════════════════════');
    } catch (error) {
      console.error('❌ 파싱 실패:', error.message);
    }
  });
}).on('error', (error) => {
  console.error('❌ API 호출 실패:', error.message);
});
