// 자정 전환 감지 및 날짜 그리드 재생성 서비스
import { getKoreanDateString } from './utils';

interface RolloverState {
  lastCheckedDate: string;
  lastGeneratedDateKey: string;
  isProcessing: boolean;
  requestKey: string;
}

class DateRolloverService {
  private state: RolloverState = {
    lastCheckedDate: '',
    lastGeneratedDateKey: '',
    isProcessing: false,
    requestKey: ''
  };

  private callbacks: Set<(dateKey: string) => void> = new Set();
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private lastCleanupDate: string = '';

  constructor() {
    // localStorage에서 마지막 정리 날짜 복원
    const savedCleanupDate = localStorage.getItem('lastCleanupDate');
    if (savedCleanupDate) {
      this.lastCleanupDate = savedCleanupDate;
      console.log('📅 마지막 정리 날짜 복원:', savedCleanupDate);
    }
    
    this.initialize();
  }

  private initialize() {
    // 앱 시작 시 즉시 평가
    console.log('🔄 앱 시작 - 자정 전환 즉시 평가');
    this.checkRollover();
    
    // 가시성 변경 감지
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // 로그 제거 - 필요시에만 출력
        this.checkRollover();
      }
    });

    // 5분 간격 가드 (중복 작업 방지)
    this.intervalId = setInterval(() => {
      // 로그 제거 - 필요시에만 출력
      this.checkRollover();
    }, 5 * 60 * 1000); // 5분
    
    // 14일 데이터 자동 정리 (매일 새벽 1시 KST)
    this.cleanupIntervalId = setInterval(() => {
      this.checkAndPerformCleanup();
    }, 60 * 60 * 1000); // 1시간마다 체크
    
    // 앱 시작 시 즉시 정리 체크
    this.checkAndPerformCleanup();
  }
  
  // 새벽 1시(KST) 확인 및 데이터 정리 실행
  private async checkAndPerformCleanup(): Promise<void> {
    try {
      const now = new Date();
      const kstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const kstHour = kstTime.getHours();
      const kstDate = kstTime.toISOString().split('T')[0];
      
      // 새벽 1시(01:00~01:59)이고, 오늘 아직 정리하지 않았으면 실행
      if (kstHour === 1 && this.lastCleanupDate !== kstDate) {
        console.log('🕐 새벽 1시(KST) 감지 - 14일 데이터 자동 정리 시작');
        await this.performDailyCleanup();
        this.lastCleanupDate = kstDate;
        
        // localStorage에 마지막 정리 날짜 저장 (재시작 시에도 중복 방지)
        localStorage.setItem('lastCleanupDate', kstDate);
      }
    } catch (error) {
      console.error('❌ 정리 시간 체크 실패:', error);
    }
  }

  private async checkRollover() {
    if (this.state.isProcessing) {
      console.log('🔄 자정 전환 확인 중 - 이미 처리 중');
      return;
    }

    const today = getKoreanDateString();
    
    // 아이템포턴트 가드: 이미 생성된 날짜면 스킵
    if (this.state.lastGeneratedDateKey === today) {
      // 로그 제거 - 정상 동작
      return;
    }
    
    if (this.state.lastCheckedDate === today) {
      // 로그 제거 - 정상 동작
      return;
    }

    console.log('🔄 자정 전환 감지:', this.state.lastCheckedDate, '→', today);
    
    this.state.isProcessing = true;
    this.state.requestKey = `rollover_${Date.now()}`;
    
    try {
      console.time('rollover-compute');
      
      // 오늘 수집 스케줄링 (중복 방지) - 독립 실행
      try {
        await this.scheduleTodayCollection(today);
      } catch (collectionError) {
        console.error('❌ 수집 스케줄링 실패 (그리드 생성은 계속):', collectionError);
        // 수집 실패해도 그리드 생성은 계속 진행
      }
      
      console.timeEnd('rollover-compute');
      console.time('rollover-commit');
      
      // 콜백 실행 (상태 갱신 → 렌더 타이밍 고정)
      this.callbacks.forEach(callback => {
        try {
          callback(today);
        } catch (error) {
          console.error('❌ 자정 전환 콜백 실행 실패:', error);
        }
      });
      
      // 상태 동기 커밋
      this.state.lastCheckedDate = today;
      this.state.lastGeneratedDateKey = today;
      
      console.timeEnd('rollover-commit');
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
    // ✅ 클라이언트 자동 수집 완전 비활성화 (서버 전용)
    // 서버의 cron job이 자동 수집을 처리하므로 클라이언트는 실행하지 않음
    console.log('🔄 수집 실행:', dateKey);
    console.log('ℹ️ 클라이언트 수집 비활성화 (서버 전용) - 즉시 완료');
    
    // 수집 비활성화로 인해 즉시 완료 (지연 없음)
    return;
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

  // 14일 데이터 자동 정리 콜백 등록
  async performDailyCleanup(): Promise<void> {
    try {
      console.log('🗑️ 로컬 14일 데이터 정리 시작...');
      const { indexedDBService } = await import('./indexeddb-service');
      const deletedCount = await indexedDBService.cleanupOldData(14);
      console.log(`✅ 로컬 ${deletedCount}개의 오래된 데이터 삭제 완료`);
    } catch (error) {
      console.error('❌ 로컬 데이터 정리 실패:', error);
    }
  }

  // 강제 재평가 API (디버그용)
  forceEvaluateNow(): boolean {
    console.log('🔄 강제 재평가 시작');
    console.time('rollover-force-evaluate');
    
    const todayKST = getKoreanDateString();
    const lastDateKey = this.state.lastCheckedDate;
    
    console.log('📅 날짜 비교:', { lastDateKey, todayKST });
    
    if (lastDateKey === todayKST) {
      console.log('⏭️ 날짜 변경 없음 - 스킵');
      console.timeEnd('rollover-force-evaluate');
      return false;
    }
    
    console.log('🔄 자정 전환 감지:', lastDateKey, '→', todayKST);
    
    // 상태 업데이트
    this.state.lastCheckedDate = todayKST;
    
    // 14일 데이터 자동 정리 실행
    this.performDailyCleanup();
    
    // 콜백 실행 (동기적으로)
    this.callbacks.forEach(callback => {
      try {
        console.log('🔄 콜백 실행:', todayKST);
        callback(todayKST);
      } catch (error) {
        console.error('❌ 콜백 실행 실패:', error);
      }
    });
    
    console.log('✅ 강제 재평가 완료:', todayKST);
    console.timeEnd('rollover-force-evaluate');
    return true;
  }

  // 서비스 정리
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
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
