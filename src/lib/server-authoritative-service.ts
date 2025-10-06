// 서버 권위 + 캐시-어사이드 강제 서비스
import { hybridService } from './hybrid-service';
import { indexedDBService } from './indexeddb-service';

interface TelemetryData {
  operation: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
}

class ServerAuthoritativeService {
  private telemetry: TelemetryData[] = [];

  // 서버 우선 읽기 (IndexedDB 폴백)
  async readWithServerFirst<T>(
    serverFetch: () => Promise<T>,
    idbKey: string,
    fallbackKey?: string
  ): Promise<T> {
    const startTime = Date.now();
    const operation = `fetch_${idbKey}`;
    
    try {
      console.log(`🔄 서버 우선 읽기 시작: ${idbKey}`);
      
      // 1. 서버에서 데이터 가져오기
      const serverData = await serverFetch();
      console.log(`✅ 서버 데이터 로드 성공: ${idbKey}`);
      
      // 2. IndexedDB에 캐시 저장
      await this.upsertToIndexedDB(idbKey, serverData);
      console.log(`✅ IndexedDB 캐시 저장: ${idbKey}`);
      
      // 3. UI 렌더링
      this.logTelemetry({
        operation,
        startTime,
        endTime: Date.now(),
        success: true
      });
      
      return serverData;
      
    } catch (error) {
      console.error(`❌ 서버 읽기 실패: ${idbKey}`, error);
      
      // 4. IndexedDB 폴백
      try {
        const fallbackData = await this.getFromIndexedDB(fallbackKey || idbKey);
        console.log(`🔄 IndexedDB 폴백 사용: ${idbKey}`);
        
        // 오프라인 배지 표시
        this.showOfflineBadge();
        
        this.logTelemetry({
          operation,
          startTime,
          endTime: Date.now(),
          success: true
        });
        
        return fallbackData;
        
      } catch (fallbackError) {
        console.error(`❌ IndexedDB 폴백 실패: ${idbKey}`, fallbackError);
        
        this.logTelemetry({
          operation,
          startTime,
          endTime: Date.now(),
          success: false,
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        });
        
        throw fallbackError;
      }
    }
  }

