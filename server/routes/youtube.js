import express from 'express';
import { youtubeApiService } from '../services/youtube-api-service.js';

const router = express.Router();

// YouTube API 키 검증
router.post('/validate-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API 키가 필요합니다.'
      });
    }

    const isValid = await youtubeApiService.validateApiKey(apiKey);
    
    res.json({
      success: isValid,
      message: isValid ? 'API 키가 유효합니다.' : 'API 키가 유효하지 않습니다.'
    });
  } catch (error) {
    console.error('API 키 검증 오류:', error);
    res.status(500).json({
      success: false,
      message: 'API 키 검증 중 오류가 발생했습니다.'
    });
  }
});

// 트렌딩 비디오 수집
router.post('/collect-trending', async (req, res) => {
  try {
    const { apiKey, maxResults = 50, regionCode = 'KR' } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API 키가 필요합니다.'
      });
    }

    const trendingVideos = await youtubeApiService.getTrendingVideos(apiKey, {
      maxResults,
      regionCode
    });

    res.json({
      success: true,
      data: trendingVideos,
      count: trendingVideos.length,
      message: `${trendingVideos.length}개의 트렌딩 비디오를 수집했습니다.`
    });
  } catch (error) {
    console.error('트렌딩 비디오 수집 오류:', error);
    res.status(500).json({
      success: false,
      message: '트렌딩 비디오 수집 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 키워드 기반 비디오 검색
router.post('/search-videos', async (req, res) => {
  try {
    const { apiKey, keyword, maxResults = 50, order = 'relevance' } = req.body;
    
    if (!apiKey || !keyword) {
      return res.status(400).json({
        success: false,
        message: 'API 키와 키워드가 필요합니다.'
      });
    }

    const videos = await youtubeApiService.searchVideos(apiKey, {
      keyword,
      maxResults,
      order
    });

    res.json({
      success: true,
      data: videos,
      count: videos.length,
      message: `"${keyword}" 키워드로 ${videos.length}개의 비디오를 검색했습니다.`
    });
  } catch (error) {
    console.error('비디오 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '비디오 검색 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 채널 정보 조회
router.post('/channel-info', async (req, res) => {
  try {
    const { apiKey, channelId } = req.body;
    
    if (!apiKey || !channelId) {
      return res.status(400).json({
        success: false,
        message: 'API 키와 채널 ID가 필요합니다.'
      });
    }

    const channelInfo = await youtubeApiService.getChannelInfo(apiKey, channelId);

    res.json({
      success: true,
      data: channelInfo,
      message: '채널 정보를 조회했습니다.'
    });
  } catch (error) {
    console.error('채널 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '채널 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 비디오 상세 정보 조회
router.post('/video-details', async (req, res) => {
  try {
    const { apiKey, videoId } = req.body;
    
    if (!apiKey || !videoId) {
      return res.status(400).json({
        success: false,
        message: 'API 키와 비디오 ID가 필요합니다.'
      });
    }

    const videoDetails = await youtubeApiService.getVideoDetails(apiKey, videoId);

    res.json({
      success: true,
      data: videoDetails,
      message: '비디오 상세 정보를 조회했습니다.'
    });
  } catch (error) {
    console.error('비디오 상세 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '비디오 상세 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 대량 데이터 수집 (데스크탑 앱의 handleStartDataCollection과 동일)
router.post('/collect-bulk-data', async (req, res) => {
  try {
    const { 
      apiKey, 
      keywords = ['먹방', 'ASMR', '챌린지', '브이로그', '리뷰'],
      maxVideos = 10000,
      minViewCount = 10000
    } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API 키가 필요합니다.'
      });
    }

    console.log('=== 트렌딩 기반 데이터 수집 시작 ===');
    console.log(`조회수 기준: ${minViewCount.toLocaleString()}회 이상`);
    console.log(`수집 방식: mostPopular API (트렌딩 기반)`);
    console.log(`키워드: ${keywords.join(', ')}`);

    let allVideos = [];
    let totalCollected = 0;
    let requestCount = 0;

    // 키워드 기반 영상 수집
    for (const keyword of keywords) {
      try {
        console.log(`🔍 "${keyword}" 키워드로 영상 검색 중...`);
        
        const videos = await youtubeApiService.searchVideos(apiKey, {
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

    // 중복 제거
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.id === video.id)
    );

    console.log(`📊 수집 완료:`);
    console.log(`   - 총 수집: ${totalCollected}개`);
    console.log(`   - 중복 제거 후: ${uniqueVideos.length}개`);
    console.log(`   - API 요청: ${requestCount}회`);

    res.json({
      success: true,
      data: {
        videos: uniqueVideos,
        totalCollected,
        uniqueCount: uniqueVideos.length,
        requestCount,
        keywords
      },
      message: `${uniqueVideos.length}개의 고유 비디오를 수집했습니다.`
    });

  } catch (error) {
    console.error('대량 데이터 수집 오류:', error);
    res.status(500).json({
      success: false,
      message: '대량 데이터 수집 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
