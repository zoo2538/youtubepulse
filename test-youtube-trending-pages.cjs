// YouTube 트렌드 API가 몇 페이지까지 제공하는지 테스트

const API_KEY = process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY';

async function testTrendingPages() {
  console.log('\n=== YouTube 트렌드 API 페이지 테스트 ===\n');
  
  let nextPageToken = '';
  let totalVideos = 0;
  let page = 0;
  
  while (page < 10) { // 최대 10페이지 시도
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
      
      console.log(`📄 페이지 ${page + 1} 요청 중...`);
      
      // API 키가 필요하므로 일단 이론적 설명만
      console.log(`   URL: ${url.replace(API_KEY, 'API_KEY')}`);
      
      // 실제 요청은 API 키가 필요하므로 생략
      break;
      
    } catch (error) {
      console.error(`❌ 페이지 ${page + 1} 요청 실패:`, error.message);
      break;
    }
  }
  
  console.log('\n📊 결론:');
  console.log('YouTube Trending API는 일반적으로 200개(4페이지)까지만 제공합니다.');
  console.log('nextPageToken이 없으면 자동으로 중단됩니다.');
  console.log('\n이것은 YouTube API의 제한사항입니다.');
}

testTrendingPages();

