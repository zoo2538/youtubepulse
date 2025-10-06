// IndexedDB 데이터 저장 서비스
import { getKoreanDateString } from './utils';

class IndexedDBService {
  private dbName = 'YouTubePulseDB';
  private version = 2;
  private db: IDBDatabase | null = null;

  // 연결 재시작
  async restartConnection(): Promise<void> {
    console.log('🔄 IndexedDB 연결 재시작 중...');
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.init();
    console.log('✅ IndexedDB 연결 재시작 완료');
  }

  // 데이터베이스 초기화
  async init(): Promise<void> {
    // 기존 연결이 있으면 닫기
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    // 연결 안정화를 위한 대기
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB 초기화 실패:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB 초기화 성공:', this.dbName);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // unclassifiedData 저장소
        if (!db.objectStoreNames.contains('unclassifiedData')) {
          const unclassifiedStore = db.createObjectStore('unclassifiedData', { keyPath: 'id' });
          unclassifiedStore.createIndex('channelName', 'channelName', { unique: false });
          unclassifiedStore.createIndex('status', 'status', { unique: false });
          unclassifiedStore.createIndex('category', 'category', { unique: false });
          // 복합 키 인덱스 추가: (videoId, dayKeyLocal)
          unclassifiedStore.createIndex('videoDay', ['videoId', 'dayKeyLocal'], { unique: true });
          unclassifiedStore.createIndex('dayKeyLocal', 'dayKeyLocal', { unique: false });
        } else {
          // 기존 저장소에 새로운 인덱스 추가
          const transaction = db.transaction(['unclassifiedData'], 'readwrite');
          const store = transaction.objectStore('unclassifiedData');
          
          // 기존 인덱스 확인 및 추가
          if (!store.indexNames.contains('videoDay')) {
            store.createIndex('videoDay', ['videoId', 'dayKeyLocal'], { unique: true });
          }
          if (!store.indexNames.contains('dayKeyLocal')) {
            store.createIndex('dayKeyLocal', 'dayKeyLocal', { unique: false });
          }
        }

        // classifiedData 저장소
        if (!db.objectStoreNames.contains('classifiedData')) {
          const classifiedStore = db.createObjectStore('classifiedData', { keyPath: 'id' });
          classifiedStore.createIndex('channelName', 'channelName', { unique: false });
          classifiedStore.createIndex('category', 'category', { unique: false });
        }

        // channels 저장소
        if (!db.objectStoreNames.contains('channels')) {
          const channelsStore = db.createObjectStore('channels', { keyPath: 'id' });
          channelsStore.createIndex('name', 'name', { unique: false });
        }

        // videos 저장소
        if (!db.objectStoreNames.contains('videos')) {
          const videosStore = db.createObjectStore('videos', { keyPath: 'id' });
          videosStore.createIndex('channelId', 'channelId', { unique: false });
          videosStore.createIndex('uploadDate', 'uploadDate', { unique: false });
        }

        // categories 저장소 (새로운 구조)
        if (!db.objectStoreNames.contains('categories')) {
          const categoriesStore = db.createObjectStore('categories', { autoIncrement: true });
        } else {
          // 기존 categories 저장소가 있으면 삭제하고 새로 생성
          db.deleteObjectStore('categories');
          const categoriesStore = db.createObjectStore('categories', { autoIncrement: true });
        }

        // subCategories 저장소
        if (!db.objectStoreNames.contains('subCategories')) {
          const subCategoriesStore = db.createObjectStore('subCategories', { keyPath: 'id', autoIncrement: true });
          subCategoriesStore.createIndex('category', 'category', { unique: false });
        }

        // systemConfig 저장소
        if (!db.objectStoreNames.contains('systemConfig')) {
          db.createObjectStore('systemConfig', { keyPath: 'key' });
        }

        // dailySummary 저장소: keyPath = date (YYYY-MM-DD)
        if (!db.objectStoreNames.contains('dailySummary')) {
          const dailySummary = db.createObjectStore('dailySummary', { keyPath: 'date' });
          dailySummary.createIndex('date', 'date', { unique: true });
        }

        // dailyProgress 저장소
        if (!db.objectStoreNames.contains('dailyProgress')) {
          const dailyProgress = db.createObjectStore('dailyProgress', { autoIncrement: true });
        }

        // classifiedByDate 저장소: 날짜별 분류 스냅샷 (keyPath = date)
        if (!db.objectStoreNames.contains('classifiedByDate')) {
          const byDate = db.createObjectStore('classifiedByDate', { keyPath: 'date' });
          byDate.createIndex('date', 'date', { unique: true });
        }
      };
    });
  }

  // unclassifiedData 전체 교체 (중복 제거용)
  async replaceAllUnclassifiedData(data: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      // 1. 전체 데이터 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 2. 새 데이터 추가
        let completed = 0;
        const total = data.length;
        
        if (total === 0) {
          resolve();
          return;
        }

        data.forEach((item) => {
          const addRequest = store.put(item);
          addRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };
          addRequest.onerror = () => reject(addRequest.error);
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // unclassifiedData 저장 - 완전 안전한 백업 복원 패턴
  async saveUnclassifiedData(data: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    if (data.length === 0) {
      return Promise.resolve();
    }

    console.log(`🔄 백업 복원 시작: ${data.length}개 항목`);
    
    // 1. 비동기 준비: 날짜 키 단일화 (KST yyyy-MM-dd)
    const normalizedData = data.map(item => {
      const dayKeyLocal = this.normalizeDayKey(item.dayKeyLocal || item.collectionDate || item.uploadDate);
      return {
        ...item,
        dayKeyLocal,
        // ID 보장
        id: item.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`
      };
    });
    
    console.log(`✅ 날짜 키 단일화 완료: ${normalizedData.length}개 항목`);
    
    // 2. 단일 트랜잭션으로 완전 직렬 처리
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      let completed = 0;
      let errors = 0;
      const total = deduplicatedData.length;
      
      console.log(`🔄 단일 트랜잭션 시작: ${total}개 항목 직렬 처리`);
      
      // 3. 중복 제거 후 순차적 upsert 처리
      const uniqueItems = new Map<string, any>();
      
      // 중복 제거: (videoId, dayKeyLocal) 조합으로 유니크하게 만들기
      normalizedData.forEach(item => {
        const key = `${item.videoId}|${item.dayKeyLocal}`;
        if (uniqueItems.has(key)) {
          // 기존 항목과 병합 (최대값 보존)
          const existing = uniqueItems.get(key)!;
          const merged = {
            ...existing,
            ...item,
            viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
            likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
            // 수동 분류 우선
            status: item.status === 'classified' ? 'classified' : existing.status,
            category: item.category || existing.category,
            subCategory: item.subCategory || existing.subCategory
          };
          uniqueItems.set(key, merged);
        } else {
          uniqueItems.set(key, item);
        }
      });
      
      const deduplicatedData = Array.from(uniqueItems.values());
      console.log(`🔄 중복 제거 완료: ${normalizedData.length}개 → ${deduplicatedData.length}개`);
      
      // 4. 순차적 upsert 처리
      const processItem = (item: any, index: number) => {
        try {
          // 기존 데이터 조회
          const existingRequest = store.get(item.id);
          
          existingRequest.onsuccess = () => {
            const existing = existingRequest.result;
            let mergedItem = item;
            
            if (existing) {
              // 기존 데이터와 병합 (최대값 보존 + 수동 분류 우선)
              mergedItem = {
                ...existing,
                ...item,
                // 조회수/좋아요는 최대값 보존
                viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
                likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
                // 수동 분류 필드는 기존 값 우선 (사용자 입력 보존)
                category: existing.category || item.category,
                subCategory: existing.subCategory || item.subCategory,
                status: existing.status || item.status,
                updatedAt: new Date().toISOString()
              };
            }
            
            // upsert 실행 (put 사용, add 금지)
            const putRequest = store.put(mergedItem);
            putRequest.onsuccess = () => {
              completed++;
              if (completed + errors === total) {
                console.log(`✅ 백업 복원 완료: ${completed}개 성공, ${errors}개 실패`);
                resolve();
              }
            };
            putRequest.onerror = () => {
              console.warn(`항목 ${index} 저장 실패:`, putRequest.error);
              errors++;
              if (completed + errors === total) {
                console.log(`✅ 백업 복원 완료: ${completed}개 성공, ${errors}개 실패`);
                resolve();
              }
            };
          };
          
          existingRequest.onerror = () => {
            console.warn(`항목 ${index} 조회 실패:`, existingRequest.error);
            errors++;
            if (completed + errors === total) {
              console.log(`✅ 백업 복원 완료: ${completed}개 성공, ${errors}개 실패`);
              resolve();
            }
          };
        } catch (error) {
          console.warn(`항목 ${index} 처리 실패:`, error);
          errors++;
          if (completed + errors === total) {
            console.log(`✅ 백업 복원 완료: ${completed}개 성공, ${errors}개 실패`);
            resolve();
          }
        }
      };
      
      // 4. 순차 처리 (동시 요청 제한)
      deduplicatedData.forEach((item, index) => {
        processItem(item, index);
      });
      
      // 5. 트랜잭션 완료 감시
      transaction.oncomplete = () => {
        console.log('🎉 백업 복원 트랜잭션 완료');
      };
      
      transaction.onerror = () => {
        console.error('❌ 백업 복원 트랜잭션 실패:', transaction.error);
        reject(transaction.error);
      };
    });
  }
  
  // 날짜 키 단일화 (KST yyyy-MM-dd)
  private normalizeDayKey(dateInput: any): string {
    if (!dateInput) return new Date().toISOString().split('T')[0];
    
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      
      // KST 기준으로 yyyy-MM-dd 형식 변환
      return date.toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\./g, '-').replace(/\s/g, '');
    } catch (error) {
      console.warn('날짜 키 변환 실패:', dateInput, error);
      return new Date().toISOString().split('T')[0];
    }
  }

  // unclassifiedData 로드
  async loadUnclassifiedData(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['unclassifiedData'], 'readonly');
        const store = transaction.objectStore('unclassifiedData');
        const request = store.getAll();
        
        request.onsuccess = () => {
          console.log('✅ IndexedDB에서 미분류 데이터 로드:', request.result.length, '개');
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error('❌ 미분류 데이터 로드 실패:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('❌ IndexedDB 트랜잭션 실패:', error);
        reject(error);
      }
    });
  }

  // 특정 날짜의 unclassifiedData 로드
  async loadUnclassifiedDataByDate(collectionDate: string): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readonly');
      const store = transaction.objectStore('unclassifiedData');
      const request = store.getAll();
      
      request.onsuccess = () => {
        // collectionDate 또는 uploadDate가 일치하는 데이터만 필터링
        const filteredData = request.result.filter((item: any) => {
          const itemDate = item.collectionDate || item.uploadDate;
          return itemDate === collectionDate;
        });
        resolve(filteredData);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 사용 가능한 날짜 목록 조회 (7일 범위 자동 생성 포함)
  async getAvailableDates(): Promise<string[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const dates = new Set<string>();
        let completedRequests = 0;
        const totalRequests = 3; // unclassifiedData, classifiedData, dailyProgress
        
        const checkCompletion = () => {
          completedRequests++;
          if (completedRequests === totalRequests) {
          // 7일 범위의 날짜 자동 생성 (한국 시간 기준)
          // 한국 시간으로 오늘 날짜 계산
          const now = new Date();
          const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
          const today = koreaTime.toISOString().split('T')[0];
          
          // 7일 범위의 모든 날짜 생성 (오늘 포함)
          for (let i = 0; i < 7; i++) {
            const date = new Date(koreaTime.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            dates.add(dateStr);
          }
          
          // 백업된 날짜들도 포함 (7일 범위를 벗어나더라도)
          // 이미 dates Set에 추가된 날짜들은 중복되지 않음
          
          // 날짜 정렬 (최신순)
          const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
          console.log(`📅 사용 가능한 날짜들 (7일 범위 자동 생성): ${sortedDates.length}개`, sortedDates);
          resolve(sortedDates);
        }
      };
      
      // 1. unclassifiedData에서 날짜 조회
      const unclassifiedTransaction = this.db!.transaction(['unclassifiedData'], 'readonly');
      const unclassifiedStore = unclassifiedTransaction.objectStore('unclassifiedData');
      const unclassifiedRequest = unclassifiedStore.getAll();
      
      unclassifiedRequest.onsuccess = () => {
        unclassifiedRequest.result.forEach((item: any) => {
          const date = item.collectionDate || item.uploadDate;
          if (date) {
            dates.add(date);
          }
        });
        console.log(`📊 unclassifiedData에서 ${unclassifiedRequest.result.length}개 항목 조회`);
        checkCompletion();
      };
      unclassifiedRequest.onerror = () => {
        console.error('❌ unclassifiedData 조회 실패:', unclassifiedRequest.error);
        checkCompletion();
      };
      
      // 2. classifiedData에서 날짜 조회
      const classifiedTransaction = this.db!.transaction(['classifiedData'], 'readonly');
      const classifiedStore = classifiedTransaction.objectStore('classifiedData');
      const classifiedRequest = classifiedStore.getAll();
      
      classifiedRequest.onsuccess = () => {
        classifiedRequest.result.forEach((item: any) => {
          const date = item.collectionDate || item.uploadDate;
          if (date) {
            dates.add(date);
          }
        });
        console.log(`📊 classifiedData에서 ${classifiedRequest.result.length}개 항목 조회`);
        checkCompletion();
      };
      classifiedRequest.onerror = () => {
        console.error('classifiedData 조회 실패:', classifiedRequest.error);
        checkCompletion();
      };
      
      // 3. dailyProgress에서 날짜 조회
      const progressTransaction = this.db!.transaction(['dailyProgress'], 'readonly');
      const progressStore = progressTransaction.objectStore('dailyProgress');
      const progressRequest = progressStore.getAll();
      
      progressRequest.onsuccess = () => {
        progressRequest.result.forEach((item: any) => {
          if (item.date) {
            dates.add(item.date);
          }
        });
        console.log(`📊 dailyProgress에서 ${progressRequest.result.length}개 항목 조회`);
        checkCompletion();
      };
      progressRequest.onerror = () => {
        console.error('❌ dailyProgress 조회 실패:', progressRequest.error);
        checkCompletion();
      };
      } catch (error) {
        console.error('❌ getAvailableDates 트랜잭션 실패:', error);
        // 연결 재시작 시도
        this.restartConnection().then(() => {
          console.log('🔄 연결 재시작 후 다시 시도');
          // 재시도는 하지 않고 빈 배열 반환
          resolve([]);
        }).catch(() => {
          reject(error);
        });
      }
    });
  }

  // classifiedData 저장
  async saveClassifiedData(data: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classifiedData'], 'readwrite');
      const store = transaction.objectStore('classifiedData');
      
      // 기존 데이터 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 새 데이터 추가
        let completed = 0;
        const total = data.length;
        
        if (total === 0) {
          resolve();
          return;
        }

        data.forEach((item) => {
          const putRequest = store.put(item);
          putRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };
          putRequest.onerror = () => reject(putRequest.error);
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // classifiedData 로드
  async loadClassifiedData(): Promise<any[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classifiedData'], 'readonly');
      const store = transaction.objectStore('classifiedData');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 특정 날짜의 classifiedData만 업데이트
  async updateClassifiedDataByDate(dateData: any[], targetDate: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classifiedData'], 'readwrite');
      const store = transaction.objectStore('classifiedData');
      
      // 기존 데이터 로드
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const existingData = getAllRequest.result;
        
        // 대상 날짜의 데이터 제거
        const filteredData = existingData.filter(item => {
          const itemDate = item.collectionDate || item.uploadDate;
          return itemDate !== targetDate;
        });
        
        // 새 데이터와 기존 데이터 결합
        const combinedData = [...filteredData, ...dateData];
        
        // 모든 데이터 삭제 후 새로 저장
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          let completed = 0;
          const total = combinedData.length;
          
          if (total === 0) {
            resolve();
            return;
          }

          combinedData.forEach((item, index) => {
            // id가 없는 경우 자동 생성
            if (!item.id) {
              item.id = Date.now() + index;
            }
            const putRequest = store.put(item);
            putRequest.onsuccess = () => {
              completed++;
              if (completed === total) {
                console.log(`✅ ${targetDate} 날짜 데이터 업데이트 완료: ${dateData.length}개 추가/수정`);
                resolve();
              }
            };
            putRequest.onerror = () => reject(putRequest.error);
          });
        };
        clearRequest.onerror = () => reject(clearRequest.error);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // unclassifiedData 업데이트
  async updateUnclassifiedData(data: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    console.log('💾 IndexedDB 업데이트 - unclassifiedData:', data.length, '개');
    console.log('💾 데이터 샘플 (카테고리/세부카테고리):', data.slice(0, 3).map(item => ({
      category: item.category,
      subCategory: item.subCategory,
      channelName: item.channelName
    })));
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      let completed = 0;
      const total = data.length;
      
      if (total === 0) {
        resolve();
        return;
      }

      data.forEach((item, index) => {
        // id가 없는 경우 자동 생성
        if (!item.id) {
          item.id = Date.now() + index;
        }
        const putRequest = store.put(item);
        putRequest.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        putRequest.onerror = () => reject(putRequest.error);
      });
    });
  }

  // 특정 날짜의 unclassifiedData만 업데이트
  async updateUnclassifiedDataByDate(dateData: any[], targetDate: string): Promise<void> {
    if (!this.db) await this.init();
    
    console.log(`💾 IndexedDB 날짜별 업데이트 - ${targetDate}:`, dateData.length, '개');
    console.log('💾 데이터 샘플 (카테고리/세부카테고리):', dateData.slice(0, 3).map(item => ({
      category: item.category,
      subCategory: item.subCategory,
      channelName: item.channelName
    })));
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      // 먼저 전체 데이터를 로드
      const loadRequest = store.getAll();
      loadRequest.onsuccess = () => {
        const allData = loadRequest.result;
        
        // 해당 날짜가 아닌 데이터만 필터링
        const otherDatesData = allData.filter(item => {
          const itemDate = item.collectionDate || item.uploadDate;
          return itemDate !== targetDate;
        });
        
        // 새로운 데이터와 기존 데이터를 합침
        const finalData = [...otherDatesData, ...dateData];
        
        // 기존 데이터를 모두 삭제하고 새로운 데이터로 교체
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          let completed = 0;
          const total = finalData.length;
          
          if (total === 0) {
            console.log(`✅ ${targetDate} 날짜 데이터 업데이트 완료: ${dateData.length}개 추가/수정`);
            resolve();
            return;
          }

          finalData.forEach((item, index) => {
            // id가 없는 경우 자동 생성
            if (!item.id) {
              item.id = Date.now() + index;
            }
            const putRequest = store.put(item);
            putRequest.onsuccess = () => {
              completed++;
              if (completed === total) {
                console.log(`✅ ${targetDate} 날짜 데이터 업데이트 완료: ${dateData.length}개 추가/수정`);
                resolve();
              }
            };
            putRequest.onerror = () => reject(putRequest.error);
          });
        };
        clearRequest.onerror = () => reject(clearRequest.error);
      };
      loadRequest.onerror = () => reject(loadRequest.error);
    });
  }

  // classifiedData 업데이트
  async updateClassifiedData(data: any[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classifiedData'], 'readwrite');
      const store = transaction.objectStore('classifiedData');
      
      let completed = 0;
      const total = data.length;
      
      if (total === 0) {
        resolve();
        return;
      }

      data.forEach((item, index) => {
        // id가 없는 경우 자동 생성
        if (!item.id) {
          item.id = Date.now() + index;
        }
        const putRequest = store.put(item);
        putRequest.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        putRequest.onerror = () => reject(putRequest.error);
      });
    });
  }

  // channels 저장
  async saveChannels(channels: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['channels'], 'readwrite');
      const store = transaction.objectStore('channels');
      
      // 기존 데이터 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 새 데이터 추가
        const channelEntries = Object.entries(channels);
        let completed = 0;
        const total = channelEntries.length;
        
        if (total === 0) {
          resolve();
          return;
        }

        channelEntries.forEach(([id, channel]: [string, any]) => {
          const addRequest = store.put({ id, ...channel });
          addRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };
          addRequest.onerror = () => reject(addRequest.error);
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // videos 저장
  async saveVideos(videos: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['videos'], 'readwrite');
      const store = transaction.objectStore('videos');
      
      // 기존 데이터 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 새 데이터 추가
        const videoEntries = Object.entries(videos);
        let completed = 0;
        const total = videoEntries.length;
        
        if (total === 0) {
          resolve();
          return;
        }

        videoEntries.forEach(([channelId, channelVideos]: [string, any]) => {
          if (Array.isArray(channelVideos)) {
            channelVideos.forEach((video: any) => {
              const addRequest = store.put({ ...video, channelId });
              addRequest.onsuccess = () => {
                completed++;
                if (completed === total) {
                  resolve();
                }
              };
              addRequest.onerror = () => reject(addRequest.error);
            });
          }
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // categories 저장 (subCategories 테이블 사용)
  async saveCategories(categories: Record<string, string[]>): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['subCategories'], 'readwrite');
      const store = transaction.objectStore('subCategories');
      
      // 기존 데이터 완전 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 새 데이터 저장 (keyPath: 'id' 사용)
        const addRequest = store.put({ 
          id: 1, // 고정 ID 사용
          type: 'categories',
          data: categories,
          timestamp: new Date().toISOString()
        });
        addRequest.onsuccess = () => {
          console.log('✅ 카테고리 저장 완료:', categories);
          resolve();
        };
        addRequest.onerror = (error) => {
          console.error('❌ 카테고리 저장 실패:', error);
          reject(addRequest.error);
        };
      };
      clearRequest.onerror = (error) => {
        console.error('❌ 카테고리 삭제 실패:', error);
        reject(clearRequest.error);
      };
    });
  }

  // categories 로드 (subCategories 테이블 사용)
  async loadCategories(): Promise<Record<string, string[]> | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['subCategories'], 'readonly');
      const store = transaction.objectStore('subCategories');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result;
        // type이 'categories'인 가장 최근 데이터 찾기
        const categoriesData = results
          .filter(item => item.type === 'categories')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        resolve(categoriesData?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // dailyProgress 저장 (단일 객체 또는 배열)
  async saveDailyProgress(progressData: any | any[]): Promise<void> {
    if (!this.db) await this.init();
    
    console.log('🔍 saveDailyProgress 호출됨 - 매개변수:', typeof progressData, progressData);
    
    // 데이터 유효성 검사 및 정규화
    let dataArray: any[] = [];
    
    if (Array.isArray(progressData)) {
      dataArray = progressData.filter(item => item && typeof item === 'object');
      console.log('🔍 배열로 처리됨:', dataArray.length, '개 항목');
    } else if (progressData && typeof progressData === 'object') {
      dataArray = [progressData];
      console.log('🔍 객체로 처리됨:', dataArray[0]);
    } else {
      console.error('❌ saveDailyProgress: 유효하지 않은 데이터 타입:', typeof progressData, progressData);
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['dailyProgress'], 'readwrite');
      const store = transaction.objectStore('dailyProgress');
      
      // 기존 데이터 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 새 데이터 추가
        let completed = 0;
        const total = dataArray.length;
        
        if (total === 0) {
          resolve();
          return;
        }

        dataArray.forEach((item, index) => {
          // 객체 복사하여 원본 수정 방지
          const itemCopy = { ...item };
          
          // id가 없는 경우 자동 생성
          if (!itemCopy.id) {
            itemCopy.id = Date.now() + index;
          }
          
          const addRequest = store.put(itemCopy);
          addRequest.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          };
          addRequest.onerror = () => reject(addRequest.error);
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // subCategories 저장
  async saveSubCategories(subCategories: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['subCategories'], 'readwrite');
      const store = transaction.objectStore('subCategories');
      
      // 기존 데이터 삭제
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        // 새 데이터 추가
        const subCategoryEntries = Object.entries(subCategories);
        let completed = 0;
        const total = subCategoryEntries.length;
        
        if (total === 0) {
          resolve();
          return;
        }

        subCategoryEntries.forEach(([category, subCats]: [string, any]) => {
          if (Array.isArray(subCats)) {
            subCats.forEach((subCat: string) => {
              const addRequest = store.put({ category, subCategory: subCat });
              addRequest.onsuccess = () => {
                completed++;
                if (completed === total) {
                  resolve();
                }
              };
              addRequest.onerror = () => reject(addRequest.error);
            });
          }
        });
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });
  }

  // subCategories 로드: { [category: string]: string[] }
  async loadSubCategories(): Promise<Record<string, string[]>> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const result: Record<string, string[]> = {};
      const transaction = this.db!.transaction(['subCategories'], 'readonly');
      const store = transaction.objectStore('subCategories');
      const request = store.getAll();

      request.onsuccess = () => {
        const rows = request.result || [];
        rows.forEach((row: any) => {
          const cat = row.category;
          const sub = row.subCategory;
          if (!cat || !sub) return;
          if (!result[cat]) result[cat] = [];
          if (!result[cat].includes(sub)) result[cat].push(sub);
        });
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 시스템 설정 저장
  async saveSystemConfig(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['systemConfig'], 'readwrite');
      const store = transaction.objectStore('systemConfig');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 시스템 설정 로드
  async loadSystemConfig(key: string): Promise<any> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['systemConfig'], 'readonly');
      const store = transaction.objectStore('systemConfig');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // 데이터베이스 삭제 (초기화)
  async clearDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      
      request.onsuccess = () => {
        this.db = null;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // dailySummary 저장/업데이트 (하루 치 전체 교체)
  async saveDailySummary(date: string, summary: any): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['dailySummary'], 'readwrite');
      const store = tx.objectStore('dailySummary');
      
      // 안전한 데이터 객체 생성
      const dataToSave: any = { date };
      
      // summary가 객체인 경우에만 속성 추가
      if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
        Object.keys(summary).forEach(key => {
          // date 속성은 제외하고 다른 속성들만 추가
          if (key !== 'date') {
            dataToSave[key] = summary[key];
          }
        });
      }
      
      console.log('💾 saveDailySummary 호출:', { 
        date, 
        summaryKeys: summary ? Object.keys(summary) : [],
        dataToSaveKeys: Object.keys(dataToSave)
      });
      
      const req = store.put(dataToSave);
      req.onsuccess = () => {
        console.log('✅ dailySummary 저장 성공:', date);
        resolve();
      };
      req.onerror = () => {
        console.error('❌ dailySummary 저장 실패:', req.error, { date, dataToSave });
        reject(req.error);
      };
    });
  }

  // dailySummary 로드
  async loadDailySummary(date: string): Promise<any | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['dailySummary'], 'readonly');
      const store = tx.objectStore('dailySummary');
      const req = store.get(date);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // 날짜별 분류 스냅샷 저장/업데이트 (해당 일자 전체 교체)
  async saveClassifiedByDate(date: string, items: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['classifiedByDate'], 'readwrite');
      const store = tx.objectStore('classifiedByDate');
      const req = store.put({ date, items });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // 날짜별 분류 스냅샷 로드
  async loadClassifiedByDate(date: string): Promise<any[] | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['classifiedByDate'], 'readonly');
      const store = tx.objectStore('classifiedByDate');
      const req = store.get(date);
      req.onsuccess = () => {
        const result = req.result;
        resolve(result?.items || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // 모든 데이터의 collectionDate를 특정 날짜로 업데이트
  async updateAllCollectionDates(targetDate: string): Promise<number> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = tx.objectStore('unclassifiedData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const allData = getAllRequest.result;
        console.log(`📊 전체 데이터: ${allData.length}개`);
        
        // 모든 데이터의 collectionDate를 목표 날짜로 수정
        const updatedData = allData.map(item => ({
          ...item,
          collectionDate: targetDate
        }));
        
        let updatedCount = 0;
        let errorCount = 0;
        
        updatedData.forEach((item, index) => {
          const updateRequest = store.put(item);
          
          updateRequest.onsuccess = () => {
            updatedCount++;
            if (updatedCount % 100 === 0) {
              console.log(`✅ ${updatedCount}/${allData.length} 업데이트 완료`);
            }
            
            if (updatedCount + errorCount === allData.length) {
              console.log(`🎉 업데이트 완료! 총 ${updatedCount}개 데이터를 ${targetDate}로 변경`);
              resolve(updatedCount);
            }
          };
          
          updateRequest.onerror = () => {
            errorCount++;
            console.error(`❌ ${index + 1}번째 데이터 업데이트 실패:`, updateRequest.error);
            
            if (updatedCount + errorCount === allData.length) {
              console.log(`⚠️ 업데이트 완료: ${updatedCount}개 성공, ${errorCount}개 실패`);
              resolve(updatedCount);
            }
          };
        });
      };
      
      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    });
  }

  // 저장된 날짜 목록 로드
  async listClassifiedDates(): Promise<string[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['classifiedByDate'], 'readonly');
      const store = tx.objectStore('classifiedByDate');
      const keysReq = store.getAllKeys();
      keysReq.onsuccess = () => {
        const keys = (keysReq.result || []) as string[];
        resolve(keys);
      };
      keysReq.onerror = () => reject(keysReq.error);
    });
  }

  // 14일 데이터 정리
  async cleanupOldData(retentionDays: number = 14): Promise<number> {
    if (!this.db) await this.init();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    let totalDeleted = 0;
    
    // unclassifiedData에서 오래된 데이터 삭제
    const unclassifiedTransaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
    const unclassifiedStore = unclassifiedTransaction.objectStore('unclassifiedData');
    const unclassifiedRequest = unclassifiedStore.getAll();
    
    await new Promise<void>((resolve) => {
      unclassifiedRequest.onsuccess = () => {
        const oldData = unclassifiedRequest.result.filter((item: any) => {
          const itemDate = new Date(item.uploadDate);
          return itemDate < cutoffDate;
        });
        
        oldData.forEach((item: any) => {
          unclassifiedStore.delete(item.id);
          totalDeleted++;
        });
        resolve();
      };
    });
    
    // classifiedData에서 오래된 데이터 삭제
    const classifiedTransaction = this.db!.transaction(['classifiedData'], 'readwrite');
    const classifiedStore = classifiedTransaction.objectStore('classifiedData');
    const classifiedRequest = classifiedStore.getAll();
    
    await new Promise<void>((resolve) => {
      classifiedRequest.onsuccess = () => {
        const oldData = classifiedRequest.result.filter((item: any) => {
          const itemDate = new Date(item.uploadDate);
          return itemDate < cutoffDate;
        });
        
        oldData.forEach((item: any) => {
          classifiedStore.delete(item.id);
          totalDeleted++;
        });
        resolve();
      };
    });
    
    // videos에서 오래된 데이터 삭제
    const videosTransaction = this.db!.transaction(['videos'], 'readwrite');
    const videosStore = videosTransaction.objectStore('videos');
    const videosRequest = videosStore.getAll();
    
    await new Promise<void>((resolve) => {
      videosRequest.onsuccess = () => {
        const oldData = videosRequest.result.filter((item: any) => {
          const itemDate = new Date(item.uploadDate);
          return itemDate < cutoffDate;
        });
        
        oldData.forEach((item: any) => {
          videosStore.delete(item.id);
          totalDeleted++;
        });
        resolve();
      };
    });
    
    // dailySummary에서 오래된 데이터 삭제 (date 키 비교)
    const dailySummaryTransaction = this.db!.transaction(['dailySummary'], 'readwrite');
    const dailySummaryStore = dailySummaryTransaction.objectStore('dailySummary');
    const dailySummaryRequest = dailySummaryStore.getAll();
    
    await new Promise<void>((resolve) => {
      dailySummaryRequest.onsuccess = () => {
        const rows = dailySummaryRequest.result || [];
        rows.forEach((row: any) => {
          const d = (row?.date || '').toString();
          if (d && d < cutoffDateString) {
            dailySummaryStore.delete(row.date);
            totalDeleted++;
          }
        });
        resolve();
      };
    });
    
    console.log(`🧹 7일 데이터 정리 완료: ${totalDeleted}개 데이터 삭제`);
    return totalDeleted;
  }

  // 데이터베이스 정보 조회
  async getDatabaseInfo(): Promise<any> {
    if (!this.db) await this.init();
    
    const info = {
      name: this.dbName,
      version: this.version,
      objectStores: Array.from(this.db!.objectStoreNames),
      size: 0,
      retentionDays: 7,
      lastCleanup: null
    };

    // 각 저장소의 데이터 개수 조회
    for (const storeName of info.objectStores) {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const countRequest = store.count();
      
      await new Promise<void>((resolve) => {
        countRequest.onsuccess = () => {
          info.size += countRequest.result;
          resolve();
        };
      });
    }

    // 시스템 설정의 보관기간 값 반영
    try {
      const savedRetention = await this.loadSystemConfig('retentionDays');
      if (typeof savedRetention === 'number' && savedRetention > 0) {
        info.retentionDays = savedRetention;
      }
    } catch {}

    return info;
  }

  // ID로 미분류 데이터 삭제
  async deleteUnclassifiedDataByIds(ids: number[]): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      let completedCount = 0;
      const totalCount = ids.length;
      
      if (totalCount === 0) {
        resolve();
        return;
      }
      
      ids.forEach(id => {
        const deleteRequest = store.delete(id);
        deleteRequest.onsuccess = () => {
          completedCount++;
          if (completedCount === totalCount) {
            console.log(`✅ IndexedDB에서 ${totalCount}개 데이터 삭제 완료`);
            resolve();
          }
        };
        deleteRequest.onerror = () => {
          console.error(`❌ ID ${id} 삭제 실패:`, deleteRequest.error);
          reject(deleteRequest.error);
        };
      });
    });
  }

  // 특정 날짜의 데이터 삭제 (수집일 기준)
  async deleteDataByDate(collectionDate: string): Promise<void> {
    if (!this.db) await this.init();
    
    console.log(`🗑️ ${collectionDate} 날짜 데이터 삭제 시작...`);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData', 'classifiedData'], 'readwrite');
      const unclassifiedStore = transaction.objectStore('unclassifiedData');
      const classifiedStore = transaction.objectStore('classifiedData');
      
      let unclassifiedCompleted = false;
      let classifiedCompleted = false;
      let totalDeleted = 0;
      
      const checkCompletion = () => {
        if (unclassifiedCompleted && classifiedCompleted) {
          console.log(`✅ ${collectionDate} 날짜 데이터 삭제 완료: ${totalDeleted}개 삭제`);
          resolve();
        }
      };
      
      // unclassifiedData에서 해당 날짜 데이터 삭제
      const unclassifiedRequest = unclassifiedStore.getAll();
      unclassifiedRequest.onsuccess = () => {
        const unclassifiedData = unclassifiedRequest.result;
        const targetUnclassifiedData = unclassifiedData.filter((item: any) => {
          const itemDate = item.collectionDate || item.uploadDate;
          return itemDate && itemDate.split('T')[0] === collectionDate;
        });
        
        console.log(`📊 unclassifiedData에서 삭제할 데이터: ${targetUnclassifiedData.length}개`);
        
        if (targetUnclassifiedData.length === 0) {
          unclassifiedCompleted = true;
          checkCompletion();
        } else {
          let deletedCount = 0;
          targetUnclassifiedData.forEach((item: any) => {
            const deleteRequest = unclassifiedStore.delete(item.id);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              totalDeleted++;
              if (deletedCount === targetUnclassifiedData.length) {
                unclassifiedCompleted = true;
                checkCompletion();
              }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      };
      
      // classifiedData에서 해당 날짜 데이터 삭제
      const classifiedRequest = classifiedStore.getAll();
      classifiedRequest.onsuccess = () => {
        const classifiedData = classifiedRequest.result;
        const targetClassifiedData = classifiedData.filter((item: any) => {
          const itemDate = item.collectionDate || item.uploadDate;
          return itemDate && itemDate.split('T')[0] === collectionDate;
        });
        
        console.log(`📊 classifiedData에서 삭제할 데이터: ${targetClassifiedData.length}개`);
        
        if (targetClassifiedData.length === 0) {
          classifiedCompleted = true;
          checkCompletion();
        } else {
          let deletedCount = 0;
          targetClassifiedData.forEach((item: any) => {
            const deleteRequest = classifiedStore.delete(item.id);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              totalDeleted++;
              if (deletedCount === targetClassifiedData.length) {
                classifiedCompleted = true;
                checkCompletion();
              }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      };
      
      unclassifiedRequest.onerror = () => reject(unclassifiedRequest.error);
      classifiedRequest.onerror = () => reject(classifiedRequest.error);
    });
  }
  // 멱등 복원을 위한 강화된 upsert (videoId, dayKeyLocal 기준)
  async idempotentUpsertUnclassifiedData(data: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      const videoDayIndex = store.index('videoDay');
      
      let completed = 0;
      let merged = 0;
      let newRecords = 0;
      const total = data.length;
      
      if (total === 0) {
        resolve();
        return;
      }
      
      console.log(`🔄 IndexedDB 멱등 복원 시작: ${total}개 레코드`);
      
      data.forEach((item) => {
        // dayKeyLocal이 없으면 생성
        if (!item.dayKeyLocal && item.collectionDate) {
          const date = new Date(item.collectionDate);
          item.dayKeyLocal = date.toISOString().split('T')[0];
        }
        
        const key = [item.videoId, item.dayKeyLocal];
        const getRequest = videoDayIndex.get(key);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            // 기존 레코드가 있으면 최대값으로 병합 (멱등)
            const existing = getRequest.result;
            const updated = {
              ...existing,
              viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
              likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
              channelName: item.channelName || existing.channelName,
              videoTitle: item.videoTitle || existing.videoTitle,
              videoDescription: item.videoDescription || existing.videoDescription,
              thumbnailUrl: item.thumbnailUrl || existing.thumbnailUrl,
              category: item.category || existing.category,
              subCategory: item.subCategory || existing.subCategory,
              status: item.status || existing.status,
              updatedAt: new Date().toISOString()
            };
            
            const putRequest = store.put(updated);
            putRequest.onsuccess = () => {
              merged++;
              completed++;
              if (completed === total) {
                console.log(`✅ IndexedDB 멱등 복원 완료: 병합 ${merged}개, 신규 ${newRecords}개`);
                resolve();
              }
            };
            putRequest.onerror = () => {
              console.error('IndexedDB 병합 실패:', putRequest.error);
              completed++;
              if (completed === total) {
                resolve(); // 일부 실패해도 계속 진행
              }
            };
          } else {
            // 새 레코드 추가
            const newItem = {
              ...item,
              id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            const addRequest = store.put(newItem);
            addRequest.onsuccess = () => {
              newRecords++;
              completed++;
              if (completed === total) {
                console.log(`✅ IndexedDB 멱등 복원 완료: 병합 ${merged}개, 신규 ${newRecords}개`);
                resolve();
              }
            };
            addRequest.onerror = () => {
              console.error('IndexedDB 추가 실패:', addRequest.error);
              completed++;
              if (completed === total) {
                resolve(); // 일부 실패해도 계속 진행
              }
            };
          }
        };
        
        getRequest.onerror = () => {
          console.error('IndexedDB 조회 실패:', getRequest.error);
          completed++;
          if (completed === total) {
            resolve(); // 일부 실패해도 계속 진행
          }
        };
      });
    });
  }

  // 최대값 보존 upsert (videoId, dayKeyLocal 기준) - 기존 호환성 유지
  async upsertUnclassifiedDataWithMaxValues(data: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      const videoDayIndex = store.index('videoDay');
      
      let completed = 0;
      const total = data.length;
      
      if (total === 0) {
        resolve();
        return;
      }

      data.forEach((item) => {
        // dayKeyLocal이 없으면 생성
        if (!item.dayKeyLocal && item.collectionDate) {
          const date = new Date(item.collectionDate);
          item.dayKeyLocal = date.toISOString().split('T')[0];
        }

        // 복합 키로 기존 데이터 조회
        const key = [item.videoId, item.dayKeyLocal];
        const getRequest = videoDayIndex.get(key);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            // 기존 데이터가 있으면 최대값 보존 업데이트
            const existing = getRequest.result;
            const updated = {
              ...existing,
              viewCount: Math.max(existing.viewCount || 0, item.viewCount || 0),
              likeCount: Math.max(existing.likeCount || 0, item.likeCount || 0),
              channelName: item.channelName || existing.channelName,
              videoTitle: item.videoTitle || existing.videoTitle,
              videoDescription: item.videoDescription || existing.videoDescription,
              thumbnailUrl: item.thumbnailUrl || existing.thumbnailUrl,
              category: item.category || existing.category,
              subCategory: item.subCategory || existing.subCategory,
              status: item.status || existing.status,
              updatedAt: new Date().toISOString()
            };
            
            const putRequest = store.put(updated);
            putRequest.onsuccess = () => {
              completed++;
              if (completed === total) resolve();
            };
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            // 기존 데이터가 없으면 새로 추가
            if (!item.id) {
              item.id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            
            const addRequest = store.put(item);
            addRequest.onsuccess = () => {
              completed++;
              if (completed === total) resolve();
            };
            addRequest.onerror = () => reject(addRequest.error);
          }
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  }
}

// 싱글톤 인스턴스 생성
export const indexedDBService = new IndexedDBService();
