// 증분 동기화 스크립트
import fs from 'fs';
import path from 'path';
import config from './hybrid-sync-config.js';

const API_BASE = config.API_BASE;
const EXPORT_DIR = config.EXPORT_DIR;
const SINCE_TS = config.SINCE_TS;

console.log('🔄 증분 동기화 시작...');
console.log(`📡 API Base: ${API_BASE}`);
console.log(`⏰ Since: ${SINCE_TS}`);

// 1) 서버→로컬: since 기반 변경분 내려받기
async function downloadFromServer() {
  try {
    console.log('[1/2] 서버에서 변경분 다운로드...');
    const response = await fetch(`${API_BASE}/api/sync/download?since=${encodeURIComponent(SINCE_TS)}`);
    
    if (!response.ok) {
      throw new Error(`서버 다운로드 실패: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const serverFile = path.join(EXPORT_DIR, 'server_since.json');
    
    fs.writeFileSync(serverFile, JSON.stringify(data, null, 2));
    console.log(`✅ 서버 데이터 저장: ${serverFile} (${data.length || 0}개 항목)`);
    
    return data;
  } catch (error) {
    console.error('❌ 서버 다운로드 실패:', error.message);
    return [];
  }
}

// 2) 로컬→서버: 작업 큐 업로드(멱등 업서트)
async function uploadToServer() {
  try {
    console.log('[2/2] 로컬 변경사항 서버 업로드...');
    
    // 로컬 변경사항 파일이 있는지 확인
    const localFile = path.join(EXPORT_DIR, 'local_changes.json');
    if (!fs.existsSync(localFile)) {
      console.log('⚠️ 로컬 변경사항 파일이 없습니다. 빈 배열로 업로드합니다.');
      fs.writeFileSync(localFile, JSON.stringify([]));
    }
    
    const localData = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    
    const response = await fetch(`${API_BASE}/api/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(localData)
    });
    
    if (!response.ok) {
      throw new Error(`서버 업로드 실패: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const uploadFile = path.join(EXPORT_DIR, 'upload_result.json');
    
    fs.writeFileSync(uploadFile, JSON.stringify(result, null, 2));
    console.log(`✅ 업로드 결과 저장: ${uploadFile}`);
    console.log(`📊 업로드 통계:`, result);
    
    return result;
  } catch (error) {
    console.error('❌ 서버 업로드 실패:', error.message);
    return { error: error.message };
  }
}

// 메인 실행
async function main() {
  console.log('🚀 증분 동기화 실행...');
  
  const serverData = await downloadFromServer();
  const uploadResult = await uploadToServer();
  
  console.log('✅ 증분 동기화 완료');
  console.log(`📥 서버에서 다운로드: ${serverData.length || 0}개 항목`);
  console.log(`📤 서버로 업로드: ${uploadResult.uploaded || 0}개 항목`);
}

main().catch(console.error);
