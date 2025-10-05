// 로그인 후 하이브리드 동기화 시퀀스
import { hybridSyncService } from './hybrid-sync-service';
import { indexedDBService } from './indexeddb-service';

interface PostLoginSyncContext {
  api: {
    get: (url: string) => Promise<any>;
    post: (url: string, data: any) => Promise<any>;
  };
  idb: typeof indexedDBService;
  lastSyncAt?: string;
}

export async function postLoginSync({ api, idb, lastSyncAt }: PostLoginSyncContext) {
  try {
    console.log('🔄 로그인 후 하이브리드 동기화 시작...');
    
    // 1. 로컬→서버 업로드 큐 재생
    console.log('[1/3] 로컬→서버 업로드 큐 재생...');
    const uploadResult = await hybridSyncService.performFullSync();
    console.log('✅ 업로드 큐 재생 완료:', uploadResult);
    
    // 2. 서버→로컬 증분 동기화
    console.log('[2/3] 서버→로컬 증분 동기화...');
    const since = lastSyncAt ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const delta = await api.get(`/api/sync/download?since=${since}`);
    
    if (delta && delta.items && delta.items.length > 0) {
      // IndexedDB upsert 패턴: get → Math.max → put
      await idb.upsertUnclassifiedDataWithMaxValues(delta.items);
      console.log(`✅ 서버 증분 동기화 완료: ${delta.items.length}개 항목`);
    } else {
      console.log('📊 서버 증분 동기화: 변경사항 없음');
    }
    
    // 3. 동기화 완료 상태 업데이트
    console.log('[3/3] 동기화 상태 업데이트...');
    const syncedAt = new Date().toISOString();
    await idb.saveSystemConfig('lastSyncAt', syncedAt);
    
    console.log('🎉 하이브리드 동기화 완료!');
    return { 
      success: true, 
      syncedAt,
      uploaded: uploadResult.uploaded || 0,
      downloaded: delta?.items?.length || 0
    };
    
  } catch (error) {
    console.error('❌ 하이브리드 동기화 실패:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      syncedAt: null
    };
  }
}

// 라우터 가드용 동기화 체크
export async function checkSyncRequired(): Promise<boolean> {
  try {
    const lastSync = await indexedDBService.loadSystemConfig('lastSyncAt');
    if (!lastSync) return true;
    
    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    const hoursSinceSync = (now - lastSyncTime) / (1000 * 60 * 60);
    
    // 24시간 이상 지났으면 동기화 필요
    return hoursSinceSync >= 24;
  } catch (error) {
    console.error('❌ 동기화 필요성 체크 실패:', error);
    return true; // 에러 시 동기화 실행
  }
}
