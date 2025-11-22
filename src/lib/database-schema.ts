// 데이터베이스 스키마 정의
import { indexedDBService } from './indexeddb-service';

export interface Channel {
  channelId: string;
  channelName: string;
  description: string;
  category: string;
  subCategory: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyStats {
  id: string;
  channelId: string;
  date: string;
  totalViews: number;
  subscriberCount: number;
  videoCount: number;
  dailyViews: number; // 계산된 일일 조회수
  trendingRank?: number;
  createdAt: string;
}

export interface Video {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  createdAt: string;
  // 채널 상세 정보 (선택적)
  subscriberCount?: number;
  channelVideoCount?: number;
  channelCreationDate?: string;
  channelName?: string;
  channelDescription?: string;
  channelThumbnail?: string;
}

export interface TrendingData {
  id: string;
  date: string;
  videoId: string;
  channelId: string;
  rank: number;
  viewCount: number;
  createdAt: string;
}

// IndexedDB 기반 데이터베이스 초기화 함수
export const initializeDatabase = async () => {
  // IndexedDB 서비스 초기화
  await indexedDBService.init();
  
  // 기존 localStorage 데이터가 있으면 마이그레이션
  await migrateFromLocalStorage();
  
  // 7일 데이터 정리 실행
  await indexedDBService.cleanupOldData(7);
  
  // 자동 정리 스케줄러 시작 (매일 자정)
  startAutoCleanupScheduler();
  
  return indexedDBService;
};

// IndexedDB 자동 정리 스케줄러
const startAutoCleanupScheduler = () => {
  console.log('🧹 IndexedDB 자동 정리 스케줄러 시작 (매일 자정)');
  
  // 매일 자정에 7일 데이터 정리 실행
  setInterval(() => {
    const now = new Date();
    const kstHour = parseInt(now.toLocaleString('en-US', { 
      timeZone: 'Asia/Seoul', 
      hour: '2-digit', 
      hour12: false 
    }));
    const kstMinute = parseInt(now.toLocaleString('en-US', { 
      timeZone: 'Asia/Seoul', 
      minute: '2-digit' 
    }));
    
    // 자정(00:00~00:05)에 실행
    if (kstHour === 0 && kstMinute < 5) {
      console.log('🕛 KST 자정 감지 - IndexedDB 7일 데이터 자동 정리 실행');
      indexedDBService.cleanupOldData(7).then(deletedCount => {
        console.log(`✅ IndexedDB 자동 정리 완료: ${deletedCount}개 삭제`);
      }).catch(error => {
        console.error('❌ IndexedDB 자동 정리 실패:', error);
      });
    }
  }, 5 * 60 * 1000); // 5분마다 체크
};

// localStorage에서 IndexedDB로 데이터 마이그레이션
const migrateFromLocalStorage = async () => {
  try {
    // 채널 데이터 마이그레이션
    const savedChannels = localStorage.getItem('youtubepulse_channels');
    if (savedChannels) {
      const channels = JSON.parse(savedChannels);
      await indexedDBService.saveChannels(channels);
      console.log('✅ 채널 데이터 마이그레이션 완료');
    }

    // 비디오 데이터 마이그레이션
    const savedVideos = localStorage.getItem('youtubepulse_videos');
    if (savedVideos) {
      const videos = JSON.parse(savedVideos);
      await indexedDBService.saveVideos(videos);
      console.log('✅ 비디오 데이터 마이그레이션 완료');
    }

    // 일별 통계 데이터 마이그레이션
    const savedDailyStats = localStorage.getItem('youtubepulse_daily_stats');
    if (savedDailyStats) {
      const dailyStats = JSON.parse(savedDailyStats);
      // IndexedDB에 맞는 형태로 변환하여 저장
      for (const [key, stats] of Object.entries(dailyStats)) {
        await indexedDBService.saveSystemConfig(`dailyStats_${key}`, stats);
      }
      console.log('✅ 일별 통계 데이터 마이그레이션 완료');
    }

    // 트렌딩 데이터 마이그레이션
    const savedTrendingData = localStorage.getItem('youtubepulse_trending_data');
    if (savedTrendingData) {
      const trendingData = JSON.parse(savedTrendingData);
      for (const [key, data] of Object.entries(trendingData)) {
        await indexedDBService.saveSystemConfig(`trendingData_${key}`, data);
      }
      console.log('✅ 트렌딩 데이터 마이그레이션 완료');
    }

    // 마이그레이션 완료 후 localStorage 정리
    localStorage.removeItem('youtubepulse_channels');
    localStorage.removeItem('youtubepulse_daily_stats');
    localStorage.removeItem('youtubepulse_videos');
    localStorage.removeItem('youtubepulse_trending_data');
    
    console.log('🎉 IndexedDB 마이그레이션 완료!');
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
  }
};

// IndexedDB 데이터 저장 함수
export const saveToDatabase = async (data: {
  channels?: Record<string, Channel>;
  videos?: Record<string, Video>;
  dailyStats?: Record<string, DailyStats>;
  trendingData?: Record<string, TrendingData>;
}) => {
  try {
    if (data.channels) {
      await indexedDBService.saveChannels(data.channels);
    }
    
    if (data.videos) {
      await indexedDBService.saveVideos(data.videos);
    }
    
    if (data.dailyStats) {
      for (const [key, stats] of Object.entries(data.dailyStats)) {
        await indexedDBService.saveSystemConfig(`dailyStats_${key}`, stats);
      }
    }
    
    if (data.trendingData) {
      for (const [key, data] of Object.entries(data.trendingData)) {
        await indexedDBService.saveSystemConfig(`trendingData_${key}`, data);
      }
    }
    
    console.log('✅ IndexedDB 데이터 저장 완료');
  } catch (error) {
    console.error('❌ IndexedDB 데이터 저장 실패:', error);
    throw error;
  }
};

// IndexedDB 기반 일일 조회수 계산 함수
export const calculateDailyViews = async (channelId: string): Promise<number> => {
  const { getKoreanDateString, getKoreanDateStringWithOffset } = await import('./utils');
  const today = getKoreanDateString();
  const yesterday = getKoreanDateStringWithOffset(-1);

  try {
    const todayStats = await indexedDBService.loadSystemConfig(`dailyStats_${channelId}_${today}`);
    const yesterdayStats = await indexedDBService.loadSystemConfig(`dailyStats_${channelId}_${yesterday}`);

    if (todayStats && yesterdayStats) {
      return todayStats.totalViews - yesterdayStats.totalViews;
    }

    return 0;
  } catch (error) {
    console.error('일일 조회수 계산 중 오류:', error);
    return 0;
  }
};

// IndexedDB 데이터베이스 정보 조회
export const getDatabaseInfo = async () => {
  return await indexedDBService.getDatabaseInfo();
};

// 7일 데이터 정리 실행
export const cleanupOldData = async (retentionDays: number = 7) => {
  return await indexedDBService.cleanupOldData(retentionDays);
};


