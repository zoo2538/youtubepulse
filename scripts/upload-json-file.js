// JSON 파일을 직접 읽어서 서버에 업로드하는 스크립트
(async function uploadJsonFile() {
  console.log('🔄 JSON 파일 업로드 시작...');
  
  try {
    // JSON 파일을 읽기 (실제 파일 경로로 수정 필요)
    const response = await fetch('/api/upload-backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 여기에 실제 JSON 파일 내용을 붙여넣어주세요
        // 또는 파일을 직접 읽어서 처리
        backupData: {
          "exportDate": "2025-10-02T16:20:36.624Z",
          "exportType": "dateRange",
          "dateRange": {
            "from": "2025-09-27",
            "to": "2025-10-03"
          },
          "totalDates": 7,
          "totalVideos": 19788,
          "totalClassified": 14508,
          "totalUnclassified": 5280,
          "dailyData": [
            // 여기에 실제 dailyData 배열을 붙여넣어주세요
            // 파일이 너무 크므로 사용자가 직접 붙여넣어야 합니다
          ]
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ JSON 파일 업로드 성공:', result);
      
      // 업로드 후 복원 시작
      await restoreFromServer();
    } else {
      console.error('❌ 업로드 실패:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ 업로드 오류:', error);
  }
})();

// 서버에서 복원하는 함수
async function restoreFromServer() {
  console.log('🔄 서버에서 데이터 복원 중...');
  
  try {
    const response = await fetch('/api/restore-backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 서버 복원 성공:', result);
      console.log('🎉 백업 복원 완료!');
    } else {
      console.error('❌ 서버 복원 실패:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ 서버 복원 오류:', error);
  }
}
