// 키워드 기반 자동 분류된 데이터를 미분류로 변경하는 스크립트
// classificationConfidence 또는 matchedKeywords가 있는 데이터를 찾아서 unclassified로 변경

const https = require('https');

function getKoreanDateString() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
}

async function resetKeywordClassification() {
  const API_BASE_URL = 'https://api.youthbepulse.com';
  
  console.log('🔄 키워드 기반 자동 분류 데이터 초기화 시작...\n');
  
  try {
    // 1. 서버에서 모든 unclassified 데이터 가져오기
    console.log('📥 서버에서 데이터 로드 중...');
    const response = await new Promise((resolve, reject) => {
      https.get(`${API_BASE_URL}/api/unclassified`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(JSON.parse(data));
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
    
    if (!response.success || !response.data || response.data.length === 0) {
      console.log('❌ 서버 데이터 없음');
      return;
    }
    
    const allData = response.data;
    console.log(`✅ 전체 데이터: ${allData.length}개\n`);
    
    // 2. 키워드 기반 자동 분류 데이터 찾기
    const keywordClassified = allData.filter(item => {
      // classificationConfidence 또는 matchedKeywords가 있으면 키워드 기반 분류
      const hasConfidence = item.classificationConfidence !== undefined && item.classificationConfidence !== null;
      const hasKeywords = item.matchedKeywords && item.matchedKeywords.length > 0;
      const isAutoClassified = item.autoClassified === true;
      const isClassified = item.status === 'classified';
      
      return (hasConfidence || hasKeywords) && isAutoClassified && isClassified;
    });
    
    console.log(`🔍 키워드 기반 자동 분류 데이터: ${keywordClassified.length}개`);
    
    if (keywordClassified.length === 0) {
      console.log('✅ 키워드 기반 자동 분류 데이터 없음. 작업 완료!');
      return;
    }
    
    // 3. 날짜별 분포 확인
    const dateDistribution = {};
    keywordClassified.forEach(item => {
      let date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      if (date && typeof date === 'string' && date.includes('T')) {
        date = date.split('T')[0];
      }
      if (date) {
        dateDistribution[date] = (dateDistribution[date] || 0) + 1;
      }
    });
    
    console.log('\n📅 날짜별 키워드 분류 데이터 분포:');
    Object.keys(dateDistribution).sort().forEach(date => {
      console.log(`   ${date}: ${dateDistribution[date]}개`);
    });
    
    // 4. 미분류로 변경
    console.log('\n🔄 미분류로 변경 중...');
    const updatedData = keywordClassified.map(item => ({
      ...item,
      status: 'unclassified',
      category: '',
      subCategory: '',
      autoClassified: false,
      classificationConfidence: undefined,
      matchedKeywords: undefined
    }));
    
    // 5. 서버에 업데이트 (배치 처리)
    const BATCH_SIZE = 100;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < updatedData.length; i += BATCH_SIZE) {
      const batch = updatedData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(updatedData.length / BATCH_SIZE);
      
      console.log(`📦 배치 ${batchNum}/${totalBatches} 처리 중... (${batch.length}개)`);
      
      try {
        const postData = JSON.stringify(batch);
        
        await new Promise((resolve, reject) => {
          const options = {
            hostname: 'api.youthbepulse.com',
            path: '/api/unclassified',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };
          
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              if (res.statusCode === 200) {
                successCount += batch.length;
                console.log(`   ✅ 배치 ${batchNum} 성공`);
                resolve();
              } else {
                failCount += batch.length;
                console.log(`   ❌ 배치 ${batchNum} 실패 (${res.statusCode})`);
                reject(new Error(`HTTP ${res.statusCode}`));
              }
            });
          });
          
          req.on('error', (err) => {
            failCount += batch.length;
            console.log(`   ❌ 배치 ${batchNum} 오류:`, err.message);
            reject(err);
          });
          
          req.write(postData);
          req.end();
        });
        
        // 배치 간 지연
        if (i + BATCH_SIZE < updatedData.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`   ❌ 배치 ${batchNum} 처리 실패`);
      }
    }
    
    // 6. 결과 출력
    console.log('\n📊 처리 결과:');
    console.log(`   총 대상: ${keywordClassified.length}개`);
    console.log(`   성공: ${successCount}개`);
    console.log(`   실패: ${failCount}개`);
    console.log('\n✅ 키워드 기반 자동 분류 초기화 완료!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

resetKeywordClassification();

