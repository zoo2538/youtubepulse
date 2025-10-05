
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
          alert(`동기화 완료!\n업로드: ${syncResult.uploaded}개\n다운로드: ${syncResult.downloaded}개\n충돌: ${syncResult.conflicts}개`);
          
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
    