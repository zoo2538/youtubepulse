// 오프라인/하이브리드 복원력 서비스
// import { autoCollectionScheduler } from './auto-collection-scheduler'; // 사용하지 않음 (서버 전용)
import { serverAuthoritativeService } from './server-authoritative-service';
import { API_BASE_URL } from './config';

interface OfflineState {
  isOnline: boolean;
  lastOnlineCheck: number;
  retryQueue: Array<{
    id: string;
    operation: string;
    data: any;
    timestamp: number;
    retryCount: number;
  }>;
}

class OfflineResilienceService {
  private state: OfflineState = {
    isOnline: navigator.onLine,
    lastOnlineCheck: Date.now(),
    retryQueue: []
  };

  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY = 5000; // 5초
  private retryTimer: NodeJS.Timeout | null = null;
  private toastShown: boolean = false; // 토스트 중복 표시 방지
  private consecutiveFailures: number = 0; // 연속 실패 횟수

  constructor() {
    this.initialize();
  }

  private initialize() {
    // 온라인/오프라인 상태 감지
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // 주기적 연결 상태 확인 (60초마다, 실패 시 백오프 적용)
    setInterval(this.checkConnection, 60000); // 60초마다
    
    // 재시도 큐 처리
    this.startRetryProcessor();
  }

  private handleOnline = () => {
    console.log('🔄 온라인 상태 복원');
    this.state.isOnline = true;
    this.state.lastOnlineCheck = Date.now();
    this.consecutiveFailures = 0; // 연속 실패 횟수 초기화
    this.toastShown = false; // 토스트 플래그 초기화
    
    // 재시도 큐 처리 시작
    this.processRetryQueue();
    
    // 서버 권위 서비스 재시도
    serverAuthoritativeService.retryLocalQueue();
    
    // ⚠️ 자동 수집 스케줄러 재시도 비활성화 (서버에서만 수집)
    // autoCollectionScheduler.processRetryQueue();  // 클라이언트는 호출하지 않음
  };

  private handleOffline = () => {
    console.log('🔄 오프라인 상태 감지');
    this.state.isOnline = false;
    this.showOfflineToast();
  };

  private checkConnection = async () => {
    try {
      if (!API_BASE_URL) {
        // API_BASE_URL이 없으면 오프라인으로 표시하지 않음 (로컬 모드)
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000) // 10초 타임아웃 (더 여유있게)
      });
      
