// 오프라인/실패 시 로컬 아웃박스 관리 서비스
interface OutboxItem {
  id: string;
  type: 'update' | 'delete' | 'save';
  endpoint: string;
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'failed' | 'completed';
  error?: string;
}

interface OutboxConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

class OutboxService {
  private dbName = 'YouTubePulseOutbox';
  private dbVersion = 1;
  private storeName = 'outbox';
  private config: OutboxConfig;

  constructor(config: Partial<OutboxConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 5000, // 5초
      batchSize: 10,
      ...config
    };
  }

  // IndexedDB 초기화
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('status', 'status');
          store.createIndex('type', 'type');
        }
      };
    });
  }

  // 아웃박스에 작업 추가
  async addToOutbox(
    type: 'update' | 'delete' | 'save',
    endpoint: string,
    payload: any
  ): Promise<string> {
    const id = `outbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const item: OutboxItem = {
      id,
      type,
      endpoint,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending'
    };

    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.add(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log(`📦 아웃박스 추가: ${type} ${endpoint}`, item);
      return id;
    } catch (error) {
      console.error('❌ 아웃박스 추가 실패:', error);
      throw error;
    }
  }

  // 대기 중인 작업들 조회
  async getPendingItems(): Promise<OutboxItem[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ 대기 작업 조회 실패:', error);
      return [];
    }
  }

  // 작업 상태 업데이트
  async updateItemStatus(
    id: string, 
    status: 'pending' | 'failed' | 'completed',
    error?: string
  ): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // 기존 아이템 조회
      const getRequest = store.get(id);
      
      await new Promise<void>((resolve, reject) => {
        getRequest.onsuccess = () => {
          const item = getRequest.result;
          if (item) {
            item.status = status;
            item.error = error;
            if (status === 'failed') {
              item.retries += 1;
            }
            
            // 상태 업데이트
            const putRequest = store.put(item);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            reject(new Error('Item not found'));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });

      console.log(`📦 아웃박스 상태 업데이트: ${id} → ${status}`);
    } catch (error) {
      console.error('❌ 아웃박스 상태 업데이트 실패:', error);
      throw error;
    }
  }

  // 완료된 작업 제거
  async removeCompletedItems(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      
      await new Promise<void>((resolve, reject) => {
        const request = index.getAllKeys('completed');
        request.onsuccess = () => {
          const keys = request.result;
          if (keys.length === 0) {
            resolve();
            return;
          }
          
          let completed = 0;
          keys.forEach(key => {
            const deleteRequest = store.delete(key);
            deleteRequest.onsuccess = () => {
              completed++;
              if (completed === keys.length) {
                resolve();
              }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        };
        request.onerror = () => reject(request.error);
      });

      console.log('🗑️ 완료된 아웃박스 작업 제거 완료');
    } catch (error) {
      console.error('❌ 완료된 작업 제거 실패:', error);
    }
  }

  // 아웃박스 처리 (온라인 시 자동 실행)
  async processOutbox(): Promise<{ success: number; failed: number }> {
    const pendingItems = await this.getPendingItems();
    
    if (pendingItems.length === 0) {
      console.log('📦 처리할 아웃박스 작업 없음');
      return { success: 0, failed: 0 };
    }

    console.log(`📦 아웃박스 처리 시작: ${pendingItems.length}개 작업`);

    let successCount = 0;
    let failedCount = 0;

    // 배치 크기만큼 나누어 처리
    for (let i = 0; i < pendingItems.length; i += this.config.batchSize) {
      const batch = pendingItems.slice(i, i + this.config.batchSize);
      
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            // 재시도 횟수 확인
            if (item.retries >= item.maxRetries) {
              await this.updateItemStatus(item.id, 'failed', 'Max retries exceeded');
              failedCount++;
              return;
            }

            // API 요청 실행
            const response = await fetch(item.endpoint, {
              method: item.type === 'update' ? 'PATCH' : item.type === 'delete' ? 'DELETE' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload)
            });

            if (response.ok) {
              await this.updateItemStatus(item.id, 'completed');
              successCount++;
              console.log(`✅ 아웃박스 작업 성공: ${item.type} ${item.endpoint}`);
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
          } catch (error) {
            console.error(`❌ 아웃박스 작업 실패: ${item.type} ${item.endpoint}`, error);
            await this.updateItemStatus(item.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
            failedCount++;
          }
        })
      );

      // 배치 간 지연
      if (i + this.config.batchSize < pendingItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 완료된 작업 제거
    await this.removeCompletedItems();

    console.log(`📦 아웃박스 처리 완료: 성공 ${successCount}개, 실패 ${failedCount}개`);
    return { success: successCount, failed: failedCount };
  }

  // 온라인 상태 감지 및 자동 처리
  startAutoProcess(): void {
    // 페이지 로드 시 온라인 상태 확인
    if (navigator.onLine) {
      setTimeout(() => this.processOutbox(), 2000); // 2초 후 처리
    }

    // 온라인 상태 변경 감지
    window.addEventListener('online', () => {
      console.log('🌐 온라인 상태 감지 - 아웃박스 처리 시작');
      setTimeout(() => this.processOutbox(), 1000);
    });

    // 주기적 처리 (5분마다)
    setInterval(() => {
      if (navigator.onLine) {
        this.processOutbox();
      }
    }, 5 * 60 * 1000);
  }

  // 아웃박스 통계 조회
  async getStats(): Promise<{ pending: number; failed: number; completed: number }> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const allItems = await new Promise<OutboxItem[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return {
        pending: allItems.filter(item => item.status === 'pending').length,
        failed: allItems.filter(item => item.status === 'failed').length,
        completed: allItems.filter(item => item.status === 'completed').length
      };
    } catch (error) {
      console.error('❌ 아웃박스 통계 조회 실패:', error);
      return { pending: 0, failed: 0, completed: 0 };
    }
  }
}

export const outboxService = new OutboxService();
export default outboxService;
