import { indexedDBService } from './indexeddb-service';
import { hybridDatabaseService } from './hybrid-database-service';

class DataMigrationService {
  // IndexedDB에서 PostgreSQL로 모든 데이터 마이그레이션
  async migrateAllDataToPostgreSQL(): Promise<{
    success: boolean;
    message: string;
    migratedData: {
      channels: number;
      videos: number;
      classificationData: number;
    };
  }> {
    try {
      console.log('🔄 IndexedDB에서 PostgreSQL로 데이터 마이그레이션 시작...');

      // 1. 채널 데이터 마이그레이션 (하이브리드 방식)
      const channels = await hybridDatabaseService.getChannels();
      let migratedChannels = 0;
      if (channels.length > 0) {
        await hybridDatabaseService.saveChannels(channels);
        migratedChannels = channels.length;
        console.log(`✅ ${channels.length}개 채널 마이그레이션 완료`);
      }

      // 2. 영상 데이터 마이그레이션 (하이브리드 방식)
      const videos = await hybridDatabaseService.getVideos();
      let migratedVideos = 0;
      if (videos.length > 0) {
        await hybridDatabaseService.saveVideos(videos);
        migratedVideos = videos.length;
        console.log(`✅ ${videos.length}개 영상 마이그레이션 완료`);
      }

      // 3. 분류 데이터 마이그레이션 (하이브리드 방식)
      const classificationData = await hybridDatabaseService.getClassificationData();
      let migratedClassificationData = 0;
      if (classificationData.length > 0) {
        await hybridDatabaseService.saveClassificationData(classificationData);
        migratedClassificationData = classificationData.length;
        console.log(`✅ ${classificationData.length}개 분류 데이터 마이그레이션 완료`);
      }

      // 4. 서버로 데이터 동기화 (API 호출)
      await this.syncToServer(channels, videos, classificationData);

      console.log('✅ 모든 데이터 마이그레이션 완료');

      return {
        success: true,
        message: '데이터 마이그레이션이 성공적으로 완료되었습니다.',
        migratedData: {
          channels: migratedChannels,
          videos: migratedVideos,
          classificationData: migratedClassificationData
        }
      };

    } catch (error) {
      console.error('❌ 데이터 마이그레이션 실패:', error);
      return {
        success: false,
        message: `데이터 마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        migratedData: {
          channels: 0,
          videos: 0,
          classificationData: 0
        }
      };
    }
  }

  // 서버로 데이터 동기화
  private async syncToServer(channels: any[], videos: any[], classificationData: any[]): Promise<void> {
    try {
      const apiBaseUrl = process.env.VITE_APP_URL || 'https://api.youthbepulse.com';
      
      // 채널 데이터 동기화
      if (channels.length > 0) {
        const response = await fetch(`${apiBaseUrl}/api/sync/channels`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channels })
        });
        
        if (!response.ok) {
          throw new Error(`채널 동기화 실패: ${response.statusText}`);
        }
        
        console.log('✅ 서버로 채널 데이터 동기화 완료');
      }

      // 영상 데이터 동기화
      if (videos.length > 0) {
        const response = await fetch(`${apiBaseUrl}/api/sync/videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videos })
        });
        
        if (!response.ok) {
          throw new Error(`영상 동기화 실패: ${response.statusText}`);
        }
        
        console.log('✅ 서버로 영상 데이터 동기화 완료');
      }

      // 분류 데이터 동기화
      if (classificationData.length > 0) {
        for (const data of classificationData) {
          const response = await fetch(`${apiBaseUrl}/api/sync/classification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data })
          });
          
          if (!response.ok) {
            throw new Error(`분류 데이터 동기화 실패: ${response.statusText}`);
          }
        }
        
        console.log('✅ 서버로 분류 데이터 동기화 완료');
      }

    } catch (error) {
      console.error('❌ 서버 동기화 실패:', error);
      throw error;
    }
  }

  // 마이그레이션 상태 확인 (하이브리드 방식)
  async getMigrationStatus(): Promise<{
    indexeddbData: {
      channels: number;
      videos: number;
      classificationData: number;
    };
    canMigrate: boolean;
  }> {
    try {
      // 하이브리드 데이터베이스 서비스 사용
      const channels = await hybridDatabaseService.getChannels();
      const videos = await hybridDatabaseService.getVideos();
      const classificationData = await hybridDatabaseService.getClassificationData();

      return {
        indexeddbData: {
          channels: channels.length,
          videos: videos.length,
          classificationData: classificationData.length
        },
        canMigrate: channels.length > 0 || videos.length > 0 || classificationData.length > 0
      };
    } catch (error) {
      console.error('❌ 마이그레이션 상태 확인 실패:', error);
      return {
        indexeddbData: {
          channels: 0,
          videos: 0,
          classificationData: 0
        },
        canMigrate: false
      };
    }
  }

  // 서버에서 데이터 조회
  async getServerData(): Promise<{
    channels: any[];
    videos: any[];
    stats: any;
  }> {
    try {
      const apiBaseUrl = process.env.VITE_APP_URL || 'https://api.youthbepulse.com';
      
      const [channelsResponse, videosResponse, statsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/data/channels`),
        fetch(`${apiBaseUrl}/api/data/videos`),
        fetch(`${apiBaseUrl}/api/data/stats`)
      ]);

      const channels = await channelsResponse.json();
      const videos = await videosResponse.json();
      const stats = await statsResponse.json();

      return { channels, videos, stats };
    } catch (error) {
      console.error('❌ 서버 데이터 조회 실패:', error);
      return {
        channels: [],
        videos: [],
        stats: { categoryStats: [], totalStats: {} }
      };
    }
  }
}

export const dataMigrationService = new DataMigrationService();
