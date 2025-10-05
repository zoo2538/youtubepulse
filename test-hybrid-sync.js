
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
    