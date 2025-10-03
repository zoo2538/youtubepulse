// 완전한 백업 복원 스크립트 (실제 JSON 데이터 포함)
(async function completeBackupRestore() {
  console.log('🔄 완전한 백업 복원 시작...');
  
  try {
    // 실제 JSON 파일 내용을 여기에 붙여넣어주세요
    const backupData = {
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
        // 여기에 실제 JSON 파일의 dailyData 배열을 붙여넣어주세요
        // 파일이 너무 크므로 사용자가 직접 붙여넣어야 합니다
        {
          "date": "2025-10-03",
          "total": 190,
          "classified": 45,
          "unclassified": 145,
          "progress": 24,
          "data": [
            // 여기에 실제 영상 데이터들을 붙여넣어주세요
          ]
        }
        // 다른 날짜들의 데이터도 여기에 추가됩니다
      ]
    };
    
    console.log('📊 백업 데이터 요약:');
    console.log(`- 내보내기 날짜: ${backupData.exportDate}`);
    console.log(`- 날짜 범위: ${backupData.dateRange.from} ~ ${backupData.dateRange.to}`);
    console.log(`- 총 영상: ${backupData.totalVideos}개`);
    console.log(`- 분류된 영상: ${backupData.totalClassified}개`);
    console.log(`- 미분류 영상: ${backupData.totalUnclassified}개`);
    console.log(`- 일별 데이터: ${backupData.dailyData.length}일`);
    
    // 서버에 업로드
    await uploadToServer(backupData);
    
  } catch (error) {
    console.error('❌ 복원 실패:', error);
  }
})();

// 서버에 업로드하는 함수
async function uploadToServer(backupData) {
  console.log('📤 서버에 백업 데이터 업로드 중...');
  
  try {
    const response = await fetch('/api/upload-backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ backupData })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 서버 업로드 성공:', result);
      
      // 업로드 후 복원 시작
      await restoreFromServer();
    } else {
      console.error('❌ 서버 업로드 실패:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ 서버 업로드 오류:', error);
  }
}

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
      console.log('🔄 페이지를 새로고침하면 복원된 데이터를 확인할 수 있습니다.');
    } else {
      console.error('❌ 서버 복원 실패:', await response.text());
    }
    
  } catch (error) {
    console.error('❌ 서버 복원 오류:', error);
  }
}
