// 자정 전환 감지 및 날짜 그리드 재생성 서비스
import { getKoreanDateString } from './utils';

interface RolloverState {
  lastCheckedDate: string;
  isProcessing: boolean;
  requestKey: string;
}

class DateRolloverService {
  private state: RolloverState = {
    lastCheckedDate: '',
    isProcessing: false,
    requestKey: ''
  };

  private callbacks: Set<(dateKey: string) => void> = new Set();
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // 앱 시작 시 즉시 평가
    this.checkRollover();
    
    // 가시성 변경 감지
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('🔄 페이지 가시성 복원 - 자정 전환 재확인');
        this.checkRollover();
      }
    });

    // 5분 간격 가드 (중복 작업 방지)
    this.intervalId = setInterval(() => {
      this.checkRollover();
    }, 5 * 60 * 1000); // 5분
  }

  private async checkRollover() {
    if (this.state.isProcessing) {
      console.log('🔄 자정 전환 확인 중 - 이미 처리 중');
      return;
    }

    const today = getKoreanDateString();
    
    if (this.state.lastCheckedDate === today) {
      console.log('📅 날짜 변경 없음:', today);
      return;
    }

    console.log('🔄 자정 전환 감지:', this.state.lastCheckedDate, '→', today);
    
    this.state.isProcessing = true;
    this.state.requestKey = `rollover_${Date.now()}`;
    
    try {
      // 오늘 수집 스케줄링 (중복 방지)
      await this.scheduleTodayCollection(today);
      
      // 콜백 실행
      this.callbacks.forEach(callback => {
        try {
          callback(today);
        } catch (error) {
          console.error('❌ 자정 전환 콜백 실행 실패:', error);
        }
      });
      
      this.state.lastCheckedDate = today;
      console.log('✅ 자정 전환 처리 완료:', today);
      
    } catch (error) {
      console.error('❌ 자정 전환 처리 실패:', error);
    } finally {
      this.state.isProcessing = false;
    }
  }

  // 오늘 수집 스케줄링 (중복 실행 방지)
  async scheduleTodayCollection(dateKey: string): Promise<void> {
    const runKey = `collection_${dateKey}`;
    
    // 이미 실행된 경우 스킵
    if (sessionStorage.getItem(runKey)) {
      console.log('⏭️ 오늘 수집 이미 실행됨:', dateKey);
      return;
    }

    console.log('📅 오늘 수집 스케줄링:', dateKey);
    
    try {
      // 수집 로직 실행 (서버 우선, IndexedDB 폴백)
      await this.executeCollection(dateKey);
      
      // 실행 완료 마킹
      sessionStorage.setItem(runKey, 'true');
      console.log('✅ 오늘 수집 완료:', dateKey);
      
    } catch (error) {
      console.error('❌ 오늘 수집 실패:', error);
      throw error;
    }
  }

  private async executeCollection(dateKey: string): Promise<void> {
    // 실제 수집 로직은 여기서 구현
    // 서버 API 호출 → IndexedDB 저장
    console.log('🔄 수집 실행:', dateKey);
    
    // 임시 구현 - 실제로는 서버 API 호출
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 콜백 등록
  onRollover(callback: (dateKey: string) => void): () => void {
    this.callbacks.add(callback);
    
    // 언등록 함수 반환
    return () => {
      this.callbacks.delete(callback);
    };
  }

  // 현재 날짜 반환
  getCurrentDate(): string {
    return getKoreanDateString();
  }

  // 서비스 정리
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.callbacks.clear();
  }
}

// 싱글톤 인스턴스
export const dateRolloverService = new DateRolloverService();

// 전역 접근을 위한 window 객체에 등록
if (typeof window !== 'undefined') {
  (window as any).dateRolloverService = dateRolloverService;
}
