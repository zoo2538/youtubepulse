
import { Channel, DailyStats, Video, TrendingData } from './database-schema';
import { loadCollectionConfig } from './data-collection-config';

// YouTube API 설정
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || 'demo_key_for_development';
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// API 호출 함수
const callYouTubeAPI = async (endpoint: string, params: Record<string, string>) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `${YOUTUBE_API_BASE_URL}/${endpoint}?${queryString}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('YouTube API 호출 실패:', error);
    throw error;
  }
};

// 요청 지연 유틸
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 키워드 기반 동영상 검색 (조회수 순 정렬)
export const searchVideosByKeyword = async (keyword: string, maxResults: number, regionCode?: string): Promise<any[]> => {
  const params: any = {
    part: 'snippet',
    q: keyword,
    type: 'video',
    order: 'viewCount', // 조회수 높은 순으로 정렬
    maxResults: Math.min(50, Math.max(1, maxResults)).toString(),
  };
  if (regionCode) params.regionCode = regionCode;
  
  console.log(`키워드 "${keyword}" 조회수 순 검색 중...`);
  const data = await callYouTubeAPI('search', params);
  
  // 조회수 순으로 정렬된 결과 반환
  const results = data.items || [];
  console.log(`키워드 "${keyword}": ${results.length}개 영상 검색 완료 (조회수 순)`);
  
  return results;
};

// 배열 청크 분할
const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// 어제(totalViews) 조회
const getYesterdayTotalViews = (db: any, channelId: string, todayISODate: string): number => {
  try {
    const yesterdayISO = new Date(new Date(todayISODate).getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    for (const stats of db.dailyStats.values()) {
      if (stats.channelId === channelId && stats.date === yesterdayISO) {
        return typeof stats.totalViews === 'number' ? stats.totalViews : parseInt(stats.totalViews) || 0;
      }
    }
  } catch {}
  return 0;
};

// 트렌딩 영상 상위 수집 (조회수 순 정렬 + 필터링 적용)
export const collectTrendingVideos = async (maxResults: number = 10000): Promise<any[]> => {
  const allVideos: any[] = [];
  let nextPageToken: string | undefined;
  let totalCollected = 0;
  
  // 조회수 필터링 설정 로드
  let minViewCount: number | undefined;
  try {
    const config = loadCollectionConfig();
    minViewCount = config.minViewCount;
    console.log(`조회수 필터링 적용: ${minViewCount?.toLocaleString()}회 이상`);
  } catch (error) {
    console.warn('조회수 필터링 설정 로드 실패, 필터링 없이 진행');
  }
  
  try {
    while (totalCollected < maxResults) {
      const currentBatchSize = Math.min(50, maxResults - totalCollected); // YouTube API는 한 번에 최대 50개
      
      const params: any = {
        part: 'snippet,statistics',
        chart: 'mostPopular',
        regionCode: 'KR',
        maxResults: currentBatchSize.toString(),
        order: 'viewCount' // 조회수 순 정렬 강화
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      const data = await callYouTubeAPI('videos', params);
      
      if (data.items && data.items.length > 0) {
        // 조회수 필터링 적용
        const filteredVideos = data.items.filter((video: any) => {
          if (typeof minViewCount !== 'number') return true;
          const viewCount = parseInt(video.statistics?.viewCount) || 0;
          return viewCount >= minViewCount;
        });
        
        allVideos.push(...filteredVideos);
        totalCollected += filteredVideos.length;
        
        const filteredCount = data.items.length - filteredVideos.length;
        if (filteredCount > 0) {
          console.log(`조회수 순 수집 진행: ${totalCollected}/${maxResults}개 (${filteredCount}개 필터링됨, ${minViewCount?.toLocaleString()}회 미만)`);
        } else {
          console.log(`조회수 순 수집 진행: ${totalCollected}/${maxResults}개 (모두 ${minViewCount?.toLocaleString()}회 이상)`);
        }
      }
      
      // 다음 페이지 토큰 확인
      nextPageToken = data.nextPageToken;
      
      if (!nextPageToken) {
        console.log('더 이상 수집할 데이터가 없습니다.');
        break;
      }
      
      // API 호출 제한을 고려한 지연
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ 조회수 순 수집 완료: ${allVideos.length}개 영상 (조회수 ${minViewCount?.toLocaleString()}회 이상)`);
    return allVideos;
    
  } catch (error) {
    console.error('트렌딩 비디오 수집 중 오류:', error);
    console.log(`오류 발생 전까지 수집된 데이터: ${allVideos.length}개`);
    
    // 부분적으로 수집된 데이터라도 반환
    if (allVideos.length > 0) {
      console.log('✅ 부분 수집 데이터 저장 완료');
    }
    
    return allVideos;
  }
};

// 채널 상세정보 수집
export const collectChannelDetails = async (channelIds: string[]): Promise<any[]> => {
  const params = {
    part: 'snippet,statistics',
    id: channelIds.join(',')
  };

  const data = await callYouTubeAPI('channels', params);
  return data.items || [];
};

