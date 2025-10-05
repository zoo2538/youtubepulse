#!/usr/bin/env node

/**
 * 하이브리드 동기화 설정 (로컬 환경)
 * IndexedDB와 서버 간 데이터 동기화 구축
 */

import fs from 'fs/promises';
import path from 'path';

// 1. 현재 IndexedDB 데이터 백업
async function backupIndexedDBData() {
  console.log('🔄 IndexedDB 데이터 백업 시작...');
  
  try {
    // 브라우저에서 실행할 스크립트 생성
    const backupScript = `
      // IndexedDB 데이터 백업 스크립트
      async function backupIndexedDB() {
        try {
          const dbName = 'YouTubePulseDB';
          const request = indexedDB.open(dbName, 2);
          
          return new Promise((resolve, reject) => {
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['unclassifiedData'], 'readonly');
              const store = transaction.objectStore('unclassifiedData');
              const getAllRequest = store.getAll();
              
              getAllRequest.onsuccess = () => {
                const data = {
                  timestamp: new Date().toISOString(),
                  totalRecords: getAllRequest.result.length,
                  records: getAllRequest.result
                };
                
                // 파일로 다운로드
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`indexeddb_backup_\${new Date().toISOString().split('T')[0]}.json\`;
                a.click();
                URL.revokeObjectURL(url);
                
                console.log(\`✅ IndexedDB 백업 완료: \${data.totalRecords}개 레코드\`);
                resolve(data);
              };
              
              getAllRequest.onerror = () => reject(getAllRequest.error);
            };
            
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('IndexedDB 백업 실패:', error);
          throw error;
        }
      }
      
      // 실행
      backupIndexedDB().then(data => {
        console.log('백업 완료:', data);
      }).catch(error => {
        console.error('백업 실패:', error);
      });
    `;
    
    await fs.writeFile('backup-indexeddb.js', backupScript);
    console.log('✅ IndexedDB 백업 스크립트 생성: backup-indexeddb.js');
    
  } catch (error) {
    console.error('❌ IndexedDB 백업 실패:', error.message);
    throw error;
  }
}

// 2. 서버 데이터 시뮬레이션
async function createServerDataSimulation() {
  console.log('🔄 서버 데이터 시뮬레이션 생성...');
  
  try {
    // 10월 5일 데이터 시뮬레이션
    const serverData = {
      timestamp: new Date().toISOString(),
      date: '2025-10-05',
      records: [
        {
          id: 'server_001',
          videoId: 'dQw4w9WgXcQ',
          channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
          channelName: 'Rick Astley',
          videoTitle: 'Never Gonna Give You Up',
          videoDescription: 'The official video for "Never Gonna Give You Up" by Rick Astley',
          viewCount: 1000000000,
          uploadDate: '2009-10-25T00:00:00Z',
          collectionDate: '2025-10-05T00:00:00Z',
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          category: '음악',
          subCategory: '팝',
          status: 'unclassified',
          createdAt: '2025-10-05T00:00:00Z',
          updatedAt: '2025-10-05T00:00:00Z',
          source: 'server'
        },
        {
          id: 'server_002',
          videoId: 'jNQXAC9IVRw',
          channelId: 'UCBJycsmduvYEL83R_U4JriQ',
          channelName: 'Marques Brownlee',
          videoTitle: 'iPhone 15 Pro Review',
          videoDescription: 'The iPhone 15 Pro is here with titanium, USB-C, and more',
          viewCount: 5000000,
          uploadDate: '2025-10-04T00:00:00Z',
          collectionDate: '2025-10-05T00:00:00Z',
          thumbnailUrl: 'https://i.ytimg.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
          category: '기술',
          subCategory: '스마트폰',
          status: 'unclassified',
          createdAt: '2025-10-05T00:00:00Z',
          updatedAt: '2025-10-05T00:00:00Z',
          source: 'server'
        }
      ]
    };
    
    await fs.writeFile('server_data_simulation.json', JSON.stringify(serverData, null, 2));
    console.log(`✅ 서버 데이터 시뮬레이션 생성: ${serverData.records.length}개 레코드`);
    
    return serverData;
    
  } catch (error) {
    console.error('❌ 서버 데이터 시뮬레이션 실패:', error.message);
    throw error;
  }
}