  // 서버 우선 쓰기 (로컬 큐 + 배치 동기화)
  async writeWithServerFirst<T>(
    localData: T,
    serverSave: (data: T) => Promise<any>,
    idbKey: string
  ): Promise<void> {
    const startTime = Date.now();
    const operation = `save_${idbKey}`;
    
    try {
      console.log(`🔄 서버 우선 쓰기 시작: ${idbKey}`);
      
      // 1. 로컬 큐에 추가
      await this.addToLocalQueue(idbKey, localData);
      console.log(`✅ 로컬 큐 추가: ${idbKey}`);
      
      // 2. 서버에 저장
      const serverResponse = await serverSave(localData);
      console.log(`✅ 서버 저장 성공: ${idbKey}`);
      
      // 3. 서버 응답으로 IndexedDB 업데이트
      await this.upsertToIndexedDB(idbKey, serverResponse);
      console.log(`✅ IndexedDB 서버 응답 업데이트: ${idbKey}`);
      
      // 4. 로컬 큐에서 제거
      await this.removeFromLocalQueue(idbKey);
      console.log(`✅ 로컬 큐 제거: ${idbKey}`);
      
      this.logTelemetry({
        operation,
        startTime,
        endTime: Date.now(),
        success: true
      });
      
    } catch (error) {
      console.error(`❌ 서버 쓰기 실패: ${idbKey}`, error);
      
      // 실패 시 로컬 큐에 유지 (나중에 재시도)
      console.log(`🔄 로컬 큐 유지 (재시도 대기): ${idbKey}`);
      
      this.logTelemetry({
        operation,
        startTime,
        endTime: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  // IndexedDB에 데이터 저장 (upsert 방식)
  private async upsertToIndexedDB<T>(key: string, data: T): Promise<void> {
    try {
      // 기존 데이터와 병합 (서버 데이터 우선)
      const existingData = await this.getFromIndexedDB(key);
      const mergedData = this.mergeData(existingData, data);
      
      await indexedDBService.saveData(key, mergedData);
      console.log(`✅ IndexedDB upsert 완료: ${key}`);
      
    } catch (error) {
      console.error(`❌ IndexedDB upsert 실패: ${key}`, error);
      throw error;
    }
  }

  // IndexedDB에서 데이터 가져오기
  private async getFromIndexedDB<T>(key: string): Promise<T> {
    try {
      const data = await indexedDBService.loadData(key);
      return data as T;
    } catch (error) {
      console.error(`❌ IndexedDB 읽기 실패: ${key}`, error);
      throw error;
    }
  }

  // 데이터 병합 (서버 데이터 우선)
  private mergeData<T>(existing: T, incoming: T): T {
    if (!existing) return incoming;
    if (!incoming) return existing;
    
    // 간단한 병합 로직 (실제로는 더 복잡한 로직 필요)
    return { ...existing, ...incoming };
  }

  // 로컬 큐 관리
  private async addToLocalQueue<T>(key: string, data: T): Promise<void> {
    try {
      const queue = JSON.parse(localStorage.getItem('local_write_queue') || '[]');
      queue.push({
        key,
        data,
        timestamp: Date.now()
      });
      localStorage.setItem('local_write_queue', JSON.stringify(queue));
    } catch (error) {
      console.error('❌ 로컬 큐 추가 실패:', error);
      throw error;
    }
  }

  private async removeFromLocalQueue(key: string): Promise<void> {
    try {
      const queue = JSON.parse(localStorage.getItem('local_write_queue') || '[]');
      const updatedQueue = queue.filter((item: any) => item.key !== key);
      localStorage.setItem('local_write_queue', JSON.stringify(updatedQueue));
    } catch (error) {
      console.error('❌ 로컬 큐 제거 실패:', error);
      throw error;
    }
  }

  // 오프라인 배지 표시
  private showOfflineBadge(): void {
    // 오프라인 상태 표시 로직
    console.log('🔄 오프라인 모드 활성화');
    
    // 실제로는 UI에 오프라인 배지 표시
    const badge = document.createElement('div');
    badge.textContent = '오프라인 모드';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff6b6b;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      z-index: 9999;
      font-size: 12px;
    `;
    document.body.appendChild(badge);
    
    // 3초 후 제거
    setTimeout(() => {
      if (badge.parentNode) {
        badge.parentNode.removeChild(badge);
      }
    }, 3000);
  }

  // 텔레메트리 로깅
  private logTelemetry(data: TelemetryData): void {
    this.telemetry.push(data);
    
    // 최근 100개만 유지
    if (this.telemetry.length > 100) {
      this.telemetry = this.telemetry.slice(-100);
    }
    
    console.log(`📊 텔레메트리: ${data.operation} (${data.endTime! - data.startTime}ms) ${data.success ? '✅' : '❌'}`);
  }

  // 텔레메트리 조회
  getTelemetry(): TelemetryData[] {
    return [...this.telemetry];
  }

  // 로컬 큐 재시도
  async retryLocalQueue(): Promise<void> {
    try {
      const queue = JSON.parse(localStorage.getItem('local_write_queue') || '[]');
      
      if (queue.length === 0) {
        console.log('🔄 재시도할 로컬 큐 없음');
        return;
      }

      console.log(`🔄 로컬 큐 재시도: ${queue.length}개 항목`);
      
      for (const item of queue) {
        try {
          // 서버에 재시도
          await this.writeWithServerFirst(item.data, async (data) => {
            // 실제 서버 저장 로직
            console.log('🔄 서버 재시도:', item.key);
            return data;
          }, item.key);
          
        } catch (error) {
          console.error('❌ 로컬 큐 재시도 실패:', item.key, error);
        }
      }
      
    } catch (error) {
      console.error('❌ 로컬 큐 재시도 실패:', error);
    }
  }
}

// 싱글톤 인스턴스
export const serverAuthoritativeService = new ServerAuthoritativeService();

// 전역 접근을 위한 window 객체에 등록
if (typeof window !== 'undefined') {
  (window as any).serverAuthoritativeService = serverAuthoritativeService;
}
