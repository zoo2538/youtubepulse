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
      const request = indexedDB.open(this.dbName, 1);

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
   * 단일 배치 저장
   */
  private async saveBatch(batch: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB가 초기화되지 않았습니다');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      let completed = 0;
      const total = batch.length;

      if (total === 0) {
        resolve();
        return;
      }

      // 각 아이템을 저장
      batch.forEach((item, index) => {
        const putRequest = store.put(item);
        
        putRequest.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        
        putRequest.onerror = () => {
          reject(putRequest.error);
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
   * 데이터 초기화 (기존 데이터 삭제)
   */
  async clearData(): Promise<void> {
    await this.initDB();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB가 초기화되지 않았습니다'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🗑️ 기존 데이터 삭제 완료');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ 데이터 삭제 실패:', request.error);
        reject(request.error);
      };
    });
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
