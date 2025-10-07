// IndexedDB와 API 서버를 함께 사용하는 하이브리드 서비스
import { indexedDBService } from './indexeddb-service';
import { apiService } from './api-service';

interface HybridServiceConfig {
  useApiServer: boolean;
  fallbackToLocal: boolean;
}

class HybridService {
  private config: HybridServiceConfig;

  constructor() {
    // 개발 환경 감지
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
    
    this.config = {
      useApiServer: true, // 항상 API 서버 사용 (개발/프로덕션 모두)
      fallbackToLocal: true, // API 실패시 로컬 사용
    };
    
    if (isDevelopment) {
      console.log('🔧 개발 환경: IndexedDB + PostgreSQL (하이브리드)');
    } else {
      console.log('🌐 프로덕션 환경: IndexedDB + PostgreSQL (하이브리드)');
    }
  }

  // 설정 업데이트
  updateConfig(config: Partial<HybridServiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  // 채널 데이터 저장
  async saveChannels(channels: Record<string, any>): Promise<void> {
    try {
      // API 서버에 저장
      if (this.config.useApiServer) {
        const result = await apiService.saveChannels(channels);
        if (result.success) {
          console.log('✅ API 서버에 채널 데이터 저장 완료');
        } else {
          throw new Error(result.error || 'API 저장 실패');
        }
      }

      // 로컬에도 저장 (백업용)
      await indexedDBService.saveChannels(channels);
      console.log('✅ 로컬 IndexedDB에 채널 데이터 저장 완료');
    } catch (error) {
      console.error('❌ 채널 데이터 저장 실패:', error);
      
      // API 실패시 로컬만 사용
      if (this.config.fallbackToLocal) {
        await indexedDBService.saveChannels(channels);
        console.log('⚠️ 로컬 IndexedDB에만 저장됨');
      } else {
        throw error;
      }
    }
  }

  // 채널 데이터 조회
  async getChannels(): Promise<Record<string, any>> {
    try {
      // API 서버에서 조회
      if (this.config.useApiServer) {
        const result = await apiService.getChannels();
        if (result.success && result.data) {
          console.log('✅ API 서버에서 채널 데이터 조회 완료');
          return result.data;
        }
      }

      // API 실패시 로컬에서 조회
      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.getChannels();
        console.log('⚠️ 로컬 IndexedDB에서 채널 데이터 조회');
        return localData;
      }

      return {};
    } catch (error) {
      console.error('❌ 채널 데이터 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        return await indexedDBService.getChannels();
      }
      
      return {};
    }
  }

