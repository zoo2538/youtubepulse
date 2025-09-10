// 데이터 수집 설정 및 키워드 목록
export interface DataCollectionConfig {
  keywords: string[];
  maxResults: number;
  maxRequests: number;
  regionCode: string;
  requestDelay: number;
  collectionInterval: number;
  // 최소 조회수(전체 누적) 기준 필터
  minViewCount?: number;
  // 최소 일일 조회수 증가 기준 필터 (옵션)
  minDailyViews?: number;
}

// YouTube 인기 키워드 목록 (업데이트된 버전)
export const EXPANDED_KEYWORDS = [
  // 인기 콘텐츠 (4개)
  '브이로그', '리뷰', '언박싱', '튜토리얼',
  
  // 엔터테인먼트 (5개)
  'kpop', '리액션', '인터뷰', '예능', '코미디',
  
  // 게임 & 스트리밍 (3개)
  '게임', '게임요약', '게임 공략',
  
  // 라이프스타일 (3개)
  '뷰티', '메이크업', '패션',
  
  // 음식 & 요리 (0개)
  
  // 여행 & 라이프 (3개)
  '여행', '인테리어', '집꾸미기',
  
  // 가족 & 육아 (0개)
  
  
  // 교육 & 학습 (3개)
  '공부', '시험', '취업',
  
  // 투자 & 경제 (4개)
  '투자', '부동산', '경제', '재테크',
  
  // 뉴스 & 이슈 (5개)
  '뉴스 요약', '트렌드', '사회', '정치 이슈', '정치 요약',
  
  // 건강 & 웰빙 (3개)
  '건강', '웰빙', '명상',
  
  // 음악 & 예술 (3개)
  '연예인', '아이돌', '그룹',
  
  // 영화 & 드라마 (4개)
  '영화', '드라마', '영화리뷰', '드라마리뷰',
  
  // 기술 & 개발 (2개)
  '인공지능', 'VR',
  
  // 스포츠 (3개)
  '스포츠 요약', '스포츠 이슈', '운동',
  
  // 쇼핑 & 리뷰 (4개)
  '쇼핑', '쇼핑리뷰', '구매', '리뷰',
  
  // 창작 & 취미 (3개)
  '취미', '여가', '반려동물',
  
  // 애니메이션 & 웹툰 (3개)
  '애니메이션', '애니', '웹툰',
  
  // 시니어 & 노년층 (11개)
  '막장', '건강관리', '취미', '여가', '인생경험', '지혜', '사연', '감동', '인생', '국뽕', '실화',
  
  // 트렌드 & 밈 (3개)
  '썰', '밈', '힐링'
];

// 기본 데이터 수집 설정
export const DEFAULT_COLLECTION_CONFIG: DataCollectionConfig = {
  keywords: EXPANDED_KEYWORDS,
  maxResults: 10000, // 최대 수집 영상 수 (트렌딩 기반)
  maxRequests: 140, // 최대 API 요청 수 (할당량 고려)
  regionCode: 'KR', // 한국 지역
  requestDelay: 100, // 요청 간 지연 시간 (ms)
  collectionInterval: 300, // 수집 간격 (초)
  minViewCount: 50000, // 기본 5만 조회 이상만 수집
};

// 설정 저장 함수
export const saveCollectionConfig = (config: DataCollectionConfig) => {
  localStorage.setItem('youtubepulse_collection_config', JSON.stringify(config));
};

// 설정 불러오기 함수
export const loadCollectionConfig = (): DataCollectionConfig => {
  const saved = localStorage.getItem('youtubepulse_collection_config');
  if (saved) {
    return JSON.parse(saved);
  }
  return DEFAULT_COLLECTION_CONFIG;
};

// YouTube 인기 키워드 카테고리별 분류
export const KEYWORD_CATEGORIES = {
  '인기 콘텐츠': ['브이로그', '리뷰', '언박싱', '튜토리얼'],
  '엔터테인먼트': ['kpop', '리액션', '인터뷰', '예능', '코미디'],
  '게임 & 스트리밍': ['게임', '게임요약', '게임 공략'],
  '라이프스타일': ['뷰티', '메이크업', '패션'],
  '음식 & 요리': [],
  '여행 & 라이프': ['여행', '인테리어', '집꾸미기'],
  '가족 & 육아': [],
  '교육 & 학습': ['공부', '시험', '취업'],
  '투자 & 경제': ['투자', '부동산', '경제', '재테크'],
  '뉴스 & 이슈': ['뉴스 요약', '트렌드', '사회', '정치 이슈', '정치 요약'],
  '건강 & 웰빙': ['건강', '웰빙', '명상'],
  '음악 & 예술': ['연예인', '아이돌', '그룹'],
  '영화 & 드라마': ['영화', '드라마', '영화리뷰', '드라마리뷰'],
  '기술 & 개발': ['인공지능', 'VR'],
  '스포츠': ['스포츠 요약', '스포츠 이슈', '운동'],
  '쇼핑 & 리뷰': ['쇼핑', '쇼핑리뷰', '구매', '리뷰'],
  '창작 & 취미': ['취미', '여가', '반려동물'],
  '애니메이션 & 웹툰': ['애니메이션', '애니', '웹툰'],
  '시니어 & 노년층': ['막장', '건강관리', '취미', '여가', '인생경험', '지혜', '사연', '감동', '인생', '국뽕', '실화'],
  '트렌드 & 밈': ['썰', '밈', '힐링']
};

// 키워드 통계 정보
export const getKeywordStats = () => {
  return {
    totalKeywords: EXPANDED_KEYWORDS.length,
    categories: Object.keys(KEYWORD_CATEGORIES).length,
    keywordsByCategory: Object.fromEntries(
      Object.entries(KEYWORD_CATEGORIES).map(([category, keywords]) => [
        category, 
        keywords.length
      ])
    )
  };
};
