interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

class PostgreSQLService {
  private config: DatabaseConfig | null = null;

  // 연결 설정 (브라우저에서는 localStorage 사용)
  async connect(config: DatabaseConfig): Promise<boolean> {
    try {
      this.config = config;
      // 브라우저 환경에서는 localStorage에 설정 저장
      localStorage.setItem('postgresql_config', JSON.stringify(config));
      console.log('✅ PostgreSQL 설정 저장 완료 (localStorage)');
      return true;
    } catch (error) {
      console.error('❌ PostgreSQL 설정 저장 실패:', error);
      return false;
    }
  }

  // 연결 해제
  async disconnect(): Promise<void> {
    this.config = null;
    console.log('PostgreSQL 설정 해제');
  }

  // 테이블 생성 (브라우저에서는 localStorage 초기화)
  async createTables(): Promise<void> {
    try {
      // localStorage에 테이블 구조 정보 저장
      const tables = {
        channels: [],
        videos: [],
        daily_stats: [],
        classification_data: []
      };
      localStorage.setItem('postgresql_tables', JSON.stringify(tables));
      console.log('✅ PostgreSQL 테이블 구조 초기화 완료 (localStorage)');
    } catch (error) {
      console.error('❌ 테이블 초기화 실패:', error);
    }
  }

  // 분류된 데이터 저장
  async saveClassificationData(data: any): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const classificationData = {
        id: Date.now(),
        data_type: 'classification',
        data: data,
        created_at: timestamp
      };
      
      // localStorage에 분류 데이터 저장
      const existingData = JSON.parse(localStorage.getItem('postgresql_classification_data') || '[]');
      existingData.push(classificationData);
      localStorage.setItem('postgresql_classification_data', JSON.stringify(existingData));
      
      console.log('✅ 분류 데이터 저장 완료 (localStorage)');
    } catch (error) {
      console.error('❌ 분류 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 분류된 데이터 조회
  async getClassificationData(): Promise<any[]> {
    try {
      const data = localStorage.getItem('postgresql_classification_data');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ 분류 데이터 조회 실패:', error);
      return [];
    }
  }

  // 채널 데이터 저장
  async saveChannels(channels: any[]): Promise<void> {
    try {
      const existingChannels = JSON.parse(localStorage.getItem('postgresql_channels') || '[]');
      
      for (const channel of channels) {
        const existingIndex = existingChannels.findIndex((c: any) => c.channel_id === channel.channelId);
        if (existingIndex >= 0) {
          existingChannels[existingIndex] = {
            channel_id: channel.channelId,
            channel_name: channel.channelName,
            description: channel.description,
            category: channel.category,
            sub_category: channel.subCategory,
            youtube_url: channel.youtubeUrl,
            thumbnail_url: channel.thumbnailUrl,
            updated_at: new Date().toISOString()
          };
        } else {
          existingChannels.push({
            channel_id: channel.channelId,
            channel_name: channel.channelName,
            description: channel.description,
            category: channel.category,
            sub_category: channel.subCategory,
            youtube_url: channel.youtubeUrl,
            thumbnail_url: channel.thumbnailUrl,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      
      localStorage.setItem('postgresql_channels', JSON.stringify(existingChannels));
      console.log(`✅ ${channels.length}개 채널 데이터 저장 완료 (localStorage)`);
    } catch (error) {
      console.error('❌ 채널 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 영상 데이터 저장
  async saveVideos(videos: any[]): Promise<void> {
    try {
      const existingVideos = JSON.parse(localStorage.getItem('postgresql_videos') || '[]');
      
      for (const video of videos) {
        const existingIndex = existingVideos.findIndex((v: any) => v.video_id === video.videoId);
        if (existingIndex >= 0) {
          existingVideos[existingIndex] = {
            video_id: video.videoId,
            channel_id: video.channelId,
            title: video.title,
            description: video.description,
            view_count: video.viewCount,
            like_count: video.likeCount,
            comment_count: video.commentCount,
            published_at: video.publishedAt,
            thumbnail_url: video.thumbnailUrl,
            duration: video.duration,
            category: video.category,
            sub_category: video.subCategory,
            status: video.status || 'unclassified',
            updated_at: new Date().toISOString()
          };
        } else {
          existingVideos.push({
            video_id: video.videoId,
            channel_id: video.channelId,
            title: video.title,
            description: video.description,
            view_count: video.viewCount,
            like_count: video.likeCount,
            comment_count: video.commentCount,
            published_at: video.publishedAt,
            thumbnail_url: video.thumbnailUrl,
            duration: video.duration,
            category: video.category,
            sub_category: video.subCategory,
            status: video.status || 'unclassified',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      
      localStorage.setItem('postgresql_videos', JSON.stringify(existingVideos));
      console.log(`✅ ${videos.length}개 영상 데이터 저장 완료 (localStorage)`);
    } catch (error) {
      console.error('❌ 영상 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 카테고리별 통계 조회
  async getCategoryStats(): Promise<any[]> {
    try {
      const videos = JSON.parse(localStorage.getItem('postgresql_videos') || '[]');
      const stats: any = {};
      
      videos.forEach((video: any) => {
        if (video.category && video.category !== '') {
          if (!stats[video.category]) {
            stats[video.category] = {
              category: video.category,
              video_count: 0,
              total_views: 0,
              avg_views: 0
            };
          }
          stats[video.category].video_count++;
          stats[video.category].total_views += video.view_count || 0;
        }
      });
      
      // 평균 조회수 계산
      Object.values(stats).forEach((stat: any) => {
        stat.avg_views = stat.video_count > 0 ? Math.round(stat.total_views / stat.video_count) : 0;
      });
      
      return Object.values(stats).sort((a: any, b: any) => b.total_views - a.total_views);
    } catch (error) {
      console.error('❌ 카테고리 통계 조회 실패:', error);
      return [];
    }
  }
}

export const postgresqlService = new PostgreSQLService();