  // 비디오 데이터 저장
  async saveVideos(videos: Record<string, any>): Promise<void> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.saveVideos(videos);
        if (result.success) {
          console.log('✅ API 서버에 비디오 데이터 저장 완료');
        } else {
          throw new Error(result.error || 'API 저장 실패');
        }
      }

      await indexedDBService.saveVideos(videos);
      console.log('✅ 로컬 IndexedDB에 비디오 데이터 저장 완료');
    } catch (error) {
      console.error('❌ 비디오 데이터 저장 실패:', error);
      
      if (this.config.fallbackToLocal) {
        await indexedDBService.saveVideos(videos);
        console.log('⚠️ 로컬 IndexedDB에만 저장됨');
      } else {
        throw error;
      }
    }
  }

  // 비디오 데이터 조회
  async getVideos(): Promise<Record<string, any>> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.getVideos();
        if (result.success && result.data) {
          console.log('✅ API 서버에서 비디오 데이터 조회 완료');
          return result.data;
        }
      }

      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.getVideos();
        console.log('⚠️ 로컬 IndexedDB에서 비디오 데이터 조회');
        return localData;
      }

      return {};
    } catch (error) {
      console.error('❌ 비디오 데이터 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        return await indexedDBService.getVideos();
      }
      
      return {};
    }
  }

  // 분류 데이터 저장
  async saveClassifiedData(data: any): Promise<void> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.saveClassifiedData(data);
        if (result.success) {
          console.log('✅ API 서버에 분류 데이터 저장 완료');
        } else {
          throw new Error(result.error || 'API 저장 실패');
        }
      }

      await indexedDBService.saveClassifiedData(data);
      console.log('✅ 로컬 IndexedDB에 분류 데이터 저장 완료');
    } catch (error) {
      console.error('❌ 분류 데이터 저장 실패:', error);
      
      if (this.config.fallbackToLocal) {
        await indexedDBService.saveClassifiedData(data);
        console.log('⚠️ 로컬 IndexedDB에만 저장됨');
      } else {
        throw error;
      }
    }
  }

  // 분류 데이터 조회
  async getClassifiedData(): Promise<any[]> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.getClassifiedData();
        if (result.success && result.data) {
          console.log('✅ API 서버에서 분류 데이터 조회 완료');
          return result.data;
        }
      }

      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.getClassifiedData();
        console.log('⚠️ 로컬 IndexedDB에서 분류 데이터 조회');
        return localData;
      }

      return [];
    } catch (error) {
      console.error('❌ 분류 데이터 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        return await indexedDBService.getClassifiedData();
      }
      
      return [];
    }
  }

  // 미분류 데이터 저장
  async saveUnclassifiedData(data: any): Promise<void> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.saveUnclassifiedData(data);
        if (result.success) {
          console.log('✅ API 서버에 미분류 데이터 저장 완료');
        } else {
          throw new Error(result.error || 'API 저장 실패');
        }
      }

      await indexedDBService.saveUnclassifiedData(data);
      console.log('✅ 로컬 IndexedDB에 미분류 데이터 저장 완료');
    } catch (error) {
      console.error('❌ 미분류 데이터 저장 실패:', error);
      
      if (this.config.fallbackToLocal) {
        await indexedDBService.saveUnclassifiedData(data);
        console.log('⚠️ 로컬 IndexedDB에만 저장됨');
      } else {
        throw error;
      }
    }
  }

  // 미분류 데이터 조회
  async getUnclassifiedData(): Promise<any[]> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.getUnclassifiedData();
        if (result.success && result.data) {
          console.log('✅ API 서버에서 미분류 데이터 조회 완료');
          return result.data;
        }
      }

      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.getUnclassifiedData();
        console.log('⚠️ 로컬 IndexedDB에서 미분류 데이터 조회');
        return localData;
      }

      return [];
    } catch (error) {
      console.error('❌ 미분류 데이터 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        return await indexedDBService.getUnclassifiedData();
      }
      
      return [];
    }
  }

  // 미분류 데이터 로드 (getUnclassifiedData의 alias)
  async loadUnclassifiedData(): Promise<any[]> {
    try {
      // IndexedDB에서 직접 로드 (API 서버는 아직 이 기능 없음)
      const localData = await indexedDBService.loadUnclassifiedData();
      console.log('✅ 하이브리드: IndexedDB에서 미분류 데이터 로드');
      return localData;
    } catch (error) {
      console.error('❌ 미분류 데이터 로드 실패:', error);
      return [];
    }
  }

  // 날짜별 미분류 데이터 로드
  async loadUnclassifiedDataByDate(collectionDate: string): Promise<any[]> {
    try {
      const localData = await indexedDBService.loadUnclassifiedDataByDate(collectionDate);
      console.log(`✅ 하이브리드: ${collectionDate} 날짜 데이터 로드`);
      return localData;
    } catch (error) {
      console.error('❌ 날짜별 데이터 로드 실패:', error);
      return [];
    }
  }

  // 미분류 데이터 업데이트
  async updateUnclassifiedData(data: any[]): Promise<void> {
    try {
      // IndexedDB 업데이트 (save와 동일)
      await this.saveUnclassifiedData(data);
      console.log('✅ 하이브리드: 미분류 데이터 업데이트 완료');
    } catch (error) {
      console.error('❌ 미분류 데이터 업데이트 실패:', error);
      throw error;
    }
  }

  // 분류 데이터 로드
  async loadClassifiedData(): Promise<any[]> {
    try {
      const localData = await indexedDBService.loadClassifiedData();
      console.log('✅ 하이브리드: IndexedDB에서 분류 데이터 로드');
      return localData;
    } catch (error) {
      console.error('❌ 분류 데이터 로드 실패:', error);
      return [];
    }
  }

  // 날짜별 분류 데이터 로드
  async loadClassifiedByDate(date: string): Promise<any[]> {
    try {
      const localData = await indexedDBService.loadClassifiedByDate(date);
      console.log(`✅ 하이브리드: ${date} 날짜 분류 데이터 로드`);
      return localData || [];
    } catch (error) {
      console.error('❌ 날짜별 분류 데이터 로드 실패:', error);
      return [];
    }
  }

  // 일별 진행률 저장
  async saveDailyProgress(progressData: any[]): Promise<void> {
    try {
      // 로컬에 저장 (API 서버 기능은 향후 구현)
      await indexedDBService.saveDailyProgress(progressData);
      console.log('✅ 하이브리드: 일별 진행률 저장 완료');
    } catch (error) {
      console.error('❌ 일별 진행률 저장 실패:', error);
      throw error;
    }
  }

  // 사용 가능한 날짜 목록 조회
  async getAvailableDates(): Promise<string[]> {
    try {
      const dates = await indexedDBService.getAvailableDates();
      console.log('✅ 하이브리드: 사용 가능한 날짜 조회');
      return dates;
    } catch (error) {
      console.error('❌ 날짜 목록 조회 실패:', error);
      return [];
    }
  }

  // 시스템 설정 저장
  async saveSystemConfig(key: string, value: any): Promise<void> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.saveSystemConfig(key, value);
        if (result.success) {
          console.log('✅ API 서버에 시스템 설정 저장 완료');
        } else {
          throw new Error(result.error || 'API 저장 실패');
        }
      }

      await indexedDBService.saveSystemConfig(key, value);
      console.log('✅ 로컬 IndexedDB에 시스템 설정 저장 완료');
    } catch (error) {
      console.error('❌ 시스템 설정 저장 실패:', error);
      
      if (this.config.fallbackToLocal) {
        await indexedDBService.saveSystemConfig(key, value);
        console.log('⚠️ 로컬 IndexedDB에만 저장됨');
      } else {
        throw error;
      }
    }
  }

  // 시스템 설정 조회
  async getSystemConfig(key: string): Promise<any> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.getSystemConfig(key);
        if (result.success && result.data !== undefined) {
          console.log('✅ API 서버에서 시스템 설정 조회 완료');
          return result.data;
        }
      }

      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.getSystemConfig(key);
        console.log('⚠️ 로컬 IndexedDB에서 시스템 설정 조회');
        return localData;
      }

      return null;
    } catch (error) {
      console.error('❌ 시스템 설정 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        return await indexedDBService.getSystemConfig(key);
      }
      
      return null;
    }
  }

  // 세부카테고리 저장
  async saveCategories(categories: Record<string, string[]>): Promise<void> {
    try {
      // API 서버에 저장 (향후 구현)
      if (this.config.useApiServer) {
        // TODO: API 서버에 카테고리 저장 기능 추가
        console.log('⚠️ API 서버 카테고리 저장 기능은 아직 구현되지 않았습니다.');
      }

      // 로컬에 저장 (항상)
      await indexedDBService.saveCategories(categories);
      console.log('✅ 로컬 IndexedDB에 세부카테고리 저장 완료');
    } catch (error) {
      console.error('❌ 세부카테고리 저장 실패:', error);
      
      if (this.config.fallbackToLocal) {
        await indexedDBService.saveCategories(categories);
        console.log('⚠️ 로컬 IndexedDB에만 저장됨');
      } else {
        throw error;
      }
    }
  }

  // 세부카테고리 조회
  async loadCategories(): Promise<Record<string, string[]> | null> {
    try {
      // API 서버에서 조회 (향후 구현)
      if (this.config.useApiServer) {
        // TODO: API 서버에서 카테고리 조회 기능 추가
        console.log('⚠️ API 서버 카테고리 조회 기능은 아직 구현되지 않았습니다.');
      }

      // 로컬에서 조회 (항상)
      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.loadCategories();
        console.log('✅ 로컬 IndexedDB에서 세부카테고리 조회');
        return localData;
      }

      return null;
    } catch (error) {
      console.error('❌ 세부카테고리 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        return await indexedDBService.loadCategories();
      }
      
      return null;
    }
  }

  // API 서버 연결 테스트
  async testApiConnection(): Promise<boolean> {
    try {
      const result = await apiService.testConnection();
      return result.success;
    } catch (error) {
      console.error('❌ API 서버 연결 테스트 실패:', error);
      return false;
    }
  }

  // 데이터 동기화 (로컬 → API)
  async syncToApi(): Promise<void> {
    try {
      console.log('🔄 데이터 동기화 시작...');
      
      // 채널 데이터 동기화
      const channels = await indexedDBService.getChannels();
      if (Object.keys(channels).length > 0) {
        await this.saveChannels(channels);
      }

      // 비디오 데이터 동기화
      const videos = await indexedDBService.getVideos();
      if (Object.keys(videos).length > 0) {
        await this.saveVideos(videos);
      }

      // 분류 데이터 동기화
      const classifiedData = await indexedDBService.getClassifiedData();
      if (classifiedData.length > 0) {
        await this.saveClassifiedData(classifiedData);
      }

      // 미분류 데이터 동기화
      const unclassifiedData = await indexedDBService.getUnclassifiedData();
      if (unclassifiedData.length > 0) {
        await this.saveUnclassifiedData(unclassifiedData);
      }

      console.log('✅ 데이터 동기화 완료');
    } catch (error) {
      console.error('❌ 데이터 동기화 실패:', error);
      throw error;
    }
  }
}

export const hybridService = new HybridService();
export default hybridService;
