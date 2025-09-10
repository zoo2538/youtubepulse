// 브라우저 콘솔에서 실행할 데이터 확인 스크립트
console.log('=== YouTube Pulse 데이터 수집 현황 ===');

// 저장된 데이터 확인
const channels = JSON.parse(localStorage.getItem('youtubepulse_channels') || '{}');
const videos = JSON.parse(localStorage.getItem('youtubepulse_videos') || '{}');
const dailyStats = JSON.parse(localStorage.getItem('youtubepulse_daily_stats') || '{}');
const trendingData = JSON.parse(localStorage.getItem('youtubepulse_trending_data') || '{}');

console.log('📊 전체 데이터 현황:');
console.log(`- 채널 수: ${Object.keys(channels).length}개`);
console.log(`- 영상 수: ${Object.keys(videos).length}개`);
console.log(`- 일일 통계: ${Object.keys(dailyStats).length}개`);
console.log(`- 트렌딩 데이터: ${Object.keys(trendingData).length}개`);

// 키워드별 수집 현황 분석
const keywordStats = {};
const allKeywords = [
  '먹방', 'ASMR', '챌린지', '브이로그', '리뷰', '언박싱', '튜토리얼', '하우투',
  'kpop', '뮤직비디오', '커버', '리액션', '인터뷰', '예능', '코미디',
  '게임플레이', '스트리밍', '실시간', '게임리뷰', '게임추천',
  '홈트', '다이어트', '요가', '스킨케어', '뷰티', '메이크업', '패션',
  '요리', '레시피', '맛집', '카페', '디저트', '베이킹',
  '여행', '여행브이로그', '여행기', '인테리어', '집꾸미기',
  '반려동물', '강아지', '고양이', '펫', '펫브이로그',
  '가족', '육아', '아이', '아기', '육아브이로그',
  '공부', '학습', '시험', '취업', '면접', '독서',
  '투자', '주식', '부동산', '경제', '재테크',
  '뉴스', '이슈', '트렌드', '핫이슈', '사회',
  '건강', '의료', '심리', '상담', '명상', '힐링',
  '음악', '노래', '가수', '아이돌', '그룹', '뮤지컬',
  '영화', '드라마', '영화리뷰', '드라마리뷰', '영화추천',
  '기술', 'AI', '인공지능', 'VR', '메타버스', '프로그래밍',
  '스포츠', '축구', '야구', '농구', '운동', '피트니스',
  '쇼핑', '쇼핑몰', '쇼핑리뷰', '구매', '리뷰',
  '그림', '미술', '사진', '카메라', '촬영', 'DIY',
  '커피', '차', '음료', '술', '맥주', '와인',
  '애니메이션', '애니', '웹툰', '웹툰리뷰'
];

// 각 키워드별로 영상 제목에서 매칭되는 영상 수 계산
Object.values(videos).forEach(video => {
  const title = video.title.toLowerCase();
  const description = video.description.toLowerCase();
  
  allKeywords.forEach(keyword => {
    if (title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())) {
      keywordStats[keyword] = (keywordStats[keyword] || 0) + 1;
    }
  });
});

console.log('\n🎯 키워드별 수집 현황:');
console.log('='.repeat(50));

// 키워드별 통계 출력
Object.entries(keywordStats)
  .sort(([,a], [,b]) => b - a) // 수집량 순으로 정렬
  .forEach(([keyword, count]) => {
    console.log(`${keyword.padEnd(12)}: ${count.toString().padStart(3)}개`);
  });

console.log('='.repeat(50));
console.log(`총 수집된 키워드: ${Object.keys(keywordStats).length}개`);
console.log(`총 수집된 영상: ${Object.keys(videos).length}개`);

// 카테고리별 통계
const categoryStats = {
  '인기 콘텐츠': ['먹방', 'ASMR', '챌린지', '브이로그', '리뷰', '언박싱', '튜토리얼', '하우투'],
  '엔터테인먼트': ['kpop', '뮤직비디오', '커버', '리액션', '인터뷰', '예능', '코미디'],
  '게임 & 스트리밍': ['게임플레이', '스트리밍', '실시간', '게임리뷰', '게임추천'],
  '라이프스타일': ['홈트', '다이어트', '요가', '스킨케어', '뷰티', '메이크업', '패션'],
  '음식 & 요리': ['요리', '레시피', '맛집', '카페', '디저트', '베이킹'],
  '여행 & 라이프': ['여행', '여행브이로그', '여행기', '인테리어', '집꾸미기'],
  '반려동물': ['반려동물', '강아지', '고양이', '펫', '펫브이로그'],
  '가족 & 육아': ['가족', '육아', '아이', '아기', '육아브이로그'],
  '교육 & 학습': ['공부', '학습', '시험', '취업', '면접', '독서'],
  '투자 & 경제': ['투자', '주식', '부동산', '경제', '재테크'],
  '뉴스 & 이슈': ['뉴스', '이슈', '트렌드', '핫이슈', '사회'],
  '건강 & 웰빙': ['건강', '의료', '심리', '상담', '명상', '힐링'],
  '음악 & 예술': ['음악', '노래', '가수', '아이돌', '그룹', '뮤지컬'],
  '영화 & 드라마': ['영화', '드라마', '영화리뷰', '드라마리뷰', '영화추천'],
  '기술 & 개발': ['기술', 'AI', '인공지능', 'VR', '메타버스', '프로그래밍'],
  '스포츠': ['스포츠', '축구', '야구', '농구', '운동', '피트니스'],
  '쇼핑 & 리뷰': ['쇼핑', '쇼핑몰', '쇼핑리뷰', '구매', '리뷰'],
  '창작 & 취미': ['그림', '미술', '사진', '카메라', '촬영', 'DIY'],
  '음료 & 술': ['커피', '차', '음료', '술', '맥주', '와인'],
  '애니메이션 & 웹툰': ['애니메이션', '애니', '웹툰', '웹툰리뷰']
};

console.log('\n📂 카테고리별 수집 현황:');
console.log('='.repeat(50));

Object.entries(categoryStats).forEach(([category, keywords]) => {
  const categoryCount = keywords.reduce((sum, keyword) => sum + (keywordStats[keyword] || 0), 0);
  console.log(`${category.padEnd(15)}: ${categoryCount.toString().padStart(3)}개`);
});

console.log('='.repeat(50));