// 채널별 최신 비디오 수집 (확장) - 조회수 필터링 적용
export const collectChannelVideos = async (channelId: string, maxResults: number = 50): Promise<any[]> => {
  const allVideos: any[] = [];
  let nextPageToken: string | undefined;
  let totalCollected = 0;
  
  // 조회수 필터링 설정 로드
  let minViewCount: number | undefined;
  try {
    const config = loadCollectionConfig();
    minViewCount = config.minViewCount;
  } catch (error) {
    console.warn('조회수 필터링 설정 로드 실패, 필터링 없이 진행');
  }
  
  try {
    while (totalCollected < maxResults) {
      const currentBatchSize = Math.min(50, maxResults - totalCollected);
      
      const params: any = {
        part: 'snippet',
        channelId: channelId,
        order: 'viewCount', // 조회수 기준으로 정렬
        maxResults: currentBatchSize.toString(),
        type: 'video'
      };
      
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      const data = await callYouTubeAPI('search', params);
      
      if (data.items && data.items.length > 0) {
        // 비디오 상세정보 수집하여 조회수 확인
        const videoIds = data.items.map((item: any) => item.id.videoId);
        const videoDetails = await collectVideoDetails(videoIds);
        
        // 조회수 필터링 적용
        const filteredVideos = videoDetails.filter((video: any) => {
          if (typeof minViewCount !== 'number') return true;
          const viewCount = parseInt(video.statistics?.viewCount) || 0;
          return viewCount >= minViewCount;
        });
        
        // 원본 search 결과와 매칭하여 반환
        const filteredSearchResults = data.items.filter((item: any) => {
          return filteredVideos.some((video: any) => video.id === item.id.videoId);
        });
        
        allVideos.push(...filteredSearchResults);
        totalCollected += filteredSearchResults.length;
      }
      
      nextPageToken = data.nextPageToken;
      
      if (!nextPageToken) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return allVideos;
    
  } catch (error) {
    console.error(`채널 ${channelId} 비디오 수집 중 오류:`, error);
    return allVideos;
  }
};

// 비디오 상세정보 수집
export const collectVideoDetails = async (videoIds: string[]): Promise<any[]> => {
  if (videoIds.length === 0) return [];
  
  const params = {
    part: 'snippet,statistics,contentDetails',
    id: videoIds.join(',')
  };

  const data = await callYouTubeAPI('videos', params);
  return data.items || [];
};

// 검색 기반 채널 수집
export const searchChannels = async (query: string, maxResults: number = 50): Promise<any[]> => {
  const params = {
    part: 'snippet',
    q: query,
    type: 'channel',
    order: 'viewCount',
    maxResults: maxResults.toString()
  };

  const data = await callYouTubeAPI('search', params);
  return data.items || [];
};

// 데이터 변환 함수들
export const transformTrendingVideo = (video: any): Partial<Video> => ({
  videoId: video.id,
  channelId: video.snippet.channelId,
  title: video.snippet.title,
  description: video.snippet.description,
  viewCount: parseInt(video.statistics.viewCount) || 0,
  likeCount: parseInt(video.statistics.likeCount) || 0,
  commentCount: parseInt(video.statistics.commentCount) || 0,
  publishedAt: video.snippet.publishedAt,
  thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
  duration: video.contentDetails?.duration || '',
  createdAt: new Date().toISOString()
});

export const transformChannel = (channel: any): Partial<Channel> => ({
  channelId: channel.id,
  channelName: channel.snippet.title,
  description: channel.snippet.description,
  category: '', // 수동 분류 필요
  subCategory: '', // 수동 분류 필요
  youtubeUrl: `https://www.youtube.com/channel/${channel.id}`,
  thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const transformDailyStats = (channel: any, date: string): Partial<DailyStats> => ({
  id: `${channel.id}_${date}`,
  channelId: channel.id,
  date: date,
  totalViews: parseInt(channel.statistics.viewCount) || 0,
  subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
  videoCount: parseInt(channel.statistics.videoCount) || 0,
  dailyViews: 0, // 나중에 계산
  createdAt: new Date().toISOString()
});

// 중복 제거 함수 (videoId 기준으로 고유성 보장)
const removeDuplicateVideos = (videos: any[]): any[] => {
  const seen = new Set<string>();
  const uniqueVideos: any[] = [];
  
  for (const video of videos) {
    const videoId = video.id || video.snippet?.resourceId?.videoId;
    if (videoId && !seen.has(videoId)) {
      seen.add(videoId);
      uniqueVideos.push(video);
    }
  }
  
  console.log(`🔄 중복 제거: ${videos.length}개 → ${uniqueVideos.length}개 (${videos.length - uniqueVideos.length}개 중복 제거됨)`);
  return uniqueVideos;
};

// 메인 수집 함수 (조회수 기준 10,000위)
export const collectDailyData = async (db: any, maxVideos: number = 10000) => {
  const { getKoreanDateString } = await import('./utils');
  const today = getKoreanDateString(); // 한국 시간 기준 오늘 날짜
  const newChannels: Record<string, Channel> = {};
  const newVideos: Record<string, Video> = {};
  const newDailyStats: Record<string, DailyStats> = {};
  const newTrendingData: Record<string, TrendingData> = {};

  try {
    // 1. 트렌딩 영상 상위 50,000위 수집
    console.log(`트렌딩 영상 상위 ${maxVideos}위 수집 중...`);
    const trendingVideos = await collectTrendingVideos(maxVideos);
    
    console.log(`수집된 트렌딩 비디오: ${trendingVideos.length}개`);
    
    // 중복 제거 적용 (videoId 기준으로 고유성 보장)
    const uniqueTrendingVideos = removeDuplicateVideos(trendingVideos);
    console.log(`중복 제거 후 트렌딩 비디오: ${uniqueTrendingVideos.length}개`);
    
    // 고유 채널 ID 추출
    const uniqueChannelIds = [...new Set(uniqueTrendingVideos.map(video => video.snippet.channelId))];
    console.log(`고유 채널 수: ${uniqueChannelIds.length}개`);
    
    // 2. 채널 상세정보 수집
    console.log('채널 상세정보 수집 중...');
    const channelDetails = await collectChannelDetails(uniqueChannelIds);
    
    // 3. 각 채널의 조회수 높은 비디오 수집
    console.log('채널별 조회수 높은 비디오 수집 중...');
    for (const channel of channelDetails) {
      const channelVideos = await collectChannelVideos(channel.id, 20); // 채널당 20개씩
      
      // 채널별 비디오 중복 제거 (videoId 기준으로 고유성 보장)
      const uniqueChannelVideos = removeDuplicateVideos(channelVideos);
      
      // 비디오 상세정보 수집
      const videoIds = uniqueChannelVideos.map(video => video.id.videoId);
      const videoDetails = await collectVideoDetails(videoIds);
      
      // 데이터 변환 및 저장
      const transformedChannel = transformChannel(channel);
      const transformedDailyStats = transformDailyStats(channel, today) as DailyStats;
      // 일별 증가치 계산: 오늘 totalViews - 어제 totalViews
      const yesterdayTotal = getYesterdayTotalViews(db, channel.id, today);
      const todayTotal = typeof transformedDailyStats.totalViews === 'number'
        ? transformedDailyStats.totalViews
        : parseInt((transformedDailyStats as any).totalViews) || 0;
      transformedDailyStats.dailyViews = Math.max(0, todayTotal - yesterdayTotal);
      
      // 기존 채널인지 확인
      if (!newChannels[channel.id]) {
        newChannels[channel.id] = transformedChannel as Channel;
      }
      
      newDailyStats[transformedDailyStats.id] = transformedDailyStats as DailyStats;
      
      // 비디오 데이터 저장 (최소 조회수 필터 적용)
      try {
        const cfgLocal = loadCollectionConfig();
        const filteredDetails = (videoDetails || []).filter(v => {
          const vc = parseInt(v?.statistics?.viewCount) || 0;
          return typeof cfgLocal.minViewCount === 'number' ? vc >= cfgLocal.minViewCount : true;
        });
        filteredDetails.forEach(video => {
          const transformedVideo = transformTrendingVideo(video);
          newVideos[video.id] = transformedVideo as Video;
        });
      } catch {
        // 설정 로드 실패 시 필터 없이 저장
        videoDetails.forEach(video => {
          const transformedVideo = transformTrendingVideo(video);
          newVideos[video.id] = transformedVideo as Video;
        });
      }
    }
    
    // 4. 키워드 기반 수집 제거됨 (트렌드 기반 수집만 사용)

    console.log(`수집 완료: ${Object.keys(newChannels).length}개 채널, ${Object.keys(newVideos).length}개 비디오 (트렌딩 기반)`);
    
    return {
      channels: newChannels,
      videos: newVideos,
      dailyStats: newDailyStats,
      trendingData: newTrendingData,
      newChannels: Object.keys(newChannels).length,
      newVideos: Object.keys(newVideos).length,
      newDailyStats: Object.keys(newDailyStats).length
    };
    
  } catch (error) {
    console.error('데이터 수집 실패:', error);
    
    // 부분적으로 수집된 데이터라도 저장
    if (Object.keys(newChannels).length > 0 || Object.keys(newVideos).length > 0 || Object.keys(newDailyStats).length > 0) {
      console.log(`⚠️ 오류 발생 전까지 수집된 데이터:`);
      console.log(`- 채널: ${Object.keys(newChannels).length}개`);
      console.log(`- 비디오: ${Object.keys(newVideos).length}개`);
      console.log(`- 일일 통계: ${Object.keys(newDailyStats).length}개`);
      
      console.log('✅ 부분 수집 데이터 저장 완료');
      
      return {
        channels: newChannels,
        videos: newVideos,
        dailyStats: newDailyStats,
        trendingData: newTrendingData,
        newChannels: Object.keys(newChannels).length,
        newVideos: Object.keys(newVideos).length,
        newDailyStats: Object.keys(newDailyStats).length
      };
    }
    
    throw error;
  }
};
