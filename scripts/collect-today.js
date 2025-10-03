#!/usr/bin/env node

/**
 * 오늘 날짜 데이터 수집 도구
 * 자동/수동 모드로 오늘 날짜의 YouTube 데이터를 수집
 */

import { Pool } from 'pg';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 명령행 인수 파싱
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'manual';
const today = args.find(arg => arg.startsWith('--today='))?.split('=')[1] || new Date().toISOString().split('T')[0];
const write = args.includes('--write');

console.log('🎯 오늘 날짜 데이터 수집 시작');
console.log(`📋 설정: mode=${mode}, today=${today}, write=${write}`);

// PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * YouTube API 키 로드
 */
function getYouTubeApiKey() {
  const apiKey = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YouTube API 키가 설정되지 않았습니다');
  }
  return apiKey;
}

/**
 * 트렌드 영상 수집
 */
async function collectTrendingVideos(apiKey, maxResults = 200) {
  console.log('📺 트렌드 영상 수집 중...');
  const videos = [];
  let nextPageToken = '';
  
  for (let page = 0; page < 4; page++) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`YouTube API 오류: ${data.error.message}`);
    }
    
    videos.push(...(data.items || []));
    nextPageToken = data.nextPageToken;
    
    if (!nextPageToken) break;
    
    // API 할당량 고려 지연
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`✅ 트렌드 영상 수집 완료: ${videos.length}개`);
  return videos;
}

/**
 * 키워드 기반 영상 수집
 */
async function collectKeywordVideos(apiKey, keywords, maxResults = 100) {
  console.log('🔍 키워드 기반 영상 수집 중...');
  const videos = [];
  
  for (const keyword of keywords) {
    if (videos.length >= maxResults) break;
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&regionCode=KR&order=viewCount&key=${apiKey}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.error) {
      console.warn(`키워드 "${keyword}" 검색 실패:`, data.error.message);
      continue;
    }
    
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
    
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();
    
    if (videosData.error) {
      console.warn(`키워드 "${keyword}" 비디오 정보 실패:`, videosData.error.message);
      continue;
    }
    
    videos.push(...(videosData.items || []));
    
    // API 할당량 고려 지연
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`✅ 키워드 영상 수집 완료: ${videos.length}개`);
  return videos;
}

/**
 * 데이터 변환 및 저장
 */
async function processAndSaveData(allVideos, today) {
  console.log('🔄 데이터 변환 및 저장 중...');
  
  // 중복 제거 (videoId 기준, 조회수 높은 것 우선)
  const videoMap = new Map();
  allVideos.forEach(video => {
    const videoId = video.id;
    if (videoId) {
      const existingVideo = videoMap.get(videoId);
      const currentViewCount = parseInt(video.statistics?.viewCount || '0');
      const existingViewCount = existingVideo ? parseInt(existingVideo.statistics?.viewCount || '0') : 0;
      
      if (!existingVideo || currentViewCount > existingViewCount) {
        videoMap.set(videoId, video);
      }
    }
  });
  
  const uniqueVideos = Array.from(videoMap.values());
  console.log(`🔄 중복 제거: ${allVideos.length}개 → ${uniqueVideos.length}개`);
  
  // 조회수 순 정렬
  uniqueVideos.sort((a, b) => {
    const viewsA = parseInt(a.statistics?.viewCount || '0');
    const viewsB = parseInt(b.statistics?.viewCount || '0');
    return viewsB - viewsA;
  });
  
  // 데이터 변환
  const processedData = uniqueVideos.map((video, index) => ({
    id: `${Date.now()}_${index}`,
    channelId: video.snippet.channelId,
    channelName: video.snippet.channelTitle,
    videoId: video.id,
    videoTitle: video.snippet.title,
    videoDescription: video.snippet.description || '',
    viewCount: parseInt(video.statistics?.viewCount || '0'),
    uploadDate: video.snippet.publishedAt.split('T')[0],
    collectionDate: today, // 오늘 날짜로 설정
    thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '',
    category: '',
    subCategory: '',
    status: 'unclassified'
  }));
  
  if (!write) {
    console.log('🔍 DRY RUN 모드 - 실제 저장은 수행하지 않음');
    console.log(`📊 처리된 데이터: ${processedData.length}개`);
    return;
  }
  
  // PostgreSQL에 저장
  const client = await pool.connect();
  try {
    console.log(`💾 PostgreSQL에 ${processedData.length}개 데이터 저장 중...`);
    
    for (const item of processedData) {
      await client.query(`
        INSERT INTO unclassified_data (
          video_id, channel_id, channel_name, video_title, 
          video_description, view_count, upload_date, collection_date,
          thumbnail_url, category, sub_category, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (video_id, collection_date) 
        DO UPDATE SET 
          view_count = GREATEST(unclassified_data.view_count, $6),
          video_title = $4,
          video_description = $5,
          thumbnail_url = $9
      `, [
        item.videoId, item.channelId, item.channelName, item.videoTitle,
        item.videoDescription, item.viewCount, item.uploadDate, item.collectionDate,
        item.thumbnailUrl, item.category, item.subCategory, item.status
      ]);
    }
    
    console.log('✅ 데이터 저장 완료');
  } finally {
    client.release();
  }
}

/**
 * 메인 수집 로직
 */
async function collectTodayData() {
  try {
    const apiKey = getYouTubeApiKey();
    console.log('🔑 YouTube API 키 확인됨');
    
    // 키워드 목록 (실제로는 설정 파일에서 로드)
    const keywords = [
      '뉴스', '정치', '경제', '사회', '문화', '스포츠', '연예', '기술',
      '게임', '음악', '영화', '드라마', '요리', '여행', '패션', '뷰티'
    ];
    
    console.log('📺 1단계: 트렌드 영상 수집');
    const trendingVideos = await collectTrendingVideos(apiKey);
    
    console.log('🔍 2단계: 키워드 기반 영상 수집');
    const keywordVideos = await collectKeywordVideos(apiKey, keywords);
    
    console.log('🔄 3단계: 데이터 처리 및 저장');
    const allVideos = [...trendingVideos, ...keywordVideos];
    await processAndSaveData(allVideos, today);
    
    console.log('\n✅ 오늘 날짜 데이터 수집 완료!');
    console.log(`📊 수집 통계:`);
    console.log(`   - 트렌드 영상: ${trendingVideos.length}개`);
    console.log(`   - 키워드 영상: ${keywordVideos.length}개`);
    console.log(`   - 총 영상: ${allVideos.length}개`);
    console.log(`   - 수집 날짜: ${today}`);
    
  } catch (error) {
    console.error('❌ 수집 실패:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 메인 실행
collectTodayData();
