/**
 * 하이브리드 데이터 동기화 서비스
 * 서버(PostgreSQL) ↔ 로컬(IndexedDB) 양방향 동기화
 */

import { type DayRow, type MergeResult, mergeByDay, convertToDayRows } from './day-merge-service';

// 동기화 상태 인터페이스
export interface SyncStatus {
  lastSync: number;        // 마지막 동기화 시간 (epoch ms)
  serverRevision: string;  // 서버 리비전
  localRevision: string;   // 로컬 리비전
  pendingChanges: number;  // 미동기화 변경 수
  conflicts: number;       // 충돌 수
}

// 동기화 결과 인터페이스
export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  mergedDays: DayRow[];
  conflicts: Array<{
    dayKey: string;
    serverData: DayRow;
    localData: DayRow;
    resolution: 'server' | 'local' | 'merged';
  }>;
  stats: {
    uploaded: number;      // 서버로 업로드된 변경 수
    downloaded: number;   // 서버에서 다운로드된 변경 수
    conflicts: number;     // 해결된 충돌 수
  };
  error?: string;
}

/**
 * 로컬 변경사항을 서버에 업로드
 * @param apiBase API 기본 URL
 * @returns 업로드 결과
 */
export async function uploadLocalChanges(apiBase: string = 'https://api.youthbepulse.com'): Promise<{
  success: boolean;
  uploaded: number;
  error?: string;
}> {
  try {
    console.log('📤 로컬 변경사항 서버 업로드 시작...');
    
    // 로컬 데이터 가져오기
    const { hybridService } = await import('./hybrid-service');
    const localData = await hybridService.loadUnclassifiedData();
    
    if (!localData || localData.length === 0) {
      return { success: true, uploaded: 0 };
    }
    
    // 로컬 데이터를 DayRow로 변환
    const localDays = convertToDayRows(localData, 'local');
    
    // 미동기화 변경사항만 필터링 (pendingLocalOps > 0)
    const pendingChanges = localDays.filter(day => (day.pendingLocalOps || 0) > 0);
    
    if (pendingChanges.length === 0) {
      console.log('📤 업로드할 로컬 변경사항 없음');
      return { success: true, uploaded: 0 };
    }
    
    console.log(`📤 ${pendingChanges.length}개 일자의 로컬 변경사항 업로드 중...`);
    
    // 서버에 일괄 업로드
    const uploadPromises = pendingChanges.map(async (dayRow) => {
      try {
        const response = await fetch(`${apiBase}/api/sync/upload-day`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dayKey: dayRow.dayKey,
            total: dayRow.total,
            done: dayRow.done,
            updatedAt: dayRow.updatedAt,
            source: 'local'
          })
        });
        
        if (!response.ok) {
          throw new Error(`서버 업로드 실패: ${response.status}`);
        }
        
        return true;
      } catch (error) {
        console.error(`일자 ${dayRow.dayKey} 업로드 실패:`, error);
        return false;
      }
    });
    
    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(Boolean).length;
    
    console.log(`📤 로컬 변경사항 업로드 완료: ${successCount}/${pendingChanges.length}개 성공`);
    
    return {
      success: successCount > 0,
      uploaded: successCount,
      error: successCount < pendingChanges.length ? '일부 업로드 실패' : undefined
    };
  } catch (error) {
    console.error('로컬 변경사항 업로드 실패:', error);
    return {
      success: false,
      uploaded: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 서버 변경사항을 로컬로 다운로드
 * @param apiBase API 기본 URL
 * @param sinceRevision 마지막 동기화 리비전
 * @returns 다운로드 결과
 */
export async function downloadServerChanges(
  apiBase: string = 'https://api.youthbepulse.com',
  sinceRevision?: string
): Promise<{
  success: boolean;
  downloaded: number;
  serverDays: DayRow[];
  error?: string;
}> {
  try {
    console.log('📥 서버 변경사항 다운로드 시작...');
    
    // 서버에서 변경사항 조회
    const url = sinceRevision 
      ? `${apiBase}/api/sync/changes?since=${sinceRevision}`
      : `${apiBase}/api/unclassified`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`서버 응답 실패: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.data) {
      return { success: true, downloaded: 0, serverDays: [] };
    }
    
    // 서버 데이터를 DayRow로 변환
    const serverDays = convertToDayRows(result.data, 'server');
    
    console.log(`📥 서버에서 ${serverDays.length}개 일자 데이터 다운로드 완료`);
    
    return {
      success: true,
      downloaded: serverDays.length,
      serverDays
    };
  } catch (error) {
    console.error('서버 변경사항 다운로드 실패:', error);
    return {
      success: false,
      downloaded: 0,
      serverDays: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 전체 동기화 실행 (양방향)
 * @param apiBase API 기본 URL
 * @param mode 병합 모드
 * @returns 동기화 결과
 */
export async function performFullSync(
  apiBase: string = 'https://api.youthbepulse.com',
  mode: 'overwrite' | 'union' = 'overwrite'
): Promise<SyncResult> {
  try {
    console.log('🔄 전체 동기화 시작...');
    
    // 1. 로컬 변경사항 업로드
    const uploadResult = await uploadLocalChanges(apiBase);
    if (!uploadResult.success) {
      console.warn('로컬 변경사항 업로드 실패, 계속 진행...');
    }
    
    // 2. 서버 변경사항 다운로드
    const downloadResult = await downloadServerChanges(apiBase);
    if (!downloadResult.success) {
      throw new Error(`서버 데이터 다운로드 실패: ${downloadResult.error}`);
    }
    
    // 3. 로컬 데이터 가져오기
    const { hybridService } = await import('./hybrid-service');
    const localData = await hybridService.loadUnclassifiedData();
    const localDays = convertToDayRows(localData, 'local');
    
    // 4. 서버와 로컬 데이터 병합
    const mergeResult = mergeByDay(downloadResult.serverDays, localDays, mode);
    
    // 5. 동기화 상태 업데이트
    const syncStatus: SyncStatus = {
      lastSync: Date.now(),
      serverRevision: `server_${Date.now()}`,
      localRevision: `local_${Date.now()}`,
      pendingChanges: 0, // 병합 후 모든 변경사항 동기화됨
      conflicts: mergeResult.conflicts.length
    };
    
    // 6. 동기화 상태 저장
    await saveSyncStatus(syncStatus);
    
    console.log('✅ 전체 동기화 완료:', {
      uploaded: uploadResult.uploaded,
      downloaded: downloadResult.downloaded,
      merged: mergeResult.mergedDays.length,
      conflicts: mergeResult.conflicts.length
    });
    
    return {
      success: true,
      status: syncStatus,
      mergedDays: mergeResult.mergedDays,
      conflicts: mergeResult.conflicts,
      stats: {
        uploaded: uploadResult.uploaded,
        downloaded: downloadResult.downloaded,
        conflicts: mergeResult.conflicts.length
      }
    };
  } catch (error) {
    console.error('전체 동기화 실패:', error);
    return {
      success: false,
      status: {
        lastSync: 0,
        serverRevision: '',
        localRevision: '',
        pendingChanges: 0,
        conflicts: 0
      },
      mergedDays: [],
      conflicts: [],
      stats: {
        uploaded: 0,
        downloaded: 0,
        conflicts: 0
      },
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

/**
 * 동기화 상태 저장
 * @param status 동기화 상태
 */
export async function saveSyncStatus(status: SyncStatus): Promise<void> {
  try {
    localStorage.setItem('youtubepulse_sync_status', JSON.stringify(status));
    console.log('💾 동기화 상태 저장 완료:', status);
  } catch (error) {
    console.error('동기화 상태 저장 실패:', error);
  }
}

/**
 * 동기화 상태 로드
 * @returns 동기화 상태 또는 기본값
 */
export async function loadSyncStatus(): Promise<SyncStatus> {
  try {
    const stored = localStorage.getItem('youtubepulse_sync_status');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('동기화 상태 로드 실패:', error);
  }
  
  // 기본값 반환
  return {
    lastSync: 0,
    serverRevision: '',
    localRevision: '',
    pendingChanges: 0,
    conflicts: 0
  };
}

/**
 * 동기화 상태 확인
 * @param apiBase API 기본 URL
 * @returns 동기화 필요 여부
 */
export async function checkSyncNeeded(apiBase: string = 'https://api.youthbepulse.com'): Promise<{
  needed: boolean;
  reason: string;
  lastSync: number;
}> {
  try {
    const status = await loadSyncStatus();
    const now = Date.now();
    const timeSinceLastSync = now - status.lastSync;
    
    // 5분 이상 지났거나 충돌이 있으면 동기화 필요
    if (timeSinceLastSync > 5 * 60 * 1000 || status.conflicts > 0) {
      return {
        needed: true,
        reason: status.conflicts > 0 ? '충돌 해결 필요' : '오래된 동기화',
        lastSync: status.lastSync
      };
    }
    
    return {
      needed: false,
      reason: '동기화 불필요',
      lastSync: status.lastSync
    };
  } catch (error) {
    console.error('동기화 상태 확인 실패:', error);
    return {
      needed: true,
      reason: '상태 확인 실패',
      lastSync: 0
    };
  }
}
