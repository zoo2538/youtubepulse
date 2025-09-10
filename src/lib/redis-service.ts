interface RedisConfig {
  host: string;
  port: string;
  password: string;
  database: number;
}

class RedisService {
  private config: RedisConfig | null = null;

  // 연결 설정 (브라우저에서는 localStorage 사용)
  async connect(config: RedisConfig): Promise<boolean> {
    try {
      this.config = config;
      // 브라우저 환경에서는 localStorage에 설정 저장
      localStorage.setItem('redis_config', JSON.stringify(config));
      console.log('✅ Redis 설정 저장 완료 (localStorage)');
      return true;
    } catch (error) {
      console.error('❌ Redis 설정 저장 실패:', error);
      return false;
    }
  }

  // 연결 해제
  async disconnect(): Promise<void> {
    this.config = null;
    console.log('Redis 설정 해제');
  }

  // 데이터 저장 (TTL 설정 가능)
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const data = {
        value: value,
        timestamp: Date.now(),
        ttl: ttl ? Date.now() + (ttl * 1000) : null
      };
      
      localStorage.setItem(`redis_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('❌ Redis 데이터 저장 실패:', error);
      throw error;
    }
  }

  // 데이터 조회
  async get(key: string): Promise<any> {
    try {
      const data = localStorage.getItem(`redis_${key}`);
      if (!data) return null;
      
      const parsedData = JSON.parse(data);
      
      // TTL 확인
      if (parsedData.ttl && Date.now() > parsedData.ttl) {
        localStorage.removeItem(`redis_${key}`);
        return null;
      }
      
      return parsedData.value;
    } catch (error) {
      console.error('❌ Redis 데이터 조회 실패:', error);
      return null;
    }
  }

  // 데이터 삭제
  async del(key: string): Promise<void> {
    try {
      localStorage.removeItem(`redis_${key}`);
    } catch (error) {
      console.error('❌ Redis 데이터 삭제 실패:', error);
      throw error;
    }
  }

  // 키 존재 확인
  async exists(key: string): Promise<boolean> {
    try {
      const data = localStorage.getItem(`redis_${key}`);
      if (!data) return false;
      
      const parsedData = JSON.parse(data);
      
      // TTL 확인
      if (parsedData.ttl && Date.now() > parsedData.ttl) {
        localStorage.removeItem(`redis_${key}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Redis 키 존재 확인 실패:', error);
      return false;
    }
  }

  // TTL 설정
  async expire(key: string, seconds: number): Promise<void> {
    try {
      const data = localStorage.getItem(`redis_${key}`);
      if (!data) return;
      
      const parsedData = JSON.parse(data);
      parsedData.ttl = Date.now() + (seconds * 1000);
      
      localStorage.setItem(`redis_${key}`, JSON.stringify(parsedData));
    } catch (error) {
      console.error('❌ Redis TTL 설정 실패:', error);
      throw error;
    }
  }

  // 분류 데이터 캐시 저장
  async cacheClassificationData(data: any, ttl: number = 3600): Promise<void> {
    await this.set('classification_data', data, ttl);
    console.log('✅ 분류 데이터 캐시 저장 완료 (localStorage)');
  }

  // 분류 데이터 캐시 조회
  async getCachedClassificationData(): Promise<any> {
    return await this.get('classification_data');
  }

  // 채널 데이터 캐시 저장
  async cacheChannelData(channelId: string, data: any, ttl: number = 1800): Promise<void> {
    await this.set(`channel:${channelId}`, data, ttl);
  }

  // 채널 데이터 캐시 조회
  async getCachedChannelData(channelId: string): Promise<any> {
    return await this.get(`channel:${channelId}`);
  }

  // 영상 데이터 캐시 저장
  async cacheVideoData(videoId: string, data: any, ttl: number = 1800): Promise<void> {
    await this.set(`video:${videoId}`, data, ttl);
  }

  // 영상 데이터 캐시 조회
  async getCachedVideoData(videoId: string): Promise<any> {
    return await this.get(`video:${videoId}`);
  }

  // 카테고리별 통계 캐시 저장
  async cacheCategoryStats(stats: any, ttl: number = 3600): Promise<void> {
    await this.set('category_stats', stats, ttl);
  }

  // 카테고리별 통계 캐시 조회
  async getCachedCategoryStats(): Promise<any> {
    return await this.get('category_stats');
  }

  // 검색 결과 캐시 저장
  async cacheSearchResults(query: string, results: any, ttl: number = 1800): Promise<void> {
    const key = `search:${btoa(query)}`;
    await this.set(key, results, ttl);
  }

  // 검색 결과 캐시 조회
  async getCachedSearchResults(query: string): Promise<any> {
    const key = `search:${btoa(query)}`;
    return await this.get(key);
  }

  // 모든 캐시 삭제
  async clearAllCache(): Promise<void> {
    try {
      const keys = Object.keys(localStorage);
      const redisKeys = keys.filter(key => key.startsWith('redis_'));
      
      redisKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('✅ 모든 캐시 삭제 완료 (localStorage)');
    } catch (error) {
      console.error('❌ 캐시 삭제 실패:', error);
      throw error;
    }
  }

  // 캐시 통계 조회
  async getCacheStats(): Promise<any> {
    try {
      const keys = Object.keys(localStorage);
      const redisKeys = keys.filter(key => key.startsWith('redis_'));
      
      return {
        keys: redisKeys.length,
        info: {
          'used_memory': 'localStorage 사용',
          'total_keys': redisKeys.length
        }
      };
    } catch (error) {
      console.error('❌ 캐시 통계 조회 실패:', error);
      return { keys: 0, info: {} };
    }
  }
}

export const redisService = new RedisService();