// 3. 하이브리드 동기화 테스트 스크립트 생성
async function createHybridSyncTest() {
  console.log('🔄 하이브리드 동기화 테스트 스크립트 생성...');
  
  try {
    const testScript = `
      // 하이브리드 동기화 테스트
      import { hybridSyncService } from '../src/lib/hybrid-sync-service.js';
      import { loadAndMergeDays, mergeByDay } from '../src/lib/day-merge-service.js';
      
      async function testHybridSync() {
        console.log('🧪 하이브리드 동기화 테스트 시작...');
        
        try {
          // 1. 동기화 상태 확인
          const syncStatus = hybridSyncService.getSyncStatus();
          console.log('📊 동기화 상태:', syncStatus);
          
          // 2. 서버 데이터 로드 시뮬레이션
          const serverResponse = await fetch('/api/unclassified?date=2025-10-05');
          const serverData = await serverResponse.json();
          console.log('📥 서버 데이터:', serverData.length, '개');
          
          // 3. 로컬 데이터 로드
          const localData = await indexedDBService.getUnclassifiedDataByDate('2025-10-05');
          console.log('💾 로컬 데이터:', localData.length, '개');
          
          // 4. 하이브리드 병합 테스트
          const mergeResult = await loadAndMergeDays('overwrite');
          console.log('🔄 병합 결과:', mergeResult);
          
          // 5. 동기화 실행
          const syncResult = await hybridSyncService.performFullSync();
          console.log('✅ 동기화 결과:', syncResult);
          
        } catch (error) {
          console.error('❌ 하이브리드 동기화 테스트 실패:', error);
        }
      }
      
      // 실행
      testHybridSync();
    `;
    
    await fs.writeFile('test-hybrid-sync.js', testScript);
    console.log('✅ 하이브리드 동기화 테스트 스크립트 생성: test-hybrid-sync.js');
    
  } catch (error) {
    console.error('❌ 테스트 스크립트 생성 실패:', error.message);
    throw error;
  }
}

// 4. UI 통합 스크립트 생성
async function createUIIntegrationScript() {
  console.log('🔄 UI 통합 스크립트 생성...');
  
  try {
    const uiScript = `
      // UI에 하이브리드 동기화 통합
      import { hybridSyncService } from './lib/hybrid-sync-service.js';
      import { loadAndMergeDays } from './lib/day-merge-service.js';
      
      // 동기화 버튼 추가
      function addSyncButton() {
        const buttonContainer = document.querySelector('.data-classification-actions');
        if (buttonContainer) {
          const syncButton = document.createElement('button');
          syncButton.textContent = '🔄 동기화';
          syncButton.className = 'btn btn-primary';
          syncButton.onclick = handleSyncData;
          buttonContainer.appendChild(syncButton);
        }
      }
      
      // 동기화 처리
      async function handleSyncData() {
        try {
          console.log('🔄 하이브리드 동기화 시작...');
          
          // 1. 서버와 로컬 데이터 병합
          const mergeResult = await loadAndMergeDays('overwrite');
          console.log('📊 병합 결과:', mergeResult);
          
          // 2. 동기화 실행
          const syncResult = await hybridSyncService.performFullSync();
          console.log('✅ 동기화 완료:', syncResult);
          
          // 3. UI 업데이트
          alert(\`동기화 완료!\\n업로드: \${syncResult.uploaded}개\\n다운로드: \${syncResult.downloaded}개\\n충돌: \${syncResult.conflicts}개\`);
          
          // 4. 페이지 새로고침
          window.location.reload();
          
        } catch (error) {
          console.error('❌ 동기화 실패:', error);
          alert('동기화 실패: ' + error.message);
        }
      }
      
      // 페이지 로드 시 실행
      document.addEventListener('DOMContentLoaded', () => {
        addSyncButton();
      });
    `;
    
    await fs.writeFile('ui-hybrid-sync.js', uiScript);
    console.log('✅ UI 통합 스크립트 생성: ui-hybrid-sync.js');
    
  } catch (error) {
    console.error('❌ UI 통합 스크립트 생성 실패:', error.message);
    throw error;
  }
}

// 메인 실행
async function main() {
  console.log('🚀 하이브리드 동기화 설정 시작 (로컬 환경)');
  
  try {
    // 1. IndexedDB 데이터 백업
    await backupIndexedDBData();
    
    // 2. 서버 데이터 시뮬레이션
    const serverData = await createServerDataSimulation();
    
    // 3. 하이브리드 동기화 테스트 스크립트
    await createHybridSyncTest();
    
    // 4. UI 통합 스크립트
    await createUIIntegrationScript();
    
    console.log('✅ 하이브리드 동기화 설정 완료');
    console.log('📋 생성된 파일:');
    console.log('   - backup-indexeddb.js: IndexedDB 백업 스크립트');
    console.log('   - server_data_simulation.json: 서버 데이터 시뮬레이션');
    console.log('   - test-hybrid-sync.js: 동기화 테스트 스크립트');
    console.log('   - ui-hybrid-sync.js: UI 통합 스크립트');
    console.log('');
    console.log('🔧 다음 단계:');
    console.log('   1. 브라우저에서 backup-indexeddb.js 실행하여 IndexedDB 백업');
    console.log('   2. 서버 데이터를 IndexedDB에 로드');
    console.log('   3. 하이브리드 병합 테스트 실행');
    console.log('   4. UI에 동기화 버튼 통합');
    
  } catch (error) {
    console.error('❌ 하이브리드 동기화 설정 실패:', error.message);
    process.exit(1);
  }
}

main();
