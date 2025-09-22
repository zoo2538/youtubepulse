// YouTube API 서비스 (데스크탑 앱과 동일한 기능)
export class YoutubeApiService {
  constructor() {
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  // API 키 검증
  async validateApiKey(apiKey) {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?part=snippet&q=test&key=${apiKey}&maxResults=1`
      );
      return response.ok;
    } catch (error) {
      console.error('API 키 검증 오류:', error);
      return false;
    }
  }

  // 트렌딩 비디오 조회
  async getTrendingVideos(apiKey, options = {}) {
    const { maxResults = 50, regionCode = 'KR' } = options;
    
    try {
      const response = await fetch(
        `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${regionCode}&maxResults=${maxResults}&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      return this.formatVideoData(data.items);
    } catch (error) {
      console.error('트렌딩 비디오 조회 오류:', error);
      throw error;
    }
  }

  // 키워드 기반 비디오 검색
  async searchVideos(apiKey, options = {}) {
    const { keyword, maxResults = 50, order = 'relevance' } = options;
    
    try {
      const response = await fetch(
        `${this.baseUrl}/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&order=${order}&maxResults=${maxResults}&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 비디오 ID 목록 추출
      const videoIds = data.items.map(item => item.id.videoId).join(',');
      
      // 비디오 상세 정보 조회
      const detailsResponse = await fetch(
        `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
      );
      
      if (!detailsResponse.ok) {
        throw new Error(`YouTube API 오류: ${detailsResponse.status}`);
      }
      
      const detailsData = await detailsResponse.json();
      return this.formatVideoData(detailsData.items);
    } catch (error) {
      console.error('비디오 검색 오류:', error);
      throw error;
    }
  }

  // 채널 정보 조회
  async getChannelInfo(apiKey, channelId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.items.length === 0) {
        throw new Error('채널을 찾을 수 없습니다.');
      }
      
      const channel = data.items[0];
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
        subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
        videoCount: parseInt(channel.statistics.videoCount) || 0,
        viewCount: parseInt(channel.statistics.viewCount) || 0,
        publishedAt: channel.snippet.publishedAt
      };
    } catch (error) {
      console.error('채널 정보 조회 오류:', error);
      throw error;
    }
  }

  // 비디오 상세 정보 조회
  async getVideoDetails(apiKey, videoId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API 오류: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.items.length === 0) {
        throw new Error('비디오를 찾을 수 없습니다.');
      }
      
      return this.formatVideoData(data.items)[0];
    } catch (error) {
      console.error('비디오 상세 정보 조회 오류:', error);
      throw error;
    }
  }

  // 비디오 데이터 포맷팅 (데스크탑 앱과 동일한 형식)
  formatVideoData(items) {
    return items.map(item => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      viewCount: parseInt(item.statistics.viewCount) || 0,
      likeCount: parseInt(item.statistics.likeCount) || 0,
      commentCount: parseInt(item.statistics.commentCount) || 0,
      duration: item.contentDetails?.duration || 'PT0S',
      // 추가 필드들
      category: null, // 나중에 분류 시스템에서 설정
      subCategory: null,
      collectedAt: new Date().toISOString()
    }));
  }

  // 채널별 최신 비디오 조회
  async getChannelVideos(apiKey, channelId, maxResults = 10) {
    try {
      // 채널의 업로드 플레이리스트 ID 조회
      const channelResponse = await fetch(
        `${this.baseUrl}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
      );
      
      if (!channelResponse.ok) {
        throw new Error(`YouTube API 오류: ${channelResponse.status}`);
      }
      
      const channelData = await channelResponse.json();
      const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;
      
      if (!uploadsPlaylistId) {
        throw new Error('업로드 플레이리스트를 찾을 수 없습니다.');
      }
      
      // 플레이리스트에서 비디오 목록 조회
      const playlistResponse = await fetch(
        `${this.baseUrl}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`
      );
      
      if (!playlistResponse.ok) {
        throw new Error(`YouTube API 오류: ${playlistResponse.status}`);
      }
      
      const playlistData = await playlistResponse.json();
      const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',');
      
      // 비디오 상세 정보 조회
      const detailsResponse = await fetch(
        `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
      );
      
      if (!detailsResponse.ok) {
        throw new Error(`YouTube API 오류: ${detailsResponse.status}`);
      }
      
      const detailsData = await detailsResponse.json();
      return this.formatVideoData(detailsData.items);
    } catch (error) {
      console.error('채널 비디오 조회 오류:', error);
      throw error;
    }
  }
}

export const youtubeApiService = new YoutubeApiService();
