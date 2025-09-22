// 데이터 서비스 (IndexedDB와 동일한 기능을 서버에서 구현)
export class DataService {
  constructor() {
    // 메모리 기반 임시 저장소 (실제로는 PostgreSQL이나 MongoDB 사용)
    this.dataStore = {
      videos: new Map(),
      channels: new Map(),
      categories: new Map(),
      dailyStats: new Map(),
      classifiedData: new Map(),
      unclassifiedData: new Map()
    };
  }

  // 데이터 저장
  async saveData(type, data) {
    try {
      const timestamp = new Date().toISOString();
      
      switch (type) {
        case 'videos':
          return await this.saveVideos(data, timestamp);
        case 'channels':
          return await this.saveChannels(data, timestamp);
        case 'categories':
          return await this.saveCategories(data, timestamp);
        case 'dailyStats':
          return await this.saveDailyStats(data, timestamp);
        case 'classifiedData':
          return await this.saveClassifiedData(data, timestamp);
        case 'unclassifiedData':
          return await this.saveUnclassifiedData(data, timestamp);
        default:
          throw new Error(`지원하지 않는 데이터 타입: ${type}`);
      }
    } catch (error) {
      console.error(`데이터 저장 오류 (${type}):`, error);
      throw error;
    }
  }

  // 비디오 데이터 저장
  async saveVideos(videos, timestamp) {
    const savedVideos = [];
    
    for (const video of videos) {
      const videoData = {
        ...video,
        id: video.id || `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: timestamp
      };
      
      this.dataStore.videos.set(videoData.id, videoData);
      savedVideos.push(videoData);
    }
    
    console.log(`✅ ${savedVideos.length}개 비디오 저장 완료`);
    return savedVideos;
  }

  // 채널 데이터 저장
  async saveChannels(channels, timestamp) {
    const savedChannels = [];
    
    for (const channel of channels) {
      const channelData = {
        ...channel,
        id: channel.id || channel.channelId || `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: timestamp
      };
      
      this.dataStore.channels.set(channelData.id, channelData);
      savedChannels.push(channelData);
    }
    
    console.log(`✅ ${savedChannels.length}개 채널 저장 완료`);
    return savedChannels;
  }

  // 카테고리 데이터 저장
  async saveCategories(categories, timestamp) {
    const categoryData = {
      data: categories,
      savedAt: timestamp
    };
    
    this.dataStore.categories.set('categories', categoryData);
    console.log('✅ 카테고리 저장 완료');
    return categoryData;
  }

  // 일별 통계 저장
  async saveDailyStats(stats, timestamp) {
    const savedStats = [];
    
    for (const stat of stats) {
      const statData = {
        ...stat,
        id: stat.id || `stat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: timestamp
      };
      
      this.dataStore.dailyStats.set(statData.id, statData);
      savedStats.push(statData);
    }
    
    console.log(`✅ ${savedStats.length}개 일별 통계 저장 완료`);
    return savedStats;
  }

  // 분류된 데이터 저장
  async saveClassifiedData(data, timestamp) {
    const savedData = [];
    
    for (const item of data) {
      const itemData = {
        ...item,
        id: item.id || `classified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: timestamp
      };
      
      this.dataStore.classifiedData.set(itemData.id, itemData);
      savedData.push(itemData);
    }
    
    console.log(`✅ ${savedData.length}개 분류된 데이터 저장 완료`);
    return savedData;
  }

