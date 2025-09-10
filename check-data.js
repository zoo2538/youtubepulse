// IndexedDB 데이터 확인 스크립트
const { exec } = require('child_process');
const path = require('path');

// 브라우저에서 실행할 JavaScript 코드
const checkScript = `
// 전체 데이터 확인
async function checkAllData() {
  const request = indexedDB.open('YouTubePulseDB', 1);
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['unclassifiedData'], 'readonly');
    const store = transaction.objectStore('unclassifiedData');
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = () => {
      const allData = getAllRequest.result;
      console.log('📊 전체 데이터 개수:', allData.length);
      
      // 날짜별 데이터 개수 확인
      const dateCounts = {};
      allData.forEach(item => {
        const date = item.collectionDate || item.uploadDate;
        if (date) {
          dateCounts[date] = (dateCounts[date] || 0) + 1;
        }
      });
      console.log('📅 날짜별 데이터 개수:', dateCounts);
      
      // 9월 7일 데이터만 확인
      const sept7Data = allData.filter(item => {
        const date = item.collectionDate || item.uploadDate;
        return date === '2025-09-07';
      });
      console.log('📅 9월 7일 데이터 개수:', sept7Data.length);
      
      // collectionDate가 없는 데이터 확인
      const noCollectionDate = allData.filter(item => !item.collectionDate);
      console.log('⚠️ collectionDate가 없는 데이터:', noCollectionDate.length);
      
      // uploadDate만 있는 데이터 확인
      const uploadDateOnly = allData.filter(item => !item.collectionDate && item.uploadDate);
      console.log('📤 uploadDate만 있는 데이터:', uploadDateOnly.length);
    };
  };
}

checkAllData();
`;

console.log('브라우저 콘솔에서 다음 코드를 실행하세요:');
console.log('=====================================');
console.log(checkScript);
console.log('=====================================');
console.log('위 코드를 브라우저 콘솔에 복사해서 실행하고 결과를 알려주세요!');