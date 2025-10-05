/**
 * 하이브리드 동기화 서비스
 * 서버(PostgreSQL)와 로컬(IndexedDB) 간 안전한 양방향 동기화
 */

import { indexedDBService } from './indexeddb-service';

export interface SyncOperation {
  id: string;
  operation: 'create' | 'update' | 'delete';
  tableName: string;
  recordId: string;
  payload: any;
  clientVersion: string;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface SyncMetadata {
  clientId: string;
  lastSyncAt: number;
  serverVersion: string;
  clientVersion: string;
}

export interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
  lastSyncAt: number;
}

class HybridSyncService {
  private clientId: string;
  private syncQueue: SyncOperation[] = [];
  private metadata: SyncMetadata | null = null;

  constructor() {
    this.clientId = this.generateClientId();
    this.loadSyncQueue();
    this.loadMetadata();
  }

  // 클라이언트 ID 생성
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 동기화 큐 로드
  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = localStorage.getItem('syncQueue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('동기화 큐 로드 실패:', error);
      this.syncQueue = [];
    }
  }

  // 동기화 큐 저장
  private async saveSyncQueue(): Promise<void> {
    try {
      localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('동기화 큐 저장 실패:', error);
    }
  }

  // 메타데이터 로드
  private async loadMetadata(): Promise<void> {
    try {
      const stored = localStorage.getItem('syncMetadata');
      if (stored) {
        this.metadata = JSON.parse(stored);
      }
    } catch (error) {
      console.error('메타데이터 로드 실패:', error);
    }
  }

  // 메타데이터 저장
  private async saveMetadata(): Promise<void> {
    try {
      if (this.metadata) {
        localStorage.setItem('syncMetadata', JSON.stringify(this.metadata));
      }
    } catch (error) {
      console.error('메타데이터 저장 실패:', error);
    }
  }

  // 로컬 변경사항을 동기화 큐에 추가
  async addToSyncQueue(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'status'>): Promise<void> {
    const syncOp: SyncOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.syncQueue.push(syncOp);
    await this.saveSyncQueue();
    
    console.log(`📝 동기화 큐에 추가: ${operation.operation} ${operation.recordId}`);
  }

  // 서버로 업로드 (로컬 → 서버)
  private async uploadToServer(): Promise<{ uploaded: number; errors: string[] }> {
    const pendingOps = this.syncQueue.filter(op => op.status === 'pending');
    let uploaded = 0;
    const errors: string[] = [];

    console.log(`📤 서버로 업로드 시작: ${pendingOps.length}개 작업`);

    for (const op of pendingOps) {
      try {
        op.status = 'processing';
        await this.saveSyncQueue();

        const response = await fetch('/api/sync/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: op.operation,
            tableName: op.tableName,
            recordId: op.recordId,
            payload: op.payload,
            clientVersion: op.clientVersion
          })
        });

        if (response.ok) {
          op.status = 'completed';
          uploaded++;
          console.log(`✅ 업로드 성공: ${op.operation} ${op.recordId}`);
        } else {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

      } catch (error) {
        op.status = 'failed';
        const errorMsg = `업로드 실패 ${op.recordId}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    await this.saveSyncQueue();
    return { uploaded, errors };
  }

  // 서버에서 다운로드 (서버 → 로컬)
  private async downloadFromServer(): Promise<{ downloaded: number; conflicts: number }> {
    try {
      const lastSync = this.metadata?.lastSyncAt || 0;
      const response = await fetch(`/api/sync/download?since=${lastSync}`);
      
      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      const data = await response.json();
      let downloaded = 0;
      let conflicts = 0;

      console.log(`📥 서버에서 다운로드: ${data.records.length}개 레코드`);

      for (const record of data.records) {
        try {
          // 로컬 데이터와 충돌 확인
          const localData = await indexedDBService.getUnclassifiedDataById(record.id);
          
          if (localData) {
            // 충돌 해결: Last-Write-Wins
            if (record.updatedAt > localData.updatedAt) {
              await indexedDBService.updateUnclassifiedData(record);
              conflicts++;
              console.log(`🔄 충돌 해결: ${record.id} (서버 우선)`);
            } else {
              console.log(`📝 로컬 데이터 유지: ${record.id}`);
            }
          } else {
            // 최대값 보존 upsert 사용
            await indexedDBService.upsertUnclassifiedDataWithMaxValues([record]);
            downloaded++;
          }

        } catch (error) {
          console.error(`❌ 레코드 처리 실패 ${record.id}:`, error);
        }
      }

      return { downloaded, conflicts };

    } catch (error) {
      console.error('❌ 서버 다운로드 실패:', error);
      return { downloaded: 0, conflicts: 0 };
    }
  }

  // 전체 동기화 실행
  async performFullSync(): Promise<SyncResult> {
    console.log('🔄 전체 동기화 시작...');

    try {
      // 1. 서버로 업로드
      const uploadResult = await this.uploadToServer();

      // 2. 서버에서 다운로드
      const downloadResult = await this.downloadFromServer();

      // 3. 메타데이터 업데이트
      this.metadata = {
        clientId: this.clientId,
        lastSyncAt: Date.now(),
        serverVersion: '1.0.0',
        clientVersion: '1.0.0'
      };
      await this.saveMetadata();

      const result: SyncResult = {
        success: true,
        uploaded: uploadResult.uploaded,
        downloaded: downloadResult.downloaded,
        conflicts: downloadResult.conflicts,
        errors: uploadResult.errors,
        lastSyncAt: this.metadata.lastSyncAt
      };

      console.log('✅ 동기화 완료:', result);
      return result;

    } catch (error) {
      console.error('❌ 동기화 실패:', error);
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: [error.message],
        lastSyncAt: 0
      };
    }
  }

  // 동기화 필요성 확인
  async checkSyncNeeded(): Promise<boolean> {
    const pendingOps = this.syncQueue.filter(op => op.status === 'pending');
    const hasPendingOps = pendingOps.length > 0;

    // 서버 변경사항 확인
    let hasServerChanges = false;
    try {
      const lastSync = this.metadata?.lastSyncAt || 0;
      const response = await fetch(`/api/sync/check?since=${lastSync}`);
      if (response.ok) {
        const data = await response.json();
        hasServerChanges = data.hasChanges;
      }
    } catch (error) {
      console.error('서버 변경사항 확인 실패:', error);
    }

    return hasPendingOps || hasServerChanges;
  }

  // 동기화 상태 조회
  getSyncStatus(): {
    pendingOps: number;
    lastSyncAt: number | null;
    clientId: string;
  } {
    return {
      pendingOps: this.syncQueue.filter(op => op.status === 'pending').length,
      lastSyncAt: this.metadata?.lastSyncAt || null,
      clientId: this.clientId
    };
  }

  // 동기화 큐 초기화
  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    console.log('🗑️ 동기화 큐 초기화 완료');
  }
}

export const hybridSyncService = new HybridSyncService();
