const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function checkOct12Data() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 10월 12일 데이터 확인');
    console.log('='.repeat(80));

    // 1. 서버 데이터 확인 (전체)
    console.log('\n📡 서버 데이터 조회 중...');
    const serverResponse = await makeRequest('https://api.youthbepulse.com/api/unclassified');
    
    if (serverResponse.success && serverResponse.data) {
      const allData = serverResponse.data;
      console.log(`✅ 서버 전체 데이터: ${allData.length}개`);
      
      // 10월 12일 데이터 필터링
      const oct12Data = allData.filter(item => {
        const dayKey = item.dayKeyLocal || item.day_key_local || item.collectionDate || item.collection_date;
        return dayKey && dayKey.startsWith('2025-10-12');
      });
      
      console.log(`📅 10월 12일 데이터: ${oct12Data.length}개`);
      
      if (oct12Data.length > 0) {
        // collectionType별 분류
        const typeStats = {
          auto: 0,
          manual: 0,
          undefined: 0
        };
        
        oct12Data.forEach(item => {
          const type = item.collectionType || item.collection_type || 'undefined';
          if (type === 'auto') typeStats.auto++;
          else if (type === 'manual') typeStats.manual++;
          else typeStats.undefined++;
        });
        
        console.log(`\n📊 수집 타입별 통계:`);
        console.log(`   - 자동수집 (auto): ${typeStats.auto}개`);
        console.log(`   - 수동수집 (manual): ${typeStats.manual}개`);
        console.log(`   - 타입 없음: ${typeStats.undefined}개`);
        
        // dayKeyLocal 형식 확인
        const sampleItems = oct12Data.slice(0, 3);
        console.log(`\n📋 샘플 데이터 (3개):`);
        sampleItems.forEach((item, idx) => {
          console.log(`\n   ${idx + 1}.`);
          console.log(`      dayKeyLocal: ${item.dayKeyLocal || item.day_key_local}`);
          console.log(`      collectionDate: ${item.collectionDate || item.collection_date}`);
          console.log(`      collectionType: ${item.collectionType || item.collection_type}`);
          console.log(`      videoId: ${item.videoId || item.video_id}`);
          console.log(`      title: ${(item.videoTitle || item.video_title || '').substring(0, 40)}...`);
        });
      } else {
        console.log('\n⚠️ 10월 12일 데이터가 서버에 없습니다!');
      }
    } else {
      console.log('❌ 서버 데이터 조회 실패:', serverResponse);
    }
    
    // 2. 자동수집 전용 API 확인
    console.log('\n' + '='.repeat(80));
    console.log('🤖 자동수집 API 확인');
    console.log('='.repeat(80));
    
    const autoResponse = await makeRequest('https://api.youthbepulse.com/api/auto-collected?since=2025-10-12');
    
    if (autoResponse.success && autoResponse.data) {
      const autoData = autoResponse.data;
      const oct12Auto = autoData.filter(item => {
        const dayKey = item.dayKeyLocal || item.day_key_local || item.collectionDate || item.collection_date;
        return dayKey && dayKey.startsWith('2025-10-12');
      });
      
      console.log(`🤖 자동수집 API - 10월 12일: ${oct12Auto.length}개`);
      
      if (oct12Auto.length > 0) {
        // 키워드 통계
        const keywordStats = {};
        oct12Auto.forEach(item => {
          const keyword = item.keyword || 'trending';
          keywordStats[keyword] = (keywordStats[keyword] || 0) + 1;
        });
        
        console.log(`\n📊 키워드 분포:`);
        Object.entries(keywordStats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([keyword, count]) => {
            console.log(`   - ${keyword}: ${count}개`);
          });
      }
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  }
}

checkOct12Data();

