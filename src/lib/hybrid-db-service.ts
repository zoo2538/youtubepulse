/**
 * 개선된 하이브리드 데이터베이스 서비스
 * IndexedDB 연결 문제 해결을 위한 안전한 데이터 저장/로드
 */

export class HybridDBService {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'YouTubePulseDB', storeName: string = 'unclassifiedData') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  /**
   * IndexedDB 초기화 (연결 상태 확인 포함)
   */
  async initDB(): Promise<void> {
    // 이미 연결되어 있고 열려있으면 재초기화하지 않음
    if (this.db && this.db.readyState === 'open') {
      console.log('✅ IndexedDB 이미 연결됨');
      return;
    }

    console.log('🔄 IndexedDB 초기화 시작...');
    
    return new Promise((resolve, reject) => {
      // 기존 데이터베이스 버전 확인 후 적절한 버전으로 열기
      const request = indexedDB.open(this.dbName);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('🔄 IndexedDB 스키마 업그레이드 중...');
        
        // unclassifiedData 스토어 생성
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // 인덱스 생성
          store.createIndex('videoId', 'videoId', { unique: false });
          store.createIndex('dayKeyLocal', 'dayKeyLocal', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('collectionDate', 'collectionDate', { unique: false });
          
          console.log(`✅ ${this.storeName} 스토어 생성 완료`);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB 초기화 완료');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB 초기화 실패:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 안전한 배치 저장 (재시도 메커니즘 포함)
   */
  async saveDataInBatches(data: any[], batchSize: number = 500): Promise<void> {
    if (!data || data.length === 0) {
      console.log('📭 저장할 데이터가 없습니다');
      return;
    }

    console.log(`💾 배치 저장 시작: ${data.length}개 데이터를 ${batchSize}개씩 처리`);
    
    await this.initDB();

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(data.length / batchSize);
      
      console.log(`📦 배치 ${batchNum}/${totalBatches} 처리 중... (${batch.length}개)`);

      let saved = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!saved && attempts < maxAttempts) {
        try {
          await this.saveBatch(batch);
          saved = true;
          console.log(`✅ 배치 ${batchNum} 저장 완료`);
        } catch (error: any) {
          attempts++;
          console.warn(`⚠️ 배치 ${batchNum} 저장 실패 (시도 ${attempts}/${maxAttempts}):`, error.message);
          
          if (error.name === 'InvalidStateError' || error.name === 'TransactionInactiveError') {
            console.warn('🔄 IndexedDB 연결 문제 발생, 재초기화 후 재시도 중...');
            await this.initDB();
          } else {
            console.error('❌ 예상치 못한 오류:', error);
            throw error;
          }
        }
      }

      if (!saved) {
        console.error(`❌ 배치 ${batchNum} 저장 실패 (최대 재시도 횟수 초과)`);
        throw new Error(`배치 ${batchNum} 저장 실패`);
      }
    }

    console.log('✅ 모든 배치 저장 완료');
  }

  /**
   * 단일 배치 저장 (중복 처리 개선)
   */
  private async saveBatch(batch: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB가 초기화되지 않았습니다');
    }

    // 배치 내 중복 제거
    const uniqueBatch = new Map();
    batch.forEach(item => {
      const key = `${item.videoId}|${item.dayKeyLocal}`;
      if (uniqueBatch.has(key)) {
        // 기존 항목과 병합 (최대값 보존)
        const existing = uniqueBatch.get(key);
        uniqueBatch.set(key, {
          ...existing,
          ...item,
          viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
          likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0)
        });
      } else {
        uniqueBatch.set(key, item);
      }
    });

    const deduplicatedBatch = Array.from(uniqueBatch.values());
    console.log(`🔄 배치 내 중복 제거: ${batch.length}개 → ${deduplicatedBatch.length}개`);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      let completed = 0;
      const total = deduplicatedBatch.length;

      if (total === 0) {
        resolve();
        return;
      }

      // 각 아이템을 안전하게 저장 (중복 처리)
      deduplicatedBatch.forEach((item, index) => {
        // 기존 데이터 확인 후 처리
        const existingRequest = store.index('videoDay').get([item.videoId, item.dayKeyLocal]);
        
        existingRequest.onsuccess = () => {
          const existing = existingRequest.result;
          
          if (existing) {
            // 기존 데이터가 있으면 업데이트 (최대값 보존)
            const updatedItem = {
              ...existing,
              ...item,
              viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
              likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
              // 수동 분류 우선
              status: item.status === 'classified' ? 'classified' : existing.status,
              category: item.category || existing.category,
              subCategory: item.subCategory || existing.subCategory
            };
            
            const updateRequest = store.put(updatedItem);
            updateRequest.onsuccess = () => {
              completed++;
              if (completed === total) {
                resolve();
              }
            };
            updateRequest.onerror = () => {
              console.warn(`⚠️ 업데이트 실패, 건너뜀: ${item.videoId}|${item.dayKeyLocal}`);
              completed++;
              if (completed === total) {
                resolve();
              }
            };
          } else {
            // 기존 데이터가 없으면 새로 추가
            const addRequest = store.add(item);
            addRequest.onsuccess = () => {
              completed++;
              if (completed === total) {
                resolve();
              }
            };
            addRequest.onerror = () => {
              console.warn(`⚠️ 추가 실패, 건너뜀: ${item.videoId}|${item.dayKeyLocal}`);
              completed++;
              if (completed === total) {
                resolve();
              }
            };
          }
        };
        
        existingRequest.onerror = () => {
          console.warn(`⚠️ 기존 데이터 확인 실패, 건너뜀: ${item.videoId}|${item.dayKeyLocal}`);
          completed++;
          if (completed === total) {
            resolve();
          }
        };
      });

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };

      transaction.onabort = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * 전체 데이터 로드
   */
  async loadAllData(): Promise<any[]> {
    await this.initDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB가 초기화되지 않았습니다'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log(`📥 데이터 로드 완료: ${request.result.length}개`);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ 데이터 로드 실패:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 데이터 초기화 (기존 데이터 삭제) - 캐시도 함께 삭제
   */
  async clearData(): Promise<void> {
    await this.initDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB가 초기화되지 않았습니다'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('🗑️ 기존 데이터 삭제 완료');
          
          // 캐시 자동 삭제 (비동기 처리)
          this.clearAssociatedCache()
            .then(() => {
              console.log('✅ 연관 캐시 삭제 완료');
              resolve();
            })
            .catch((cacheError) => {
              console.warn('⚠️ 캐시 삭제 실패 (데이터는 삭제됨):', cacheError);
              resolve(); // 데이터는 삭제되었으므로 성공으로 처리
            });
        };

        request.onerror = () => {
          console.error('❌ 데이터 삭제 실패:', request.error);
          reject(request.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * IndexedDB 삭제 시 연관 캐시 자동 삭제
   */
  private async clearAssociatedCache(): Promise<void> {
    // CacheCleanup 유틸리티 사용
    const { CacheCleanup } = await import('./cache-cleanup');
    await CacheCleanup.clearAssociatedCache();
  }

  /**
   * 날짜별 선택적 데이터 삭제
   */
  async clearDataByDate(targetDate: string): Promise<number> {
    await this.initDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB가 초기화되지 않았습니다'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // 해당 날짜의 데이터만 조회
      const index = store.index('dayKeyLocal');
      const range = IDBKeyRange.only(targetDate);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const dataToDelete = request.result;
        console.log(`🗑️ ${targetDate} 날짜 데이터 삭제 대상: ${dataToDelete.length}개`);
        
        if (dataToDelete.length === 0) {
          console.log(`📭 ${targetDate} 날짜에 삭제할 데이터가 없습니다`);
          resolve(0);
          return;
        }

        // 각 데이터 삭제
        let deletedCount = 0;
        let errorCount = 0;
        
        dataToDelete.forEach((item, index) => {
          const deleteRequest = store.delete(item.id);
          
          deleteRequest.onsuccess = () => {
            deletedCount++;
            if (deletedCount + errorCount === dataToDelete.length) {
              console.log(`✅ ${targetDate} 날짜 데이터 삭제 완료: ${deletedCount}개`);
              resolve(deletedCount);
            }
          };
          
          deleteRequest.onerror = () => {
            errorCount++;
            console.error(`❌ 데이터 삭제 실패 (ID: ${item.id}):`, deleteRequest.error);
            if (deletedCount + errorCount === dataToDelete.length) {
              console.log(`⚠️ ${targetDate} 날짜 데이터 삭제 완료: ${deletedCount}개 성공, ${errorCount}개 실패`);
              resolve(deletedCount);
            }
          };
        });
      };

      request.onerror = () => {
        console.error('❌ 날짜별 데이터 조회 실패:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 날짜별 데이터 교체 (삭제 + 저장)
   */
  async replaceDataByDate(targetDate: string, newData: any[]): Promise<number> {
    console.log(`🔄 ${targetDate} 날짜 데이터 교체 시작: ${newData.length}개`);
    
    // 1. 해당 날짜 데이터 삭제
    const deletedCount = await this.clearDataByDate(targetDate);
    console.log(`🗑️ ${targetDate} 날짜 기존 데이터 삭제: ${deletedCount}개`);
    
    // 2. 새 데이터 저장
    if (newData.length > 0) {
      await this.saveDataInBatches(newData, 500);
      console.log(`💾 ${targetDate} 날짜 새 데이터 저장: ${newData.length}개`);
    }
    
    return newData.length;
  }

  /**
   * 데이터베이스 연결 상태 확인
   */
  isConnected(): boolean {
    return this.db !== null && this.db.readyState === 'open';
  }

  /**
   * 데이터베이스 연결 종료
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔌 IndexedDB 연결 종료');
    }
  }
}

// 싱글톤 인스턴스 생성
export const hybridDBService = new HybridDBService();
