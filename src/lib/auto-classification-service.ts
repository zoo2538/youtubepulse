// 자동 분류 서비스 - 키워드 기반 자동 분류
import { KEYWORD_CATEGORIES } from './data-collection-config';
import { categories, subCategories } from './subcategories';

interface ClassificationResult {
  category: string;
  subCategory: string;
  confidence: number;
  matchedKeywords: string[];
}

class AutoClassificationService {
  
  // 영상 제목과 설명을 기반으로 자동 분류
  classifyVideo(videoTitle: string, videoDescription: string = '', channelName: string = ''): ClassificationResult {
    const text = `${videoTitle} ${videoDescription} ${channelName}`.toLowerCase();
    
    // 각 카테고리별 점수 계산
    const categoryScores: { [key: string]: { score: number; keywords: string[] } } = {};
    
    // KEYWORD_CATEGORIES를 기반으로 점수 계산
    Object.entries(KEYWORD_CATEGORIES).forEach(([category, keywords]) => {
      let score = 0;
      const matchedKeywords: string[] = [];
      
      keywords.forEach(keyword => {
        if (text.includes(keyword.toLowerCase())) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      });
      
      if (score > 0) {
        categoryScores[category] = { score, keywords: matchedKeywords };
      }
    });
    
    // 추가 키워드 패턴 매칭
    const additionalPatterns = this.getAdditionalPatterns();
    Object.entries(additionalPatterns).forEach(([category, patterns]) => {
      let score = 0;
      const matchedKeywords: string[] = [];
      
      patterns.forEach(pattern => {
        if (text.includes(pattern.toLowerCase())) {
          score += 1;
          matchedKeywords.push(pattern);
        }
      });
      
      if (score > 0) {
        if (categoryScores[category]) {
          categoryScores[category].score += score;
          categoryScores[category].keywords.push(...matchedKeywords);
        } else {
          categoryScores[category] = { score, keywords: matchedKeywords };
        }
      }
    });
    
    // 가장 높은 점수의 카테고리 선택
    const bestMatch = Object.entries(categoryScores)
      .sort(([,a], [,b]) => b.score - a.score)[0];
    
    if (bestMatch) {
      const [category, data] = bestMatch;
      const subCategory = this.selectSubCategory(category, data.keywords);
      const confidence = Math.min(data.score / 3, 1); // 최대 1.0으로 정규화
      
      return {
        category: this.mapToStandardCategory(category),
        subCategory,
        confidence,
        matchedKeywords: data.keywords
      };
    }
    
    // 매칭되지 않으면 기타로 분류
    return {
      category: '기타',
      subCategory: '기타',
      confidence: 0,
      matchedKeywords: []
    };
  }
  
  // 추가 패턴 매칭 규칙
  private getAdditionalPatterns(): { [key: string]: string[] } {
    return {
      '연예': ['아이돌', '케이팝', 'k-pop', 'kpop', '트롯', '가수', '연예인', '스타', '팬', '팬클럽'],
      '정치': ['정치', '선거', '국회', '정부', '대통령', '국회의원', '정당', '민주당', '국민의힘'],
      '사회/경제/시사': ['뉴스', '이슈', '사회', '경제', '부동산', '재테크', '투자', '주식', '코인'],
      '라이프스타일': ['뷰티', '메이크업', '패션', '헬스', '운동', '다이어트', '요가', '피트니스'],
      '음식/요리': ['요리', '레시피', '맛집', '먹방', '쿠킹', '베이킹', '음식', '식당'],
      '게임': ['게임', '게임공략', '게임리뷰', '게임플레이', '게임요약', '게임하이라이트'],
      '스포츠': ['축구', '야구', '농구', '배구', '테니스', '골프', '스포츠', '운동선수'],
      '교육': ['공부', '시험', '취업', '면접', '자격증', '강의', '교육', '학습'],
      '기술': ['ai', '인공지능', '프로그래밍', '개발', '코딩', '기술', 'it', '소프트웨어'],
      '여행': ['여행', '관광', '여행지', '해외여행', '국내여행', '여행브이로그'],
      '애니/웹툰': ['애니', '애니메이션', '웹툰', '만화', '일본애니', '한국애니'],
      '시니어': ['막장', '건강', '인생', '경험', '지혜', '사연', '감동', '국뽕', '실화'],
      '쇼핑/리뷰': ['쇼핑', '리뷰', '구매', '언박싱', '제품리뷰', '쇼핑리뷰'],
      '크리에이터': ['브이로그', '일상', 'vlog', '개인', '라이프', '데일리']
    };
  }
  
  // 서브카테고리 선택
  private selectSubCategory(category: string, keywords: string[]): string {
    const standardCategory = this.mapToStandardCategory(category);
    const availableSubCategories = subCategories[standardCategory] || ['기타'];
    
    // 키워드 기반으로 가장 적합한 서브카테고리 선택
    for (const keyword of keywords) {
      for (const subCat of availableSubCategories) {
        if (subCat.toLowerCase().includes(keyword.toLowerCase()) || 
            keyword.toLowerCase().includes(subCat.toLowerCase())) {
          return subCat;
        }
      }
    }
    
    // 매칭되지 않으면 첫 번째 서브카테고리 반환
    return availableSubCategories[0];
  }
  
  // 표준 카테고리로 매핑
  private mapToStandardCategory(category: string): string {
    const mapping: { [key: string]: string } = {
      '인기 콘텐츠': '크리에이터',
      '엔터테인먼트': '연예',
      '게임 & 스트리밍': '게임',
      '라이프스타일': '라이프스타일',
      '음식 & 요리': '라이프스타일',
      '여행 & 라이프': '라이프스타일',
      '가족 & 육아': '라이프스타일',
      '교육 & 학습': '크리에이터',
      '투자 & 경제': '사회/경제/시사',
      '뉴스 & 이슈': '사회/경제/시사',
      '건강 & 웰빙': '라이프스타일',
      '음악 & 예술': '연예',
      '영화 & 드라마': '애니/웹툰',
      '기술 & 개발': 'AI',
      '스포츠': '스포츠',
      '쇼핑 & 리뷰': '쇼핑/리뷰',
      '창작 & 취미': '크리에이터',
      '애니메이션 & 웹툰': '애니/웹툰',
      '시니어 & 노년층': '시니어',
      '트렌드 & 밈': '커뮤니티/썰'
    };
    
    return mapping[category] || '기타';
  }
  
  // 자동 분류 실행 (배치 처리)
  async classifyBatch(videos: any[]): Promise<any[]> {
    console.log(`🤖 자동 분류 시작: ${videos.length}개 영상`);
    
    const results = videos.map(video => {
      const classification = this.classifyVideo(
        video.videoTitle || video.title || '',
        video.videoDescription || video.description || '',
        video.channelName || video.channel_name || ''
      );
      
      return {
        ...video,
        category: classification.category,
        subCategory: classification.subCategory,
        status: classification.confidence > 0.3 ? 'classified' : 'unclassified',
        autoClassified: true,
        classificationConfidence: classification.confidence,
        matchedKeywords: classification.matchedKeywords
      };
    });
    
    const classifiedCount = results.filter(r => r.status === 'classified').length;
    console.log(`✅ 자동 분류 완료: ${classifiedCount}/${videos.length}개 분류됨`);
    
    return results;
  }
}

export const autoClassificationService = new AutoClassificationService();