  // 미분류 데이터 저장
  async saveUnclassifiedData(data, timestamp) {
    const savedData = [];
    
    for (const item of data) {
      const itemData = {
        ...item,
        id: item.id || `unclassified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: timestamp
      };
      
      this.dataStore.unclassifiedData.set(itemData.id, itemData);
      savedData.push(itemData);
    }
    
    console.log(`✅ ${savedData.length}개 미분류 데이터 저장 완료`);
    return savedData;
  }

  // 데이터 로드
  async loadData(type, options = {}) {
    try {
      const { date, limit } = options;
      let data = [];
      
      switch (type) {
        case 'videos':
          data = Array.from(this.dataStore.videos.values());
          break;
        case 'channels':
          data = Array.from(this.dataStore.channels.values());
          break;
        case 'categories':
          const categoryData = this.dataStore.categories.get('categories');
          return categoryData ? categoryData.data : null;
        case 'dailyStats':
          data = Array.from(this.dataStore.dailyStats.values());
          break;
        case 'classifiedData':
          data = Array.from(this.dataStore.classifiedData.values());
          break;
        case 'unclassifiedData':
          data = Array.from(this.dataStore.unclassifiedData.values());
          break;
        default:
          throw new Error(`지원하지 않는 데이터 타입: ${type}`);
      }
      
      // 날짜 필터링
      if (date && type !== 'categories') {
        data = data.filter(item => {
          const itemDate = item.collectedAt || item.savedAt;
          return itemDate && itemDate.startsWith(date);
        });
      }
      
      // 개수 제한
      if (limit) {
        data = data.slice(0, parseInt(limit));
      }
      
      return data;
    } catch (error) {
      console.error(`데이터 로드 오류 (${type}):`, error);
      throw error;
    }
  }

  // 분류된 데이터 로드
  async loadClassifiedData(options = {}) {
    const { date, category, subCategory } = options;
    let data = Array.from(this.dataStore.classifiedData.values());
    
    // 날짜 필터링
    if (date) {
      data = data.filter(item => {
        const itemDate = item.collectedAt || item.savedAt;
        return itemDate && itemDate.startsWith(date);
      });
    }
    
    // 카테고리 필터링
    if (category) {
      data = data.filter(item => item.category === category);
    }
    
    // 세부카테고리 필터링
    if (subCategory) {
      data = data.filter(item => item.subCategory === subCategory);
    }
    
    return data;
  }

  // 미분류 데이터 로드
  async loadUnclassifiedData(options = {}) {
    const { date, limit } = options;
    let data = Array.from(this.dataStore.unclassifiedData.values());
    
    // 날짜 필터링
    if (date) {
      data = data.filter(item => {
        const itemDate = item.collectedAt || item.savedAt;
        return itemDate && itemDate.startsWith(date);
      });
    }
    
    // 개수 제한
    if (limit) {
      data = data.slice(0, parseInt(limit));
    }
    
    return data;
  }

  // 데이터 분류 업데이트
  async updateClassification(videoId, category, subCategory) {
    try {
      // 미분류 데이터에서 찾기
      let item = null;
      for (const [key, value] of this.dataStore.unclassifiedData.entries()) {
        if (value.id === videoId || value.videoId === videoId) {
          item = value;
          this.dataStore.unclassifiedData.delete(key);
          break;
        }
      }
      
      if (!item) {
        // 비디오 데이터에서 찾기
        for (const [key, value] of this.dataStore.videos.entries()) {
          if (value.id === videoId || value.videoId === videoId) {
            item = value;
            break;
          }
        }
      }
      
      if (!item) {
        throw new Error('비디오를 찾을 수 없습니다.');
      }
      
      // 분류 정보 업데이트
      const classifiedItem = {
        ...item,
        category,
        subCategory,
        classifiedAt: new Date().toISOString()
      };
      
      // 분류된 데이터로 이동
      this.dataStore.classifiedData.set(classifiedItem.id, classifiedItem);
      
      console.log(`✅ 비디오 분류 완료: ${videoId} → ${category}/${subCategory}`);
      return classifiedItem;
    } catch (error) {
      console.error('데이터 분류 업데이트 오류:', error);
      throw error;
    }
  }

  // 일별 데이터 로드
  async loadDailyData(date) {
    const data = Array.from(this.dataStore.videos.values()).filter(item => {
      const itemDate = item.collectedAt || item.savedAt;
      return itemDate && itemDate.startsWith(date);
    });
    
    return data;
  }

  // 사용 가능한 날짜 목록 조회
  async getAvailableDates() {
    const dates = new Set();
    
    // 모든 데이터에서 날짜 추출
    for (const item of this.dataStore.videos.values()) {
      const date = item.collectedAt || item.savedAt;
      if (date) {
        dates.add(date.split('T')[0]);
      }
    }
    
    for (const item of this.dataStore.classifiedData.values()) {
      const date = item.collectedAt || item.savedAt;
      if (date) {
        dates.add(date.split('T')[0]);
      }
    }
    
    for (const item of this.dataStore.unclassifiedData.values()) {
      const date = item.collectedAt || item.savedAt;
      if (date) {
        dates.add(date.split('T')[0]);
      }
    }
    
    return Array.from(dates).sort().reverse();
  }

  // 오래된 데이터 정리
  async cleanupOldData(retentionDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTime = cutoffDate.getTime();
    
    let deletedCount = 0;
    
    // 각 데이터 저장소에서 오래된 데이터 삭제
    for (const [key, value] of this.dataStore.videos.entries()) {
      const itemDate = new Date(value.collectedAt || value.savedAt);
      if (itemDate.getTime() < cutoffTime) {
        this.dataStore.videos.delete(key);
        deletedCount++;
      }
    }
    
    for (const [key, value] of this.dataStore.dailyStats.entries()) {
      const itemDate = new Date(value.savedAt);
      if (itemDate.getTime() < cutoffTime) {
        this.dataStore.dailyStats.delete(key);
        deletedCount++;
      }
    }
    
    console.log(`✅ ${retentionDays}일 이상 된 데이터 ${deletedCount}개 정리 완료`);
    return deletedCount;
  }

  // 데이터베이스 정보 조회
  async getDatabaseInfo() {
    return {
      name: 'YouTubePulseDB',
      version: '1.0.0',
      objectStores: Object.keys(this.dataStore),
      size: {
        videos: this.dataStore.videos.size,
        channels: this.dataStore.channels.size,
        categories: this.dataStore.categories.size,
        dailyStats: this.dataStore.dailyStats.size,
        classifiedData: this.dataStore.classifiedData.size,
        unclassifiedData: this.dataStore.unclassifiedData.size
      },
      retentionDays: 7,
      lastCleanup: new Date().toISOString()
    };
  }
}

export const dataService = new DataService();
