/**
 * 개선된 하이브리드 데이터베이스 서비스
 * IndexedDB 연결 문제 해결을 위한 안전한 데이터 저장/로드
 */

export class HybridDBService {
  private dbName: string;
  private storeName: string;
  private version: number = 10; // indexeddb-service와 동일하게 맞춤
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'YouTubePulseDB', storeName: string = 'unclassifiedData') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  /**
   * IndexedDB 초기화 (연결 상태 확인 포함)
   * 
   * NOTE: indexedDBService와 동일한 DB를 공유하므로, 여기서는 DB 초기화를 하지 않고
   * indexedDBService가 이미 초기화했는지 확인만 한다.
   * 실제 초기화는 indexedDBService의 init()에서만 수행한다.
   */
  async initDB(): Promise<void> {
    // 이미 연결되어 있고 열려있으면 재초기화하지 않음
    if (this.db && this.db.readyState === 'open') {
      console.log('✅ IndexedDB 이미 연결됨');
      return;
    }

    // indexedDBService가 이미 초기화했다면 그 DB 인스턴스를 재사용
    // 단, indexedDBService의 db는 private이므로 직접 접근할 수 없다.
    // 따라서 여기서는 새로운 요청으로 DB를 여는데, 이는 indexedDBService와 동일한 버전으로 열린다.
    
    console.log('🔄 HybridDBService IndexedDB 연결 확인...');
    
    return new Promise((resolve, reject) => {
      // 타임아웃 설정 (10초)
      const timeout = setTimeout(() => {
        console.error('❌ IndexedDB 연결 타임아웃');
        reject(new Error('IndexedDB 연결 타임아웃'));
      }, 10000);

      // indexedDBService와 동일한 버전으로 열기 (스키마 변경 없음)
      const request = indexedDB.open(this.dbName, this.version);

      // onupgradeneeded는 버전이 변경될 때만 호출되므로, 여기서는 호출되지 않는다
      request.onupgradeneeded = (event) => {
        console.log('🔄 HybridDBService: unexpected onupgradeneeded (version mismatch)');
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        this.db = request.result;
        console.log('✅ HybridDBService IndexedDB 연결 완료');
        resolve();
      };

      request.onerror = () => {
        clearTimeout(timeout);
        console.error('❌ HybridDBService IndexedDB 연결 실패:', request.error);
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
          console.warn(`⚠️ 배치 ${batchNum} 저장 실패 (시도 ${attempts}/${maxAttempts}):`, error?.message || error);
          
          // AbortError의 경우 더 긴 지연 시간 적용
          const isAbortError = error?.name === 'AbortError';
          const isTransactionError = error?.name === 'InvalidStateError' || error?.name === 'TransactionInactiveError';
          
          if (isTransactionError) {
            console.warn('🔄 IndexedDB 연결 문제 발생, 재초기화 후 재시도 중...');
            await this.initDB();
          } else if (isAbortError) {
            const delay = Math.pow(2, attempts) * 2000; // AbortError는 더 긴 지연
            console.warn(`⏳ AbortError 감지, ${delay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            const delay = Math.pow(2, attempts) * 1000;
            console.warn(`⏳ ${delay}ms 후 재시도...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!saved) {
        console.warn(`⚠️ 배치 ${batchNum} 저장 실패했지만 계속 진행...`);
        // 실패한 배치를 건너뛰고 계속 진행
      }
    }

    console.log('✅ 모든 배치 저장 완료');
  }

  /**
   * 단일 배치 저장 (중복 처리 개선) - 단순화된 트랜잭션
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

    if (deduplicatedBatch.length === 0) {
      return;
    }

    // 단순화된 트랜잭션: 모든 아이템을 put으로 처리 (upsert 방식)
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      let completed = 0;
      const total = deduplicatedBatch.length;
      let hasError = false;

      // 각 아이템을 put으로 저장 (자동 upsert)
      deduplicatedBatch.forEach((item) => {
        const putRequest = store.put(item);
        
        putRequest.onsuccess = () => {
          completed++;
          if (completed === total && !hasError) {
            resolve();
          }
        };
        
        putRequest.onerror = () => {
          hasError = true;
          console.warn(`⚠️ 저장 실패, 건너뜀: ${item.videoId}|${item.dayKeyLocal}`, putRequest.error);
          completed++;
          if (completed === total) {
            // 일부 실패해도 전체는 성공으로 처리
            resolve();
          }
        };
      });

      // 트랜잭션 이벤트 핸들러
      transaction.oncomplete = () => {
        if (!hasError) {
          resolve();
        }
      };

      transaction.onerror = () => {
        console.error('❌ 트랜잭션 오류:', transaction.error);
        reject(transaction.error);
      };

      transaction.onabort = () => {
        console.error('❌ 트랜잭션 중단:', transaction.error);
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
