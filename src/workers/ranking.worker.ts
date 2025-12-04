/**
 * 채널 랭킹 계산 Web Worker (TypeScript)
 * 메인 스레드를 블로킹하지 않고 배경에서 랭킹 계산을 수행합니다.
 */

// 타입 정의
interface VideoData {
  channelId?: string;
  channelName?: string;
  videoId?: string;
  id?: string;
  videoTitle?: string;
  title?: string;
  viewCount?: number;
  collectionDate?: string;
  uploadDate?: string;
  dayKeyLocal?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  description?: string;
  channelDescription?: string;
  subscriberCount?: number;
  totalSubscribers?: number;
  channelVideoCount?: number;
  channelCreationDate?: string;
  publishedAt?: string;
  videoDescription?: string;
}

interface ChannelGroup {
  channelId: string;
  channelName: string;
  thumbnail: string;
  todayViews: number;
  description?: string;
  totalSubscribers?: number;
  channelCreationDate?: string;
  videoCount: number;
  topVideo?: {
    videoId: string;
    title: string;
    viewCount: number;
    description?: string;
    thumbnailUrl?: string;
  };
}

interface ChannelRanking {
  rank: number;
  channelId: string;
  channelName: string;
  thumbnail: string;
  todayViews: number;
  yesterdayViews: number;
  rankChange: number;
  changePercent: number;
  description?: string;
  totalSubscribers?: number;
  channelCreationDate?: string;
  videoCount: number;
  topVideo?: {
    videoId: string;
    title: string;
    viewCount: number;
    description?: string;
    thumbnailUrl?: string;
  };
}

interface WorkerMessage {
  classifiedData: VideoData[];
  unclassifiedData: VideoData[];
  targetDate: string;
  yesterdayStr: string;
  showNewOnly: boolean;
  reverseOrder: boolean;
  country: string;
  excludeOfficial: boolean;
  showOnlyOfficial: boolean;
}

interface WorkerResponse {
  success: boolean;
  rankings?: ChannelRanking[];
  processingTime?: number;
  channelCount?: number;
  error?: string;
  stack?: string;
}

// 한국어 텍스트 감지 함수
const isKoreanText = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  const koreanRegex = /[가-힣]/;
  return koreanRegex.test(text);
};

// 한국 채널 필터링 함수
const isKoreanChannel = (item: VideoData): boolean => {
  const channelNameKorean = isKoreanText(item.channelName || '');
  const videoTitleKorean = isKoreanText(item.videoTitle || item.title || '');
  return channelNameKorean || videoTitleKorean;
};

// 공식 오피셜 채널 감지 함수
const isOfficialChannel = (channelName: string): boolean => {
  if (!channelName || typeof channelName !== 'string') return false;
  
  const exceptionPatterns = [
    /미유.*MIUU.*AI/i,
    /MIUU.*AI/i
  ];
  
  if (exceptionPatterns.some(pattern => pattern.test(channelName))) {
    return false;
  }
  
  const officialPatterns = [
    /MBC/i, /KBS/i, /kbs/i, /SBS/i, /JTBC/i, /tvN/i, /MBN/i, /채널A/i, /YTN/i, /Mnet/i, /tvchosun/i, /TV조선/i,
    /MBC공식/i, /KBS공식/i, /SBS공식/i, /JTBC공식/i,
    /스브스/i, /SUBUSU/i,
    /엠뚜루마뚜루/i,
    /넷플릭스/i, /Netflix/i, /지니키즈/i, /Genie Kids/i, /Genikids/i,
    /조선일보/i, /중앙일보/i, /동아일보/i, /한겨레/i, /경향신문/i,
    /매일경제/i, /한국경제/i, /서울신문/i, /연합뉴스/i,
    /정부/i, /청와대/i, /국회/i, /행정안전부/i, /문화체육관광부/i,
    /롯데/i, /Lotte/i, /농심/i, /Nongshim/i, /삼성/i, /Samsung/i, /LG/i, /현대/i, /Hyundai/i,
    /SK/i, /한화/i, /Hanwha/i, /CJ/i, /GS/i, /두산/i, /Doosan/i, /포스코/i, /POSCO/i,
    /신세계/i, /Shinsegae/i, /이마트/i, /Emart/i, /하나/i, /Hana/i, /KB/i, /신한/i, /Shinhan/i,
    /기업/i, /회사/i, /Corporation/i, /Corp/i, /Company/i,
    /SMTOWN/i, /SM ENT/i, /SM엔터/i, /HYBE/i, /JYP/i, /YG/i, /플레디스/i, /Pledis/i,
    /큐브/i, /CUBE/i, /판타지오/i, /Fantagio/i, /스타쉽/i, /Starship/i,
    /BLACKPINK/i, /BTS/i, /BANGTAN/i, /BANGTANTV/i, /SEVENTEEN/i, /TWICE/i, /Red Velvet/i, /aespa/i,
    /NewJeans/i, /IVE/i, /LE SSERAFIM/i, /NCT/i, /EXO/i, /SUPER JUNIOR/i,
    /공식채널/i, /Official/i, /공식/i,
    /Topic/i, /topic/i, (/- Topic$/i),
    /엔터테인먼트/i, /Entertainment/i,
    /1theK/i, /원더케이/i, /M2/i, /멜론/i, /Melon/i,
    /미스.*미스터.*트롯/i, /미스&미스터트롯/i,
    /ootb STUDIO/i, /OOTB/i,
    /뉴스/i, /News/i, /방송/i, /Broadcast/i, /esports/i
  ];
  
  return officialPatterns.some(pattern => pattern.test(channelName));
};

