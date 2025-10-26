// 로컬 변경사항 수집 스크립트
import fs from 'fs';
import path from 'path';
import config from './hybrid-sync-config.js';

const EXPORT_DIR = config.EXPORT_DIR;

console.log('📊 로컬 변경사항 수집...');

// 브라우저 콘솔에서 실행할 IndexedDB 데이터 수집 스크립트
const browserScript = `
// 브라우저 콘솔에서 실행할 스크립트
(async function collectLocalChanges() {
  try {
    console.log('🔍 IndexedDB에서 로컬 변경사항 수집...');
    
    // IndexedDB 열기
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('YouTubePulseDB', 10);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    // 트랜잭션 시작
    const transaction = db.transaction(['unclassifiedData'], 'readonly');
    const store = transaction.objectStore('unclassifiedData');
    
    // 모든 데이터 가져오기
    const allData = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    
    console.log(\`📊 총 \${allData.length}개 항목 수집\`);
    
    // 변경사항 형태로 변환
    const changes = allData.map(item => ({
      operation: 'create',
      tableName: 'unclassified_data',
      recordId: item.videoId + '_' + (item.dayKeyLocal || item.collectionDate),
      payload: {
        videoId: item.videoId,
        channelId: item.channelId,
        channelName: item.channelName,
        videoTitle: item.videoTitle,
        videoDescription: item.videoDescription,
        viewCount: item.viewCount,
        uploadDate: item.uploadDate,
        collectionDate: item.collectionDate,
        thumbnailUrl: item.thumbnailUrl,
        category: item.category,
        subCategory: item.subCategory,
        status: item.status
      },
      clientVersion: Date.now()
    }));
    
    // JSON 파일로 다운로드
    const blob = new Blob([JSON.stringify(changes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'local_changes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ 로컬 변경사항 수집 완료:', changes.length, '개 항목');
    return changes;
  } catch (error) {
    console.error('❌ 로컬 변경사항 수집 실패:', error);
    return [];
  }
})();
`;

// 브라우저 스크립트를 파일로 저장
const browserScriptFile = path.join(EXPORT_DIR, 'browser-collect-script.js');
fs.writeFileSync(browserScriptFile, browserScript);

console.log('📝 브라우저 스크립트 생성:', browserScriptFile);
console.log('');
console.log('🔧 사용 방법:');
console.log('1. 웹 브라우저에서 데이터 분류 페이지 열기');
console.log('2. 개발자 도구 콘솔 열기 (F12)');
console.log('3. 다음 스크립트를 복사해서 실행:');
console.log('');
console.log('```javascript');
console.log(browserScript);
console.log('```');
console.log('');
console.log('4. 다운로드된 local_changes.json 파일을 .tmp 폴더에 복사');
console.log('5. 다시 증분 동기화 실행');

// 샘플 로컬 변경사항 생성 (테스트용)
const sampleChanges = [
  {
    operation: 'create',
    tableName: 'unclassified_data',
    recordId: 'sample_video_1_2025-10-05',
    payload: {
      videoId: 'sample_video_1',
      channelId: 'sample_channel',
      channelName: '샘플 채널',
      videoTitle: '샘플 영상',
      videoDescription: '테스트용 샘플 영상입니다.',
      viewCount: 1000,
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

const sampleFile = path.join(EXPORT_DIR, 'local_changes.json');
fs.writeFileSync(sampleFile, JSON.stringify(sampleChanges, null, 2));
console.log('📄 샘플 로컬 변경사항 생성:', sampleFile);
