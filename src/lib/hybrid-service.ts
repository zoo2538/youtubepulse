// IndexedDB와 API 서버를 함께 사용하는 하이브리드 서비스
import { indexedDBService } from './indexeddb-service';
import { apiService } from './api-service';
import { outboxService } from './outbox-service';

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

  // 부트스트랩 동기화: 로컬 데이터를 서버로 차분 업로드 (고도화)
  async bootstrapSync(): Promise<{
    success: boolean;
    uploaded: number;
    message: string;
  }> {
    try {
      console.log('🔄 부트스트랩 동기화 시작 - 차분 업로드 방식...');
      
      // 1) 로컬 IndexedDB에서 모든 데이터 가져오기
      const [localUnclassified, localClassified] = await Promise.all([
        indexedDBService.loadUnclassifiedData(),
        indexedDBService.loadClassifiedData()
      ]);
      
      const totalLocal = (localUnclassified?.length || 0) + (localClassified?.length || 0);
      console.log(`📊 로컬 데이터: 미분류 ${localUnclassified?.length || 0}개, 분류 ${localClassified?.length || 0}개, 총 ${totalLocal}개`);
      
      if (totalLocal === 0) {
        return {
          success: true,
          uploaded: 0,
          message: '업로드할 로컬 데이터가 없습니다.'
        };
      }
      
      // 2) 서버에 있는 데이터 ID 목록 가져오기
      console.log('🔍 서버 데이터 ID 목록 조회 중...');
      const idsResult = await apiService.getDataIds();
      
      let serverUnclassifiedIds: Set<string> = new Set();
      let serverClassifiedIds: Set<string> = new Set();
      
      if (idsResult.success && idsResult.data) {
        serverUnclassifiedIds = new Set(idsResult.data.unclassifiedIds);
        serverClassifiedIds = new Set(idsResult.data.classifiedIds);
        console.log(`📊 서버 기존 데이터: 미분류 ${serverUnclassifiedIds.size}개, 분류 ${serverClassifiedIds.size}개`);
      } else {
        console.log('⚠️ 서버 데이터 ID 조회 실패, 전체 업로드 진행');
      }
      
      // 3) 차분 계산: 서버에 없는 데이터만 필터링
      const newUnclassified = localUnclassified?.filter(item => 
        !serverUnclassifiedIds.has(String(item.id))
      ) || [];
      
      const newClassified = localClassified?.filter(item => 
        !serverClassifiedIds.has(String(item.id))
      ) || [];
      
      const totalNew = newUnclassified.length + newClassified.length;
      console.log(`📊 차분 계산 결과: 새로운 데이터 ${totalNew}개 (미분류: ${newUnclassified.length}개, 분류: ${newClassified.length}개)`);
      console.log(`📊 중복 제외: 미분류 ${(localUnclassified?.length || 0) - newUnclassified.length}개, 분류 ${(localClassified?.length || 0) - newClassified.length}개`);
      
      if (totalNew === 0) {
        return {
          success: true,
          uploaded: 0,
          message: '서버에 이미 모든 데이터가 있습니다. 업로드할 새 데이터가 없습니다.'
        };
      }
      
      let totalUploaded = 0;
      const chunkSize = 500; // 배치 크기
      
      // 4) 새로운 미분류 데이터만 배치 업로드 (청크 단위)
      if (newUnclassified && newUnclassified.length > 0) {
        console.log(`📤 새로운 미분류 데이터 업로드 시작: ${newUnclassified.length}개`);
        
        for (let i = 0; i < newUnclassified.length; i += chunkSize) {
          const chunk = newUnclassified.slice(i, i + chunkSize);
          const chunkNum = Math.floor(i / chunkSize) + 1;
          const totalChunks = Math.ceil(newUnclassified.length / chunkSize);
          
          console.log(`📦 미분류 청크 ${chunkNum}/${totalChunks} 업로드 중... (${chunk.length}개)`);
          
          try {
            const result = await apiService.saveUnclassifiedData(chunk);
            if (result.success) {
              totalUploaded += chunk.length;
              console.log(`✅ 미분류 청크 ${chunkNum}/${totalChunks} 업로드 완료`);
            } else {
              console.error(`❌ 미분류 청크 ${chunkNum} 업로드 실패:`, result.error);
            }
            
            // 청크 간 지연 (서버 부하 방지)
            if (i + chunkSize < localUnclassified.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          } catch (chunkError) {
            console.error(`❌ 미분류 청크 ${chunkNum} 업로드 오류:`, chunkError);
            // 재시도 로직 (1회)
            console.log(`🔄 청크 ${chunkNum} 재시도 중...`);
            try {
              const retryResult = await apiService.saveUnclassifiedData(chunk);
              if (retryResult.success) {
                totalUploaded += chunk.length;
                console.log(`✅ 미분류 청크 ${chunkNum} 재시도 성공`);
              }
            } catch (retryError) {
              console.error(`❌ 청크 ${chunkNum} 재시도 실패, 건너뜀`);
            }
          }
        }
        
        console.log(`✅ 미분류 데이터 전체 업로드 완료: ${totalUploaded}개`);
      }
      
      // 5) 새로운 분류 데이터만 배치 업로드 (청크 단위)
      if (newClassified && newClassified.length > 0) {
        console.log(`📤 새로운 분류 데이터 업로드 시작: ${newClassified.length}개`);
        
        for (let i = 0; i < newClassified.length; i += chunkSize) {
          const chunk = newClassified.slice(i, i + chunkSize);
          const chunkNum = Math.floor(i / chunkSize) + 1;
          const totalChunks = Math.ceil(newClassified.length / chunkSize);
          
          console.log(`📦 분류 청크 ${chunkNum}/${totalChunks} 업로드 중... (${chunk.length}개)`);
          
          try {
            const result = await apiService.saveClassifiedData(chunk);
            if (result.success) {
              totalUploaded += chunk.length;
              console.log(`✅ 분류 청크 ${chunkNum}/${totalChunks} 업로드 완료`);
            } else {
              console.error(`❌ 분류 청크 ${chunkNum} 업로드 실패:`, result.error);
            }
            
            // 청크 간 지연
            if (i + chunkSize < localClassified.length) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          } catch (chunkError) {
            console.error(`❌ 분류 청크 ${chunkNum} 업로드 오류:`, chunkError);
            // 재시도 로직 (1회)
            console.log(`🔄 청크 ${chunkNum} 재시도 중...`);
            try {
              const retryResult = await apiService.saveClassifiedData(chunk);
              if (retryResult.success) {
                totalUploaded += chunk.length;
                console.log(`✅ 분류 청크 ${chunkNum} 재시도 성공`);
              }
            } catch (retryError) {
              console.error(`❌ 청크 ${chunkNum} 재시도 실패, 건너뜀`);
            }
          }
        }
        
        console.log(`✅ 분류 데이터 전체 업로드 완료`);
      }
      
      // 4) 서버에서 최신 스냅샷 가져와서 로컬 캐시 갱신
      console.log('🔄 서버 스냅샷으로 로컬 캐시 갱신 중...');
      try {
        const [serverUnclassified, serverClassified] = await Promise.all([
          this.loadUnclassifiedData(),
          this.getClassifiedData()
        ]);
        console.log(`✅ 서버 스냅샷 재적재 완료: 미분류 ${serverUnclassified?.length || 0}개, 분류 ${serverClassified?.length || 0}개`);
      } catch (cacheError) {
        console.warn('⚠️ 캐시 갱신 실패 (데이터는 업로드됨):', cacheError);
      }
      
      console.log('✅ 부트스트랩 동기화 완료!');
      return {
        success: true,
        uploaded: totalUploaded,
        message: `${totalUploaded.toLocaleString()}개의 새로운 데이터를 서버로 업로드했습니다.\n\n중복 제외: ${totalLocal - totalNew}개`
      };
      
    } catch (error) {
      console.error('❌ 부트스트랩 동기화 실패:', error);
      return {
        success: false,
        uploaded: 0,
        message: `동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
    }
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

  // 분류 데이터 조회 (서버 우선 + 캐시 갱신)
  async getClassifiedData(): Promise<any[]> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.getClassifiedData();
        if (result.success && result.data) {
          console.log('✅ API 서버에서 분류 데이터 조회 완료:', result.data.length, '개');
          
          // 서버에서 받은 데이터로 IndexedDB 캐시 갱신
          try {
            await indexedDBService.saveClassifiedData(result.data);
            console.log('✅ IndexedDB 캐시 갱신 완료');
          } catch (cacheError) {
            console.warn('⚠️ IndexedDB 캐시 갱신 실패 (데이터는 정상 반환):', cacheError);
          }
          
          return result.data;
        }
      }

      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.loadClassifiedData();
        console.log('⚠️ 로컬 IndexedDB에서 분류 데이터 조회 (서버 연결 실패)');
        return localData;
      }

      return [];
    } catch (error) {
      console.error('❌ 분류 데이터 조회 실패:', error);
      
      if (this.config.fallbackToLocal) {
        const localData = await indexedDBService.loadClassifiedData();
        console.log('⚠️ 오류 발생, 로컬 IndexedDB 폴백');
        return localData;
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

  // 아웃박스 기반 안전한 업데이트
  async safeUpdateVideo(id: string, updateData: any): Promise<{ success: boolean; outboxId?: string }> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.updateVideo(id, updateData);
        if (result.success) {
          console.log(`✅ 비디오 업데이트 성공: ${id}`);
          return { success: true };
        } else {
          throw new Error(result.error || 'Update failed');
        }
      }
    } catch (error) {
      console.warn('⚠️ 서버 업데이트 실패, 아웃박스에 추가:', error);
      
      try {
        const outboxId = await outboxService.addToOutbox(
          'update',
          `/api/videos/${id}`,
          updateData
        );
        
        console.log(`📦 아웃박스에 추가됨: ${outboxId}`);
        return { success: false, outboxId };
      } catch (outboxError) {
        console.error('❌ 아웃박스 추가 실패:', outboxError);
        throw outboxError;
      }
    }
    
    return { success: false };
  }

  // 아웃박스 기반 안전한 삭제
  async safeDeleteVideo(id: string): Promise<{ success: boolean; outboxId?: string }> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.deleteVideo(id);
        if (result.success) {
          console.log(`✅ 비디오 삭제 성공: ${id}`);
          return { success: true };
        } else {
          throw new Error(result.error || 'Delete failed');
        }
      }
    } catch (error) {
      console.warn('⚠️ 서버 삭제 실패, 아웃박스에 추가:', error);
      
      try {
        const outboxId = await outboxService.addToOutbox(
          'delete',
          `/api/videos/${id}`,
          {}
        );
        
        console.log(`📦 아웃박스에 추가됨: ${outboxId}`);
        return { success: false, outboxId };
      } catch (outboxError) {
        console.error('❌ 아웃박스 추가 실패:', outboxError);
        throw outboxError;
      }
    }
    
    return { success: false };
  }

  // 아웃박스 기반 안전한 배치 삭제
  async safeDeleteVideosBatch(ids: string[]): Promise<{ success: boolean; outboxId?: string }> {
    try {
      if (this.config.useApiServer) {
        const result = await apiService.deleteVideosBatch(ids);
        if (result.success) {
          console.log(`✅ 배치 삭제 성공: ${ids.length}개`);
          return { success: true };
        } else {
          throw new Error(result.error || 'Batch delete failed');
        }
      }
    } catch (error) {
      console.warn('⚠️ 서버 배치 삭제 실패, 아웃박스에 추가:', error);
      
      try {
        const outboxId = await outboxService.addToOutbox(
          'delete',
          '/api/videos/batch',
          { ids }
        );
        
        console.log(`📦 아웃박스에 추가됨: ${outboxId}`);
        return { success: false, outboxId };
      } catch (outboxError) {
        console.error('❌ 아웃박스 추가 실패:', outboxError);
        throw outboxError;
      }
    }
    
    return { success: false };
  }

  // 아웃박스 초기화 및 자동 처리 시작
  initializeOutbox(): void {
    console.log('📦 아웃박스 서비스 초기화');
    outboxService.startAutoProcess();
  }

  // 아웃박스 통계 조회
  async getOutboxStats(): Promise<{ pending: number; failed: number; completed: number }> {
    return await outboxService.getStats();
  }

  // 수동 아웃박스 처리
  async processOutbox(): Promise<{ success: number; failed: number }> {
    return await outboxService.processOutbox();
  }
}

export const hybridService = new HybridService();
export default hybridService;
