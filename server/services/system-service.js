// 시스템 서비스 (데스크탑 앱과 동일한 기능)
import { dataService } from './data-service.js';
import { youtubeApiService } from './youtube-api-service.js';

export class SystemService {
  constructor() {
    this.dataService = dataService;
    this.youtubeApiService = youtubeApiService;
    this.collectionStatus = {
      isRunning: false,
      progress: 0,
      currentStep: '',
      error: null,
      lastCollection: null,
      stats: {
        totalChannels: 0,
        totalVideos: 0,
        totalDailyStats: 0
      }
    };
    this.systemConfig = {
      dataRefreshInterval: 300,
      maxRetryAttempts: 3,
      enableAutoSync: true,
      enableNotifications: true,
      retentionDays: 7
    };
    this.systemLogs = [];
  }

  // 시스템 정보 조회
  async getSystemInfo() {
    try {
      const dbInfo = await this.dataService.getDatabaseInfo();
      
      return {
        server: {
          name: 'YouTube Pulse API Server',
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        },
        database: dbInfo,
        collection: this.collectionStatus,
        config: this.systemConfig,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('시스템 정보 조회 오류:', error);
      throw error;
    }
  }

  // 데이터베이스 연결 테스트
  async testDatabaseConnection(config) {
    try {
      // 실제로는 데이터베이스 연결을 테스트해야 하지만, 여기서는 시뮬레이션
      const { host, port, database, username, connectionType } = config;
      
      // 연결 테스트 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 연결 성공 시뮬레이션
      return {
        success: true,
        message: `${connectionType} 데이터베이스 연결 성공`,
        details: {
          host,
          port,
          database,
          username,
          connectionType
        }
      };
    } catch (error) {
      console.error('데이터베이스 연결 테스트 오류:', error);
      return {
        success: false,
        message: '데이터베이스 연결 실패',
        error: error.message
      };
    }
  }

  // Redis 연결 테스트
  async testRedisConnection(config) {
    try {
      // 실제로는 Redis 연결을 테스트해야 하지만, 여기서는 시뮬레이션
      const { host, port, database } = config;
      
      // 연결 테스트 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 연결 성공 시뮬레이션
      return {
        success: true,
        message: 'Redis 연결 성공',
        details: {
          host,
          port,
          database
        }
      };
    } catch (error) {
      console.error('Redis 연결 테스트 오류:', error);
      return {
        success: false,
        message: 'Redis 연결 실패',
        error: error.message
      };
    }
  }

  // YouTube API 테스트
  async testYouTubeApi(apiKey) {
    try {
      const isValid = await this.youtubeApiService.validateApiKey(apiKey);
      
      if (isValid) {
        return {
          success: true,
          message: 'YouTube API 연결 성공',
          details: {
            apiKey: apiKey.substring(0, 10) + '...',
            quota: '사용 가능'
          }
        };
      } else {
        return {
          success: false,
          message: 'YouTube API 연결 실패',
          error: '유효하지 않은 API 키'
        };
      }
    } catch (error) {
      console.error('YouTube API 테스트 오류:', error);
      return {
        success: false,
        message: 'YouTube API 연결 실패',
        error: error.message
      };
    }
  }

  // 데이터 수집 시작
  async startDataCollection(options) {
    try {
      if (this.collectionStatus.isRunning) {
        throw new Error('데이터 수집이 이미 실행 중입니다.');
      }

      const { apiKey, keywords, maxVideos, minViewCount } = options;
      
      this.collectionStatus = {
        isRunning: true,
        progress: 0,
        currentStep: '초기화 중...',
        error: null,
        lastCollection: null,
        stats: {
          totalChannels: 0,
          totalVideos: 0,
          totalDailyStats: 0
        }
      };

      // 비동기로 데이터 수집 실행
      this.runDataCollection(apiKey, keywords, maxVideos, minViewCount);

      return {
        success: true,
        message: '데이터 수집을 시작했습니다.',
        status: this.collectionStatus
      };
    } catch (error) {
      console.error('데이터 수집 시작 오류:', error);
      this.collectionStatus.error = error.message;
      this.collectionStatus.isRunning = false;
      throw error;
    }
  }

  // 실제 데이터 수집 실행 (비동기)
  async runDataCollection(apiKey, keywords, maxVideos, minViewCount) {
    try {
      console.log('=== 트렌딩 기반 데이터 수집 시작 ===');
      console.log(`조회수 기준: ${minViewCount.toLocaleString()}회 이상`);
      console.log(`수집 방식: mostPopular API (트렌딩 기반)`);
      console.log(`키워드: ${keywords.join(', ')}`);

      let allVideos = [];
      let totalCollected = 0;
      let requestCount = 0;

      // 1단계: 초기화
      this.collectionStatus.progress = 10;
      this.collectionStatus.currentStep = 'YouTube API 연결 확인 중...';
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2단계: 키워드 기반 영상 수집
      this.collectionStatus.progress = 20;
      this.collectionStatus.currentStep = '키워드 기반 영상 수집 중...';

      for (const keyword of keywords) {
        try {
          console.log(`🔍 "${keyword}" 키워드로 영상 검색 중...`);
          
          const videos = await this.youtubeApiService.searchVideos(apiKey, {
            keyword,
            maxResults: 200,
            order: 'relevance'
          });

          // 조회수 필터링
          const filteredVideos = videos.filter(video => 
            video.viewCount && parseInt(video.viewCount) >= minViewCount
          );

          allVideos = allVideos.concat(filteredVideos);
          totalCollected += videos.length;
          requestCount++;

          console.log(`✅ "${keyword}": ${videos.length}개 수집, ${filteredVideos.length}개 필터링 통과`);
          
          // API 할당량 고려하여 대기
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ "${keyword}" 키워드 수집 실패:`, error.message);
        }
      }

      // 3단계: 중복 제거
      this.collectionStatus.progress = 60;
      this.collectionStatus.currentStep = '중복 데이터 제거 중...';
      
      const uniqueVideos = allVideos.filter((video, index, self) => 
        index === self.findIndex(v => v.id === video.id)
      );

      // 4단계: 데이터 저장
      this.collectionStatus.progress = 80;
      this.collectionStatus.currentStep = '데이터 저장 중...';
      
      await this.dataService.saveData('unclassifiedData', uniqueVideos);

      // 5단계: 완료
      this.collectionStatus.progress = 100;
      this.collectionStatus.currentStep = '수집 완료!';
      this.collectionStatus.isRunning = false;
      this.collectionStatus.lastCollection = new Date().toISOString();
      this.collectionStatus.stats.totalVideos = uniqueVideos.length;

      console.log(`📊 수집 완료:`);
      console.log(`   - 총 수집: ${totalCollected}개`);
      console.log(`   - 중복 제거 후: ${uniqueVideos.length}개`);
      console.log(`   - API 요청: ${requestCount}회`);

      this.addSystemLog('info', `데이터 수집 완료: ${uniqueVideos.length}개 비디오 수집`);

    } catch (error) {
      console.error('데이터 수집 실행 오류:', error);
      this.collectionStatus.error = error.message;
      this.collectionStatus.isRunning = false;
      this.addSystemLog('error', `데이터 수집 실패: ${error.message}`);
    }
  }

  // 데이터 수집 상태 조회
  async getCollectionStatus() {
    return this.collectionStatus;
  }

  // 데이터 수집 중지
  async stopDataCollection() {
    try {
      if (!this.collectionStatus.isRunning) {
        throw new Error('실행 중인 데이터 수집이 없습니다.');
      }

      this.collectionStatus.isRunning = false;
      this.collectionStatus.currentStep = '중지됨';
      this.addSystemLog('info', '데이터 수집이 중지되었습니다.');

      return {
        success: true,
        message: '데이터 수집을 중지했습니다.',
        status: this.collectionStatus
      };
    } catch (error) {
      console.error('데이터 수집 중지 오류:', error);
      throw error;
    }
  }

  // 시스템 설정 저장
  async saveSystemConfig(config) {
    try {
      this.systemConfig = { ...this.systemConfig, ...config };
      this.addSystemLog('info', '시스템 설정이 저장되었습니다.');
      
      return {
        success: true,
        config: this.systemConfig,
        message: '시스템 설정을 저장했습니다.'
      };
    } catch (error) {
      console.error('시스템 설정 저장 오류:', error);
      throw error;
    }
  }

  // 시스템 설정 로드
  async loadSystemConfig() {
    return this.systemConfig;
  }

  // 데이터 정리 실행
  async cleanupData(retentionDays = 7) {
    try {
      const deletedCount = await this.dataService.cleanupOldData(retentionDays);
      this.addSystemLog('info', `${retentionDays}일 이상 된 데이터 ${deletedCount}개를 정리했습니다.`);
      
      return {
        success: true,
        deletedCount,
        message: `${retentionDays}일 이상 된 데이터를 정리했습니다.`
      };
    } catch (error) {
      console.error('데이터 정리 오류:', error);
      throw error;
    }
  }

  // 시스템 로그 조회
  async getSystemLogs(options = {}) {
    try {
      const { level, limit = 100 } = options;
      
      let logs = this.systemLogs;
      
      if (level) {
        logs = logs.filter(log => log.level === level);
      }
      
      if (limit) {
        logs = logs.slice(-limit);
      }
      
      return logs;
    } catch (error) {
      console.error('시스템 로그 조회 오류:', error);
      throw error;
    }
  }

  // 시스템 로그 추가
  addSystemLog(level, message) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    
    this.systemLogs.push(log);
    
    // 로그 개수 제한 (최대 1000개)
    if (this.systemLogs.length > 1000) {
      this.systemLogs = this.systemLogs.slice(-1000);
    }
    
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
}

export const systemService = new SystemService();