      if (response.ok) {
        this.consecutiveFailures = 0; // 성공 시 실패 횟수 초기화
        
        if (!this.state.isOnline) {
          console.log('🔄 연결 상태 복원 감지');
          this.handleOnline();
        }
      } else {
        this.consecutiveFailures++;
        // 연속 3회 실패 시에만 오프라인으로 표시 (일시적 오류 방지)
        if (this.state.isOnline && this.consecutiveFailures >= 3) {
          console.log('🔄 연결 상태 손실 감지 (연속 실패)');
          this.handleOffline();
        }
      }
    } catch (error) {
      this.consecutiveFailures++;
      // 연속 3회 실패 시에만 오프라인으로 표시 (일시적 오류 방지)
      if (this.state.isOnline && this.consecutiveFailures >= 3) {
        console.log('🔄 연결 상태 손실 감지 (오류, 연속 실패):', error);
        this.handleOffline();
      } else if (this.consecutiveFailures < 3) {
        console.log(`⚠️ 헬스체크 실패 (${this.consecutiveFailures}/3):`, error);
      }
    }
  };

  // 동적 import 실패 시 오프라인 모드로 전환
  handleDynamicImportFailure = (error: Error) => {
    console.error('❌ 동적 import 실패 - 오프라인 모드 전환:', error);
    
    // 오프라인 모드 토스트 표시
    this.showOfflineToast('모듈 로딩 실패 - 오프라인 모드로 전환');
    
    // IndexedDB-only 플로우로 전환
    this.enableIndexedDBOnlyMode();
  };

  // IndexedDB-only 모드 활성화
  private enableIndexedDBOnlyMode() {
    console.log('🔄 IndexedDB-only 모드 활성화');
    
    // 자동 수집을 IndexedDB-only로 전환
    this.state.isOnline = false;
    
    // 로컬 데이터만 사용하도록 설정
    this.showOfflineToast('로컬 데이터만 사용 중');
  }

  // 재시도 큐에 작업 추가
  addToRetryQueue = (operation: string, data: any) => {
    const id = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.state.retryQueue.push({
      id,
      operation,
      data,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    console.log(`🔄 재시도 큐에 추가: ${operation} (${id})`);
    
    // 즉시 재시도 시도
    this.processRetryQueue();
  };

  // 재시도 큐 처리
  private processRetryQueue = async () => {
    if (this.state.retryQueue.length === 0) {
      return;
    }

    console.log(`🔄 재시도 큐 처리: ${this.state.retryQueue.length}개 항목`);
    
    const successfulItems: string[] = [];
    
    for (const item of this.state.retryQueue) {
      try {
        if (item.retryCount >= this.MAX_RETRY_COUNT) {
          console.log(`❌ 최대 재시도 횟수 초과: ${item.id}`);
          successfulItems.push(item.id);
          continue;
        }
        
        // 작업 재시도
        await this.retryOperation(item);
        
        // 성공 시 큐에서 제거
        successfulItems.push(item.id);
        console.log(`✅ 재시도 성공: ${item.id}`);
        
      } catch (error) {
        console.error(`❌ 재시도 실패: ${item.id}`, error);
        item.retryCount++;
        
        // 지수 백오프 적용
        const delay = this.RETRY_DELAY * Math.pow(2, item.retryCount);
        console.log(`⏳ 재시도 지연: ${item.id} (${delay}ms)`);
      }
    }
    
    // 성공한 항목들 제거
    this.state.retryQueue = this.state.retryQueue.filter(
      item => !successfulItems.includes(item.id)
    );
    
    // 실패한 항목들이 있으면 다음에 재시도
    if (this.state.retryQueue.length > 0) {
      this.scheduleNextRetry();
    }
  };

  // 작업 재시도
  private async retryOperation(item: any): Promise<void> {
    switch (item.operation) {
      case 'auto-collection':
        // ⚠️ 자동 수집 비활성화 (서버에서만 수집)
        // await autoCollectionScheduler.triggerManualCollection();  // 클라이언트는 호출하지 않음
        console.log('⏭️ 자동 수집 재시도 비활성화 (서버 전용)');
        break;
        
      case 'server-sync':
        await serverAuthoritativeService.retryLocalQueue();
        break;
        
      default:
        console.log(`🔄 알 수 없는 작업: ${item.operation}`);
    }
  };

  // 다음 재시도 스케줄링
  private scheduleNextRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    this.retryTimer = setTimeout(() => {
      this.processRetryQueue();
    }, this.RETRY_DELAY);
  };

  // 재시도 프로세서 시작
  private startRetryProcessor() {
    // 주기적 재시도 큐 처리
    setInterval(() => {
      if (this.state.isOnline && this.state.retryQueue.length > 0) {
        this.processRetryQueue();
      }
    }, 60000); // 1분마다
  };

  // 오프라인 토스트 표시
  private showOfflineToast(message?: string) {
    // 이미 토스트가 표시 중이면 중복 표시하지 않음
    if (this.toastShown) {
      return;
    }
    
    this.toastShown = true;
    
    // 기존 토스트 제거 (혹시 모를 중복 방지)
    const existingToast = document.querySelector('.offline-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'offline-toast';
    toast.textContent = message || '오프라인 모드 - 연결 복원 시 자동 동기화';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `;
    
    // 애니메이션 추가 (스타일이 없을 때만)
    if (!document.querySelector('#offline-toast-style')) {
      const style = document.createElement('style');
      style.id = 'offline-toast-style';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // 5초 후 제거 및 플래그 초기화
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      // 온라인 상태가 아니면 플래그 유지 (다시 표시 가능하도록)
      if (this.state.isOnline) {
        this.toastShown = false;
      }
    }, 5000);
  };

  // 현재 상태 조회
  getState(): OfflineState {
    return { ...this.state };
  };

  // 서비스 정리
  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  };
}

// 싱글톤 인스턴스
export const offlineResilienceService = new OfflineResilienceService();

// 전역 접근을 위한 window 객체에 등록
if (typeof window !== 'undefined') {
  (window as any).offlineResilienceService = offlineResilienceService;
}
