// 브라우저 개발자 도구 콘솔에서 이 스크립트를 복사해서 실행하세요
// https://youthbepulse.com 에서 F12를 누르고 콘솔 탭에서 실행

(async function checkIndexedDB() {
  console.log('🔍 IndexedDB 데이터 수집 현황 체크 시작...\n');
  
  try {
    // IndexedDB 열기
    const dbRequest = indexedDB.open('YouTubePulseDB');
    
    dbRequest.onsuccess = () => {
      const db = dbRequest.result;
      
      console.log('✅ IndexedDB 연결 성공');
      console.log('📊 데이터베이스 버전:', db.version);
      console.log('📊 사용 가능한 스토어:', Array.from(db.objectStoreNames));
      
      if (!db.objectStoreNames.contains('unclassifiedData')) {
        console.error('❌ unclassifiedData 스토어를 찾을 수 없습니다.');
        return;
      }
      
      // 데이터 조회
      const transaction = db.transaction(['unclassifiedData'], 'readonly');
      const store = transaction.objectStore('unclassifiedData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const data = getAllRequest.result;
        
        console.log(`\n📊 전체 데이터: ${data.length.toLocaleString()}개\n`);
        
        if (data.length === 0) {
          console.warn('⚠️ IndexedDB에 데이터가 없습니다.');
          return;
        }
        
        // 날짜별, 수집타입별 통계
        const dateStats = {};
        
        data.forEach(item => {
          const dateKey = item.dayKeyLocal || 
                         (item.collectionDate || item.uploadDate)?.split('T')[0] || 
                         'unknown';
          
          const collectionType = item.collectionType || 'manual';
          const status = item.status || 'unclassified';
          
          if (!dateStats[dateKey]) {
            dateStats[dateKey] = {
              manual: 0,
              auto: 0,
              total: 0,
              classified: 0,
              unclassified: 0,
              pending: 0
            };
          }
          
          if (collectionType === 'auto') {
            dateStats[dateKey].auto++;
          } else {
            dateStats[dateKey].manual++;
          }
          
          dateStats[dateKey].total++;
          
          if (status === 'classified') {
            dateStats[dateKey].classified++;
          } else if (status === 'pending') {
            dateStats[dateKey].pending++;
          } else {
            dateStats[dateKey].unclassified++;
          }
        });
        
        // 전체 통계
        const totalManual = Object.values(dateStats).reduce((sum, stat) => sum + stat.manual, 0);
        const totalAuto = Object.values(dateStats).reduce((sum, stat) => sum + stat.auto, 0);
        const totalClassified = Object.values(dateStats).reduce((sum, stat) => sum + stat.classified, 0);
        
        console.log('='.repeat(80));
        console.log('📊 전체 통계:');
        console.log('='.repeat(80));
        console.log(`전체 데이터: ${(totalManual + totalAuto).toLocaleString()}개`);
        console.log(`수동 수집: ${totalManual.toLocaleString()}개`);
        console.log(`자동 수집: ${totalAuto.toLocaleString()}개`);
        console.log(`분류 완료: ${totalClassified.toLocaleString()}개`);
        console.log(`진행률: ${((totalClassified / (totalManual + totalAuto)) * 100).toFixed(1)}%`);
        console.log('');
        
        // 날짜별 통계 (정렬)
        const sortedDates = Object.keys(dateStats).sort((a, b) => b.localeCompare(a));
        
        console.log('='.repeat(80));
        console.log('📅 날짜별 수집 현황:');
        console.log('='.repeat(80));
        console.log('');
        
        // 테이블 형식으로 출력
        const tableData = sortedDates.map(date => {
          const stat = dateStats[date];
          return {
            '날짜': date,
            '수동': stat.manual.toLocaleString(),
            '자동': stat.auto.toLocaleString(),
            '전체': stat.total.toLocaleString(),
            '분류완료': stat.classified.toLocaleString(),
            '미분류': stat.unclassified.toLocaleString(),
            '보류': stat.pending.toLocaleString(),
            '진행률': ((stat.classified / stat.total) * 100).toFixed(1) + '%'
          };
        });
        
        console.table(tableData);
        
        // 상위 10개 날짜 상세 정보
        console.log('\n' + '='.repeat(80));
        console.log('📊 최근 10개 날짜 상세 정보:');
        console.log('='.repeat(80));
        console.log('');
        
        sortedDates.slice(0, 10).forEach(date => {
          const stat = dateStats[date];
          console.log(`📅 ${date}:`);
          console.log(`   수동수집: ${stat.manual.toLocaleString()}개`);
          console.log(`   자동수집: ${stat.auto.toLocaleString()}개`);
          console.log(`   분류완료: ${stat.classified.toLocaleString()}개`);
          console.log(`   미분류: ${stat.unclassified.toLocaleString()}개`);
          console.log(`   보류: ${stat.pending.toLocaleString()}개`);
          console.log(`   진행률: ${((stat.classified / stat.total) * 100).toFixed(1)}%`);
          console.log('');
        });
        
        console.log('✅ IndexedDB 체크 완료!');
      };
      
      getAllRequest.onerror = () => {
        console.error('❌ 데이터 조회 실패:', getAllRequest.error);
      };
    };
    
    dbRequest.onerror = () => {
      console.error('❌ IndexedDB 연결 실패:', dbRequest.error);
    };
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
})();

