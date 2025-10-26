// 자동 수집 스케줄러 - 누락 보정 + 중복 방지
interface CollectionMetadata {
  lastRunAt: string;
  lastDateProcessed: string;
  inFlight: boolean;
}

class AutoCollectionScheduler {
  private metadata: CollectionMetadata = {
    lastRunAt: '',
    lastDateProcessed: '',
    inFlight: false
  };

  private readonly STORAGE_KEY = 'auto_collection_metadata';
  private readonly MUTEX_KEY = 'auto_collection_mutex';

  constructor() {
    this.loadMetadata();
    this.initialize();
  }

  private loadMetadata() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.metadata = { ...this.metadata, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('❌ 자동 수집 메타데이터 로드 실패:', error);
    }
  }

  private saveMetadata() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.metadata));
    } catch (error) {
      console.error('❌ 자동 수집 메타데이터 저장 실패:', error);
    }
  }

  private initialize() {
    // ✅ 클라이언트 자동 수집 완전 비활성화 (서버에서만 실행)
    // 서버의 cron job(매일 09:00 KST)이 자동 수집을 처리하므로
    // 클라이언트는 서버에서 수집한 데이터를 다운로드만 함
    
    console.log('ℹ️ 클라이언트 자동 수집 완전 비활성화 (서버 전용)');
    console.log('ℹ️ 클라이언트는 서버 데이터만 다운로드');
    
    // 모든 자동 실행 비활성화
    return;
    
    // 아래 코드는 모두 비활성화됨
    /*
    // 가시성 변경 감지 제거 (불필요)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkAndRun();
      }
    });
    */
  }

  private async checkAndRun() {
    if (this.metadata.inFlight) {
      // 로그 제거 - 정상 동작 (중복 방지)
      return;
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    
    // 오늘 이미 처리된 경우 스킵
    if (this.metadata.lastDateProcessed === today) {
      console.log('⏭️ 오늘 자동 수집 이미 완료:', today);
      return;
    }

    console.log('🔄 자동 수집 필요:', today);
    await this.runCollection(today);
  }

  private async runCollection(dateKey: string) {
    // 뮤텍스 설정
    if (sessionStorage.getItem(this.MUTEX_KEY)) {
      console.log('⏭️ 자동 수집 뮤텍스 차단');
      return;
    }

    this.metadata.inFlight = true;
    sessionStorage.setItem(this.MUTEX_KEY, 'true');
    
    const startTime = Date.now();
    console.log(`🔄 자동 수집 시작: ${dateKey} (${new Date().toISOString()})`);

    try {
      // 서버 우선 수집
      await this.executeServerCollection(dateKey);
      
      // IndexedDB에 결과 저장
      await this.saveToIndexedDB(dateKey);
      
      // 메타데이터 업데이트
      this.metadata.lastRunAt = new Date().toISOString();
      this.metadata.lastDateProcessed = dateKey;
      this.saveMetadata();
      
      const duration = Date.now() - startTime;
      console.log(`✅ 자동 수집 완료: ${dateKey} (${duration}ms)`);
      
    } catch (error) {
      console.error('❌ 자동 수집 실패:', error);
      
      // 실패 시 재시도 큐에 추가
      await this.enqueueRetry(dateKey);
      
    } finally {
      this.metadata.inFlight = false;
      sessionStorage.removeItem(this.MUTEX_KEY);
    }
  }

  private async executeServerCollection(dateKey: string): Promise<void> {
    // ⚠️ 클라이언트에서 서버 자동수집 API 호출 비활성화
    // 서버의 cron job이 자동 수집을 처리하므로 클라이언트는 호출하지 않음
    console.log('⏭️ 클라이언트 자동수집 호출 비활성화 (서버 전용)');
    return;
    
    // 아래 코드는 비활성화됨
    /*
    console.log('🔄 서버 자동 수집 실행:', dateKey);
    
    try {
      // 서버 API 호출
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://api.youthbepulse.com'}/api/auto-collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateKey })
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 서버 자동 수집 성공:', result);
      
    } catch (error) {
      console.error('❌ 서버 자동 수집 실패:', error);
      throw error;
    }
    */
  }

  private async saveToIndexedDB(dateKey: string): Promise<void> {
    console.log('🔄 IndexedDB 저장:', dateKey);
    
    try {
      // IndexedDB에 수집 결과 저장
      // 실제 구현에서는 수집된 데이터를 IndexedDB에 저장
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ IndexedDB 저장 완료');
      
    } catch (error) {
      console.error('❌ IndexedDB 저장 실패:', error);
      throw error;
    }
  }

  private async enqueueRetry(dateKey: string): Promise<void> {
    console.log('🔄 재시도 큐에 추가:', dateKey);
    
    try {
      const retryQueue = JSON.parse(localStorage.getItem('auto_collection_retry_queue') || '[]');
      retryQueue.push({
        dateKey,
        timestamp: Date.now(),
        retryCount: 0
      });
      
      localStorage.setItem('auto_collection_retry_queue', JSON.stringify(retryQueue));
      console.log('✅ 재시도 큐에 추가 완료');
      
    } catch (error) {
      console.error('❌ 재시도 큐 추가 실패:', error);
    }
  }

  // 재시도 큐 처리
  async processRetryQueue(): Promise<void> {
    try {
      const retryQueue = JSON.parse(localStorage.getItem('auto_collection_retry_queue') || '[]');
      
      if (retryQueue.length === 0) {
        return;
      }

      // 24시간 이상 된 항목 자동 제거
      const now = Date.now();
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24시간
      const validQueue = retryQueue.filter((item: any) => {
        const age = now - (item.timestamp || 0);
        if (age > MAX_AGE) {
          console.log('🗑️ 오래된 재시도 큐 항목 제거:', item.dateKey, `(${Math.round(age / 1000 / 60 / 60)}시간 경과)`);
          return false;
        }
        return true;
      });

      // 오래된 항목이 제거되었으면 저장
      if (validQueue.length !== retryQueue.length) {
        localStorage.setItem('auto_collection_retry_queue', JSON.stringify(validQueue));
        console.log(`✅ 재시도 큐 정리: ${retryQueue.length}개 → ${validQueue.length}개`);
      }

      if (validQueue.length === 0) {
        return;
      }

      console.log(`🔄 재시도 큐 처리: ${validQueue.length}개 항목`);
      
      for (const item of validQueue) {
        try {
          await this.runCollection(item.dateKey);
          // 성공 시 큐에서 제거
          const updatedQueue = validQueue.filter((q: any) => q !== item);
          localStorage.setItem('auto_collection_retry_queue', JSON.stringify(updatedQueue));
          
        } catch (error) {
          console.error('❌ 재시도 실패:', item.dateKey, error);
          item.retryCount = (item.retryCount || 0) + 1;
          
          // 최대 재시도 횟수 초과 시 큐에서 제거
          if (item.retryCount >= 3) {
            const updatedQueue = validQueue.filter((q: any) => q !== item);
            localStorage.setItem('auto_collection_retry_queue', JSON.stringify(updatedQueue));
            console.log('❌ 최대 재시도 횟수 초과:', item.dateKey);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ 재시도 큐 처리 실패:', error);
    }
  }

  // 수동 트리거
  async triggerManualCollection(): Promise<void> {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    await this.runCollection(today);
  }

  // 메타데이터 조회
  getMetadata(): CollectionMetadata {
    return { ...this.metadata };
  }
}

// 싱글톤 인스턴스
export const autoCollectionScheduler = new AutoCollectionScheduler();

// 전역 접근을 위한 window 객체에 등록
if (typeof window !== 'undefined') {
  (window as any).autoCollectionScheduler = autoCollectionScheduler;
}
