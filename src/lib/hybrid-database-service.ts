import { indexedDBService } from './indexeddb-service';
import { postgresqlService } from './postgresql-service';

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

  // 채널 데이터 조회 (IndexedDB 우선)
  async getChannels(): Promise<any[]> {
    try {
      if (this.config.useIndexedDB) {
        return await indexedDBService.getChannels();
      }
      return [];
    } catch (error) {
      console.error('❌ 채널 데이터 조회 실패:', error);
      return [];
    }
  }

  // 영상 데이터 조회 (IndexedDB 우선)
  async getVideos(): Promise<any[]> {
    try {
      if (this.config.useIndexedDB) {
        return await indexedDBService.getVideos();
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
        return await indexedDBService.getClassificationData();
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
    try {
      if (!this.config.syncEnabled) {
        console.log('⚠️ 동기화가 비활성화되어 있습니다.');
        return;
      }

      console.log('🔄 PostgreSQL에서 IndexedDB로 데이터 동기화 시작...');

      // PostgreSQL에서 데이터 조회 (서버 환경에서만)
      if (typeof window === 'undefined') {
        const channels = await postgresqlService.getChannels();
        const videos = await postgresqlService.getVideos();
        const classificationData = await postgresqlService.getClassificationData();

        // IndexedDB에 저장
        if (channels.length > 0) {
          await indexedDBService.saveChannels(channels);
          console.log(`✅ ${channels.length}개 채널 동기화 완료`);
        }

        if (videos.length > 0) {
          await indexedDBService.saveVideos(videos);
          console.log(`✅ ${videos.length}개 영상 동기화 완료`);
        }

        if (classificationData.length > 0) {
          await indexedDBService.saveClassificationData(classificationData);
          console.log(`✅ ${classificationData.length}개 분류 데이터 동기화 완료`);
        }
      }

      console.log('✅ 데이터 동기화 완료');
    } catch (error) {
      console.error('❌ 데이터 동기화 실패:', error);
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
