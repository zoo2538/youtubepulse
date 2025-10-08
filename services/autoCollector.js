/**
 * 자동수집 서비스
 * 배치 처리 및 재시도 로직 포함
 */

const { withRetry, processBatches, saveToDeadLetterQueue } = require('../lib/withRetry');

class AutoCollector {
  constructor(pool) {
    this.pool = pool;
    this.requestId = null;
  }
  
  /**
   * 자동수집 데이터 저장 (배치 처리)
   * @param {Array} data - 저장할 데이터
   * @param {string} requestId - 요청 ID
   * @returns {Promise<Object>} 저장 결과
   */
  async saveCollectedData(data, requestId = null) {
    this.requestId = requestId || `auto-collect-${Date.now()}`;
    
    console.log(`🤖 자동수집 데이터 저장 시작: ${data.length}개 항목`);
    console.log(`🆔 요청 ID: ${this.requestId}`);
    
    if (!data || data.length === 0) {
      return { success: true, savedCount: 0 };
    }
    
    try {
      // 배치 단위로 처리
      const result = await processBatches(
        data,
        (batch, batchIndex) => this.saveBatch(batch, batchIndex),
        {
          batchSize: 200,
          maxRetries: 3
        }
      );
      
      // 실패한 배치가 있으면 데드레터 큐에 저장
      if (result.failedBatches.length > 0) {
        await saveToDeadLetterQueue(result.failedBatches, {
          requestId: this.requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ 자동수집 저장 완료: ${result.successCount}/${result.totalItems}개 성공`);
      
      return {
        success: result.success,
        savedCount: result.successCount,
        failedCount: result.failureCount,
        failedBatches: result.failedBatches.length
      };
      
    } catch (error) {
      console.error('❌ 자동수집 저장 실패:', error);
      throw error;
    }
  }
  
  /**
   * 배치 단위 데이터 저장
   * @param {Array} batch - 배치 데이터
   * @param {number} batchIndex - 배치 인덱스
   * @returns {Promise<void>}
   */
  async saveBatch(batch, batchIndex) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 배치 데이터를 JSON으로 변환
      const batchJson = JSON.stringify(batch);
      
      // PostgreSQL에 저장 (UPSERT 방식)
      await client.query(`
        INSERT INTO classification_data (data_type, data, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (data_type, created_at::date) 
        DO UPDATE SET 
          data = EXCLUDED.data,
          updated_at = NOW()
      `, ['auto_collected', batchJson]);
      
      await client.query('COMMIT');
      
      console.log(`✅ 배치 ${batchIndex + 1} 저장 완료: ${batch.length}개 항목`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ 배치 ${batchIndex + 1} 저장 실패:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * 트렌딩 비디오 수집
   * @param {string} apiKey - YouTube API 키
   * @param {number} maxPages - 최대 페이지 수
   * @returns {Promise<Array>} 수집된 비디오 데이터
   */
  async collectTrendingVideos(apiKey, maxPages = 4) {
    console.log('📺 트렌딩 비디오 수집 시작...');
    
    let allVideos = [];
    let nextPageToken = '';
    let requestCount = 0;
    
    for (let page = 0; page < maxPages; page++) {
      console.log(`📺 페이지 ${page + 1}/${maxPages} 수집 중...`);
      
      const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&key=${apiKey}`;
      
      try {
        const response = await fetch(trendingUrl);
        requestCount++;
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`YouTube API 요청 실패: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(`YouTube API 오류: ${data.error.message}`);
        }
        
        if (data.items && data.items.length > 0) {
          allVideos = [...allVideos, ...data.items];
          nextPageToken = data.nextPageToken;
          
          if (!nextPageToken) break;
        }
        
        // API 할당량 고려 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ 페이지 ${page + 1} 수집 실패:`, error);
        throw error;
      }
    }
    
    console.log(`✅ 트렌딩 비디오 수집 완료: ${allVideos.length}개, API 요청 ${requestCount}회`);
    return allVideos;
  }
  
  /**
   * 키워드 기반 비디오 수집
   * @param {string} apiKey - YouTube API 키
   * @param {Array} keywords - 검색 키워드 배열
   * @returns {Promise<Array>} 수집된 비디오 데이터
   */
  async collectKeywordVideos(apiKey, keywords) {
    console.log(`🔍 키워드 기반 비디오 수집 시작: ${keywords.length}개 키워드`);
    
    let allVideos = [];
    let requestCount = 0;
    
    for (const keyword of keywords) {
      console.log(`🔍 키워드 검색: "${keyword}"`);
      
      try {
        // 1단계: 검색 API 호출
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&regionCode=KR&order=viewCount&key=${apiKey}`;
        
        const searchResponse = await fetch(searchUrl);
        requestCount++;
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          throw new Error(`검색 API 요청 실패: ${searchResponse.status} - ${errorText}`);
        }
        
        const searchData = await searchResponse.json();
        
        if (searchData.error) {
          console.error(`❌ 키워드 "${keyword}" 검색 오류:`, searchData.error);
          continue;
        }
        
        if (searchData.items && searchData.items.length > 0) {
          // 2단계: 비디오 상세 정보 조회
          const videoIds = searchData.items.map(item => item.id.videoId).join(',');
          const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
          
          const videosResponse = await fetch(videosUrl);
          requestCount++;
          
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            
            if (videosData.items) {
              allVideos = [...allVideos, ...videosData.items];
            }
          }
        }
        
        // API 할당량 고려 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ 키워드 "${keyword}" 수집 실패:`, error);
        continue; // 다음 키워드로 계속
      }
    }
    
    console.log(`✅ 키워드 기반 비디오 수집 완료: ${allVideos.length}개, API 요청 ${requestCount}회`);
    return allVideos;
  }
  
  /**
   * 수집된 데이터를 정규화
   * @param {Array} videos - 원시 비디오 데이터
   * @param {string} source - 데이터 소스 ('trending' 또는 'keyword')
   * @returns {Array} 정규화된 데이터
   */
  normalizeData(videos, source = 'trending') {
    console.log(`🔄 데이터 정규화 시작: ${videos.length}개 항목`);
    
    // KST 기준 오늘 날짜
    const today = new Date().toLocaleDateString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).replace(/\./g, '-').replace(/\s/g, '');
    
    const normalizedData = videos.map((video, index) => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
      channelId: video.snippet.channelId,
      channelName: video.snippet.channelTitle,
      description: video.snippet.description || "설명 없음",
      videoId: video.id,
      videoTitle: video.snippet.title,
      videoDescription: video.snippet.description,
      viewCount: parseInt(video.statistics?.viewCount || '0'),
      uploadDate: video.snippet.publishedAt.split('T')[0],
      collectionDate: today,
      thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '',
      category: "",
      subCategory: "",
      status: "unclassified",
      source: source,
      collectionType: 'auto',
      collectionTimestamp: new Date().toISOString(),
      collectionSource: 'auto_collect_api',
      requestId: this.requestId
    }));
    
    console.log(`✅ 데이터 정규화 완료: ${normalizedData.length}개 항목`);
    return normalizedData;
  }
}

module.exports = AutoCollector;
