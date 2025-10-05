// API 테스트 스크립트
import config from './hybrid-sync-config.js';

const API_BASE = config.API_BASE;

console.log('🔍 API 상태 테스트...');

// 1) 헬스 체크
async function testHealth() {
  try {
    console.log('[1/3] 헬스 체크...');
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();
    console.log('✅ 헬스 체크 성공:', data);
    return true;
  } catch (error) {
    console.error('❌ 헬스 체크 실패:', error.message);
    return false;
  }
}

// 2) 동기화 다운로드 테스트
async function testDownload() {
  try {
    console.log('[2/3] 동기화 다운로드 테스트...');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(`${API_BASE}/api/sync/download?since=${encodeURIComponent(since)}`);
    const data = await response.json();
    console.log('✅ 다운로드 테스트 성공:', data);
    return true;
  } catch (error) {
    console.error('❌ 다운로드 테스트 실패:', error.message);
    return false;
  }
}

// 3) 동기화 업로드 테스트
async function testUpload() {
  try {
    console.log('[3/3] 동기화 업로드 테스트...');
    const testData = [
      {
        operation: 'create',
        tableName: 'unclassified_data',
        recordId: 'test_video_1_2025-10-05',
        payload: {
          videoId: 'test_video_1',
          channelId: 'test_channel',
          channelName: '테스트 채널',
          videoTitle: '테스트 영상',
          videoDescription: 'API 테스트용 영상입니다.',
          viewCount: 100,
          uploadDate: '2025-10-01',
          collectionDate: '2025-10-05',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          category: '교육',
          subCategory: '프로그래밍',
          status: 'unclassified'
        },
        clientVersion: Date.now()
      }
    ];
    
    const response = await fetch(`${API_BASE}/api/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ 업로드 테스트 성공:', data);
    return true;
  } catch (error) {
    console.error('❌ 업로드 테스트 실패:', error.message);
    return false;
  }
}

// 메인 실행
async function main() {
  console.log('🚀 API 테스트 시작...');
  console.log(`📡 API Base: ${API_BASE}`);
  
  const healthOk = await testHealth();
  const downloadOk = await testDownload();
  const uploadOk = await testUpload();
  
  console.log('');
  console.log('📊 테스트 결과:');
  console.log(`  헬스 체크: ${healthOk ? '✅' : '❌'}`);
  console.log(`  다운로드: ${downloadOk ? '✅' : '❌'}`);
  console.log(`  업로드: ${uploadOk ? '✅' : '❌'}`);
  
  if (healthOk && downloadOk && uploadOk) {
    console.log('🎉 모든 API 테스트 통과!');
  } else {
    console.log('⚠️ 일부 API 테스트 실패');
  }
}

main().catch(console.error);