// 워커 메시지 수신 처리
self.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const { 
    classifiedData, 
    unclassifiedData, 
    targetDate, 
    yesterdayStr,
    showNewOnly,
    reverseOrder,
    country,
    excludeOfficial,
    showOnlyOfficial
  } = e.data;

  try {
    const startTime = performance.now();
    
    // 한 번의 순회로 오늘/어제 데이터 분리 및 필터링 (성능 최적화)
    const todayData: VideoData[] = [];
    const yesterdayData: VideoData[] = [];
    const allData: VideoData[] = [...classifiedData, ...unclassifiedData];
    
    for (const item of allData) {
      // 날짜 추출 (한 번만 수행)
      const itemDate = item.collectionDate || item.uploadDate || item.dayKeyLocal;
      if (!itemDate) continue;
      
      const dateStr = itemDate.split('T')[0];
      const isToday = dateStr === targetDate;
      const isYesterday = dateStr === yesterdayStr;
      
      if (!isToday && !isYesterday) continue;
      
      // 대한민국 채널 필터링 (필요한 경우만)
      if (country === '대한민국' && !isKoreanChannel(item)) continue;
      
      // 날짜별로 분류
      if (isToday) todayData.push(item);
      if (isYesterday) yesterdayData.push(item);
    }
    
    // 채널별 그룹화 (성능 최적화: 비디오 배열 대신 Set 사용)
    const todayChannelGroups: Record<string, ChannelGroup> = {};
    const videoIdSets: Record<string, Set<string>> = {}; // 고유 비디오 ID 추적
    
    for (const item of todayData) {
      if (!item.channelId || !item.channelName) continue;
      
      // 공식 채널 필터링
      const isOfficial = isOfficialChannel(item.channelName);
      
      // 공식 채널만 표시 모드
      if (showOnlyOfficial && !isOfficial) continue;
      
      // 공식 채널 제외 모드
      if (excludeOfficial && !showOnlyOfficial && isOfficial) continue;
      
      if (!todayChannelGroups[item.channelId]) {
        todayChannelGroups[item.channelId] = {
          channelId: item.channelId,
          channelName: item.channelName,
          thumbnail: item.thumbnailUrl || `https://via.placeholder.com/96x96?text=${item.channelName.charAt(0)}`,
          todayViews: 0,
          description: item.description || item.channelDescription,
          totalSubscribers: item.subscriberCount || item.totalSubscribers,
          channelCreationDate: item.channelCreationDate || 
            (item.publishedAt ? item.publishedAt.split('T')[0] : undefined),
          videoCount: item.channelVideoCount || 0 // 채널의 실제 영상 개수 사용
        };
        videoIdSets[item.channelId] = new Set();
      }
      
      todayChannelGroups[item.channelId].todayViews += item.viewCount || 0;
      // 고유 비디오 ID 추적
      const videoId = item.videoId || item.id;
      if (videoId) {
        videoIdSets[item.channelId].add(videoId);
      }
    }
    
    // 채널의 실제 영상 개수가 없으면 고유 비디오 개수 사용
    Object.keys(todayChannelGroups).forEach(channelId => {
      // 채널의 실제 영상 개수가 이미 설정되어 있으면 유지, 없으면 고유 비디오 개수 사용
      if (!todayChannelGroups[channelId].videoCount || todayChannelGroups[channelId].videoCount === 0) {
        todayChannelGroups[channelId].videoCount = videoIdSets[channelId]?.size || 0;
      }
      
      // 해당 채널의 최고 조회수 비디오 찾기
      const channelVideos = todayData.filter((item) => 
        item.channelId === channelId && (item.videoId || item.id)
      );
      if (channelVideos.length > 0) {
        const topVideo = channelVideos.reduce((max, video) => 
          (video.viewCount || 0) > (max.viewCount || 0) ? video : max
        );
        todayChannelGroups[channelId].topVideo = {
          videoId: topVideo.videoId || topVideo.id || '',
          title: topVideo.videoTitle || topVideo.title || '제목 없음',
          viewCount: topVideo.viewCount || 0,
          description: topVideo.videoDescription || topVideo.description || '',
          thumbnailUrl: topVideo.thumbnailUrl || topVideo.thumbnail
        };
      }
    });
    
    // 어제 채널별 그룹화
    const yesterdayChannelGroups: Record<string, { totalViews: number }> = {};
    yesterdayData.forEach((item) => {
      if (!item.channelId) return;
      if (!yesterdayChannelGroups[item.channelId]) {
        yesterdayChannelGroups[item.channelId] = { totalViews: 0 };
      }
      yesterdayChannelGroups[item.channelId].totalViews += item.viewCount || 0;
    });
    
    // 어제 랭킹 계산
    const yesterdayRankings: Record<string, number> = {};
    Object.entries(yesterdayChannelGroups)
      .sort(([, a], [, b]) => b.totalViews - a.totalViews)
      .forEach(([channelId], index) => {
        yesterdayRankings[channelId] = index + 1;
      });
    
    // 랭킹 데이터 생성
    const rankings: ChannelRanking[] = Object.values(todayChannelGroups)
      .map((channel) => {
        const yesterdayViews = yesterdayChannelGroups[channel.channelId]?.totalViews || 0;
        const yesterdayRank = yesterdayRankings[channel.channelId] || 999999;
        const todayRank = 0; // 나중에 계산
        
        const changeAmount = channel.todayViews - yesterdayViews;
        const changePercent = yesterdayViews > 0 ? (changeAmount / yesterdayViews) * 100 : 0;
        
        return {
          rank: 0,
          channelId: channel.channelId,
          channelName: channel.channelName,
          thumbnail: channel.thumbnail,
          todayViews: channel.todayViews,
          yesterdayViews,
          rankChange: yesterdayRank - todayRank, // 양수면 상승
          changePercent,
          description: channel.description,
          totalSubscribers: channel.totalSubscribers,
          channelCreationDate: channel.channelCreationDate,
          videoCount: channel.videoCount || 0,
          topVideo: channel.topVideo
        };
      })
      .filter((channel) => {
        if (showNewOnly) {
          // 신규진입: 어제 랭킹이 없었던 채널
          return !yesterdayRankings[channel.channelId];
        }
        return true;
      })
      .sort((a, b) => {
        if (reverseOrder) {
          return a.todayViews - b.todayViews;
        }
        return b.todayViews - a.todayViews;
      })
      .map((channel, index) => {
        const yesterdayRank = yesterdayRankings[channel.channelId] || 999999;
        return {
          ...channel,
          rank: index + 1,
          rankChange: yesterdayRank === 999999 ? 0 : yesterdayRank - (index + 1)
        };
      });
    
    const totalTime = performance.now() - startTime;
    
    // 결과 전송
    const response: WorkerResponse = {
      success: true,
      rankings,
      processingTime: totalTime,
      channelCount: rankings.length
    };
    
    self.postMessage(response);
    
  } catch (error) {
    // 오류 발생 시 메인 스레드에 전송
    const errorResponse: WorkerResponse = {
      success: false,
      error: error instanceof Error ? error.message : '랭킹 계산 중 오류가 발생했습니다.',
      stack: error instanceof Error ? error.stack : undefined
    };
    
    self.postMessage(errorResponse);
  }
};

