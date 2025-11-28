import { indexedDBService } from './indexeddb-service';
import type { ChannelClassificationLog } from './database-schema';
// import { postgresqlService } from './postgresql-service'; // ❌ 서버 전용 서비스 제거

interface HybridConfig {
  useIndexedDB: boolean;
  usePostgreSQL: boolean;
  syncEnabled: boolean;
}

class HybridDatabaseService {
  private config: HybridConfig = {
    useIndexedDB: true,
    usePostgreSQL: false,
    syncEnabled: false
  };

  // 설정 초기화
  async initialize(config?: Partial<HybridConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      
      // IndexedDB 초기화
      if (this.config.useIndexedDB) {
        await indexedDBService.init();
        console.log('✅ IndexedDB 초기화 완료');
      }

      // PostgreSQL 초기화 (서버 환경에서만)
      if (this.config.usePostgreSQL && typeof window === 'undefined') {
        // 서버 환경에서만 PostgreSQL 사용
        console.log('✅ PostgreSQL 초기화 완료 (서버 환경)');
      }

      console.log('✅ 하이브리드 데이터베이스 초기화 완료');
    } catch (error) {
      console.error('❌ 하이브리드 데이터베이스 초기화 실패:', error);
      throw error;
    }
  }

  // 채널 데이터 저장 (IndexedDB 우선, PostgreSQL 백업)
  async saveChannels(channels: any[]): Promise<void> {
    try {
      // IndexedDB에 저장
      if (this.config.useIndexedDB) {
        await indexedDBService.saveChannels(channels);
        console.log(`✅ ${channels.length}개 채널을 IndexedDB에 저장 완료`);
      }

      // PostgreSQL에 저장 (서버 환경에서만)
      if (this.config.usePostgreSQL && typeof window === 'undefined') {
        await postgresqlService.saveChannels(channels);
        console.log(`✅ ${channels.length}개 채널을 PostgreSQL에 저장 완료`);
      }
    } catch (error) {
      console.error('❌ 채널 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 영상 데이터 저장
  async saveVideos(videos: any[]): Promise<void> {
    try {
      // IndexedDB에 저장
      if (this.config.useIndexedDB) {
        await indexedDBService.saveVideos(videos);
        console.log(`✅ ${videos.length}개 영상을 IndexedDB에 저장 완료`);
      }

      // PostgreSQL에 저장 (서버 환경에서만)
      if (this.config.usePostgreSQL && typeof window === 'undefined') {
        await postgresqlService.saveVideos(videos);
        console.log(`✅ ${videos.length}개 영상을 PostgreSQL에 저장 완료`);
      }
    } catch (error) {
      console.error('❌ 영상 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 분류 데이터 저장
  async saveClassificationData(data: any): Promise<void> {
    try {
      // IndexedDB에 저장
      if (this.config.useIndexedDB) {
        await indexedDBService.saveClassificationData(data);
        console.log('✅ 분류 데이터를 IndexedDB에 저장 완료');
      }

      // PostgreSQL에 저장 (서버 환경에서만)
      if (this.config.usePostgreSQL && typeof window === 'undefined') {
        await postgresqlService.saveClassificationData(data);
        console.log('✅ 분류 데이터를 PostgreSQL에 저장 완료');
      }
    } catch (error) {
      console.error('❌ 분류 데이터 저장 실패:', error);
      throw error;
    }
  }

  // ✅ 신규 메서드: 수동 분류 저장 (로그 기록)
  async saveClassificationLog(
    channelId: string, 
    category: string, 
    subCategory: string,
    userId?: string // 누가 분류했는지 정보
  ): Promise<void> {
    const newLog: ChannelClassificationLog = {
      channelId,
      category,
      subCategory,
      // 현재 시점을 유효 시작 날짜로 기록 (수동 분류는 즉시 적용)
      effectiveDate: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
      userId: userId || 'manual_user',
      id: crypto.randomUUID(), // 클라이언트 측에서 UUID 생성 (IndexedDB 저장을 위해)
    };

    try {
      // 1. IndexedDB에 저장 (빠른 UI 반응을 위한 로컬 캐시)
      if (this.config.useIndexedDB) {
        // IndexedDB에 분류 로그 저장
        await indexedDBService.saveClassificationLog(newLog);
        console.log(`✅ 분류 로그 IndexedDB 저장 완료: ${channelId}`);
      }

      // 2. PostgreSQL에 저장 (기준 데이터에 기록)
      // 브라우저 환경에서는 API를 통해 서버에 저장
      if (typeof window !== 'undefined') {
        try {
          const response = await fetch('/api/sync/classification-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog),
          });

          if (!response.ok) {
            throw new Error('분류 로그 서버 저장 실패');
          }

          console.log('✅ 분류 로그 PostgreSQL 저장 완료 (API)');
        } catch (error) {
          console.error('❌ 분류 로그 서버 저장 실패:', error);
          // 서버 저장 실패해도 로컬에는 저장되었으므로 계속 진행
        }
      } else if (this.config.usePostgreSQL) {
        // 서버 환경에서 직접 PostgreSQL 서비스 사용
        // const { createPostgreSQLService } = await import('./postgresql-service-server');
        // const postgresqlService = createPostgreSQLService(/* pool */);
        // await postgresqlService.insertClassificationLog(newLog);
        console.log('⚠️ 서버 환경에서 PostgreSQL 직접 저장은 구현 필요');
      }
    } catch (error) {
      console.error('❌ 분류 로그 저장 실패:', error);
      throw error;
    }
  }

  // 채널 데이터 조회 (IndexedDB 우선) - unclassifiedData와 classifiedData에서 추출
  async getChannels(): Promise<any[]> {
    try {
      if (this.config.useIndexedDB) {
        const unclassifiedData = await indexedDBService.loadUnclassifiedData() || [];
        const classifiedData = await indexedDBService.loadClassifiedData() || [];
        const allData = [...unclassifiedData, ...classifiedData];
        
        // 고유한 채널 추출
        const channelMap = new Map();
        allData.forEach(item => {
          if (item.channelId && !channelMap.has(item.channelId)) {
            channelMap.set(item.channelId, {
              id: item.channelId,
              name: item.channelName,
              description: item.description
            });
          }
        });
        
        return Array.from(channelMap.values());
      }
      return [];
    } catch (error) {
      console.error('❌ 채널 데이터 조회 실패:', error);
      return [];
    }
  }

  // 영상 데이터 조회 (IndexedDB 우선) - unclassifiedData와 classifiedData 합침
  async getVideos(): Promise<any[]> {
    try {
      if (this.config.useIndexedDB) {
        const unclassifiedData = await indexedDBService.loadUnclassifiedData() || [];
        const classifiedData = await indexedDBService.loadClassifiedData() || [];
        return [...unclassifiedData, ...classifiedData];
      }
      return [];
    } catch (error) {
      console.error('❌ 영상 데이터 조회 실패:', error);
      return [];
    }
  }

  // 분류 데이터 조회
  async getClassificationData(): Promise<any[]> {
    try {
      if (this.config.useIndexedDB) {
        return await indexedDBService.loadClassifiedData() || [];
      }
      return [];
    } catch (error) {
      console.error('❌ 분류 데이터 조회 실패:', error);
      return [];
    }
  }

  // 카테고리별 통계 조회
  async getCategoryStats(): Promise<any[]> {
    try {
      if (this.config.useIndexedDB) {
        return await indexedDBService.getCategoryStats();
      }
      return [];
    } catch (error) {
      console.error('❌ 카테고리 통계 조회 실패:', error);
      return [];
    }
  }

  // IndexedDB에서 PostgreSQL로 데이터 동기화
  async syncToPostgreSQL(): Promise<void> {
    try {
      if (!this.config.syncEnabled) {
        console.log('⚠️ 동기화가 비활성화되어 있습니다.');
        return;
      }

      console.log('🔄 IndexedDB에서 PostgreSQL로 데이터 동기화 시작...');

      // 채널 데이터 동기화
      const channels = await indexedDBService.getChannels();
      if (channels.length > 0) {
        await postgresqlService.saveChannels(channels);
        console.log(`✅ ${channels.length}개 채널 동기화 완료`);
      }

      // 영상 데이터 동기화
      const videos = await indexedDBService.getVideos();
      if (videos.length > 0) {
        await postgresqlService.saveVideos(videos);
        console.log(`✅ ${videos.length}개 영상 동기화 완료`);
      }

      // 분류 데이터 동기화
      const classificationData = await indexedDBService.getClassificationData();
      if (classificationData.length > 0) {
        await postgresqlService.saveClassificationData(classificationData);
        console.log(`✅ ${classificationData.length}개 분류 데이터 동기화 완료`);
      }

      console.log('✅ 데이터 동기화 완료');
    } catch (error) {
      console.error('❌ 데이터 동기화 실패:', error);
      throw error;
    }
  }

  // PostgreSQL에서 IndexedDB로 데이터 동기화
  async syncFromPostgreSQL(): Promise<void> {
    if (!this.config.syncEnabled) {
      console.log('⚠️ 동기화가 비활성화되어 있습니다.');
      return;
    }

    console.log('🔄 API 게이트웨이를 통한 동기화 시작...');
    
    try {
      // 1. 마지막 동기화 시간 가져오기 (증분 동기화 준비)
      const lastSyncTime = localStorage.getItem('last_sync_time') || '1970-01-01T00:00:00.000Z';
      console.log('📅 마지막 동기화 시간:', lastSyncTime);

      // 2. 서버의 동기화 게이트웨이 API에 요청
      const response = await fetch('/api/sync/download', {
        method: 'POST', // POST를 사용해 body에 데이터 전달
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSyncTime }), // 마지막 동기화 시간 전달
      });

      console.log('📡 서버 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        // 더 자세한 에러 정보 수집
        let errorMessage = `API를 통한 동기화 실패 (${response.status} ${response.statusText})`;
        try {
          const errorData = await response.json();
          errorMessage += `: ${errorData.error || errorData.message || JSON.stringify(errorData)}`;
          console.error('❌ 서버 에러 응답:', errorData);
        } catch (e) {
          const errorText = await response.text();
          errorMessage += `: ${errorText || '알 수 없는 오류'}`;
          console.error('❌ 서버 에러 텍스트:', errorText);
        }
        throw new Error(errorMessage);
      }

      // 3. 서버에서 받은 최신 데이터를 IndexedDB에 저장
      const data = await response.json();
      console.log('📥 서버에서 받은 데이터:', {
        channels: data.channels?.length || 0,
        videos: data.videos?.length || 0,
        classificationData: data.classificationData?.length || 0,
        unclassifiedData: data.unclassifiedData?.length || 0,
      });

      if (data.channels?.length > 0 || data.videos?.length > 0 || data.classificationData?.length > 0 || data.unclassifiedData?.length > 0) {
        if (data.channels?.length > 0) {
          await indexedDBService.saveChannels(data.channels || []);
        }
        if (data.videos?.length > 0) {
          await indexedDBService.saveVideos(data.videos || []);
        }
        if (data.classificationData?.length > 0) {
          await indexedDBService.saveClassificationData(data.classificationData || []);
        }
        if (data.unclassifiedData?.length > 0) {
          await indexedDBService.saveUnclassifiedData(data.unclassifiedData || []);
        }
        console.log(`✅ 최신 데이터 동기화 완료: 채널 ${data.channels?.length || 0}개, 영상 ${data.videos?.length || 0}개, 분류 ${data.classificationData?.length || 0}개, 미분류 ${data.unclassifiedData?.length || 0}개`);
      } else {
        console.log('✨ 이미 최신 상태입니다. (서버 응답)');
      }

      // 4. 동기화 시간 갱신 (증분 동기화를 위해)
      localStorage.setItem('last_sync_time', new Date().toISOString());
      console.log('✅ 동기화 완료 및 시간 갱신');
    } catch (error) {
      console.error('❌ 동기화 중 오류 발생:', error);
      // 네트워크 오류인 경우 더 자세한 정보 제공
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('네트워크 오류: 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
      }
      throw error;
    }
  }

  // 설정 업데이트
  updateConfig(newConfig: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ 하이브리드 데이터베이스 설정 업데이트:', this.config);
  }

  // 현재 설정 조회
  getConfig(): HybridConfig {
    return { ...this.config };
  }

  // 데이터베이스 상태 확인
  async getStatus(): Promise<{
    indexeddb: boolean;
    postgresql: boolean;
    syncEnabled: boolean;
    totalChannels: number;
    totalVideos: number;
    totalClassificationData: number;
  }> {
    try {
      const channels = await this.getChannels();
      const videos = await this.getVideos();
      const classificationData = await this.getClassificationData();

      return {
        indexeddb: this.config.useIndexedDB,
        postgresql: this.config.usePostgreSQL,
        syncEnabled: this.config.syncEnabled,
        totalChannels: channels.length,
        totalVideos: videos.length,
        totalClassificationData: classificationData.length
      };
    } catch (error) {
      console.error('❌ 데이터베이스 상태 확인 실패:', error);
      return {
        indexeddb: false,
        postgresql: false,
        syncEnabled: false,
        totalChannels: 0,
        totalVideos: 0,
        totalClassificationData: 0
      };
    }
  }
}

export const hybridDatabaseService = new HybridDatabaseService();
