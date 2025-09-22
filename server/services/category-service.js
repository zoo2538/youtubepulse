// 카테고리 서비스 (데스크탑 앱과 동일한 기능)
export class CategoryService {
  constructor() {
    // 기본 카테고리 (데스크탑 앱과 동일)
    this.defaultCategories = {
      '엔터테인먼트': ['음악', '영화', 'TV', '게임', '스포츠', '코미디', '예능'],
      '교육': ['강의', '튜토리얼', '언어학습', '과학', '역사', '문학', '기술'],
      '라이프스타일': ['뷰티', '패션', '요리', '여행', '건강', '운동', '인테리어'],
      '뉴스': ['정치', '경제', '사회', '국제', '기술', '스포츠', '연예'],
      '기술': ['프로그래밍', 'AI', '하드웨어', '소프트웨어', '리뷰', '튜토리얼', '뉴스'],
      '비즈니스': ['경영', '마케팅', '재무', '창업', '투자', '부동산', '경제'],
      '기타': ['일반', '기타', '미분류']
    };
    
    // 카테고리 색상 (데스크탑 앱과 동일)
    this.categoryColors = {
      '엔터테인먼트': '#FF6B6B',
      '교육': '#4ECDC4',
      '라이프스타일': '#45B7D1',
      '뉴스': '#96CEB4',
      '기술': '#FFEAA7',
      '비즈니스': '#DDA0DD',
      '기타': '#98D8C8'
    };
    
    // 현재 카테고리 (메모리 저장)
    this.currentCategories = { ...this.defaultCategories };
  }

  // 카테고리 목록 조회
  async getCategories() {
    return this.currentCategories;
  }

  // 카테고리 저장
  async saveCategories(categories) {
    try {
      // 유효성 검사
      if (!categories || typeof categories !== 'object') {
        throw new Error('유효하지 않은 카테고리 데이터입니다.');
      }

      // 카테고리 구조 검증
      for (const [categoryName, subCategories] of Object.entries(categories)) {
        if (!Array.isArray(subCategories)) {
          throw new Error(`${categoryName} 카테고리의 세부카테고리가 배열이 아닙니다.`);
        }
      }

      this.currentCategories = { ...categories };
      
      console.log('✅ 카테고리 저장 완료:', Object.keys(categories));
      return this.currentCategories;
    } catch (error) {
      console.error('카테고리 저장 오류:', error);
      throw error;
    }
  }

  // 세부카테고리 추가
  async addSubCategory(category, subCategory) {
    try {
      if (!this.currentCategories[category]) {
        throw new Error(`카테고리 "${category}"가 존재하지 않습니다.`);
      }

      if (this.currentCategories[category].includes(subCategory)) {
        throw new Error(`세부카테고리 "${subCategory}"가 이미 존재합니다.`);
      }

      this.currentCategories[category].push(subCategory);
      
      console.log(`✅ ${category} 카테고리에 "${subCategory}" 세부카테고리 추가됨`);
      return this.currentCategories;
    } catch (error) {
      console.error('세부카테고리 추가 오류:', error);
      throw error;
    }
  }

  // 세부카테고리 삭제
  async removeSubCategory(category, subCategory) {
    try {
      if (!this.currentCategories[category]) {
        throw new Error(`카테고리 "${category}"가 존재하지 않습니다.`);
      }

      const index = this.currentCategories[category].indexOf(subCategory);
      if (index === -1) {
        throw new Error(`세부카테고리 "${subCategory}"가 존재하지 않습니다.`);
      }

      this.currentCategories[category].splice(index, 1);
      
      console.log(`✅ ${category} 카테고리에서 "${subCategory}" 세부카테고리 삭제됨`);
      return this.currentCategories;
    } catch (error) {
      console.error('세부카테고리 삭제 오류:', error);
      throw error;
    }
  }

  // 세부카테고리 수정
  async updateSubCategory(category, oldSubCategory, newSubCategory) {
    try {
      if (!this.currentCategories[category]) {
        throw new Error(`카테고리 "${category}"가 존재하지 않습니다.`);
      }

      const index = this.currentCategories[category].indexOf(oldSubCategory);
      if (index === -1) {
        throw new Error(`세부카테고리 "${oldSubCategory}"가 존재하지 않습니다.`);
      }

      if (this.currentCategories[category].includes(newSubCategory)) {
        throw new Error(`세부카테고리 "${newSubCategory}"가 이미 존재합니다.`);
      }

      this.currentCategories[category][index] = newSubCategory;
      
      console.log(`✅ ${category} 카테고리의 "${oldSubCategory}"를 "${newSubCategory}"로 수정됨`);
      return this.currentCategories;
    } catch (error) {
      console.error('세부카테고리 수정 오류:', error);
      throw error;
    }
  }

  // 카테고리별 통계 조회
  async getCategoryStats(category, date = null) {
    try {
      // 실제로는 데이터베이스에서 조회해야 하지만, 여기서는 임시 데이터 반환
      const stats = {
        category,
        totalVideos: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        subCategoryStats: {},
        dateRange: date || '전체'
      };

      // 세부카테고리별 통계 초기화
      if (this.currentCategories[category]) {
        for (const subCategory of this.currentCategories[category]) {
          stats.subCategoryStats[subCategory] = {
            videoCount: 0,
            viewCount: 0,
            likeCount: 0,
            commentCount: 0
          };
        }
      }

      return stats;
    } catch (error) {
      console.error('카테고리 통계 조회 오류:', error);
      throw error;
    }
  }

  // 카테고리별 비디오 목록 조회
  async getCategoryVideos(category, options = {}) {
    try {
      const { subCategory, date, limit } = options;
      
      // 실제로는 데이터베이스에서 조회해야 하지만, 여기서는 빈 배열 반환
      let videos = [];
      
      // 필터링 로직 (실제 구현 시 데이터베이스 쿼리로 대체)
      if (subCategory) {
        // 특정 세부카테고리 필터링
        videos = videos.filter(video => video.subCategory === subCategory);
      }
      
      if (date) {
        // 특정 날짜 필터링
        videos = videos.filter(video => {
          const videoDate = video.collectedAt || video.savedAt;
          return videoDate && videoDate.startsWith(date);
        });
      }
      
      if (limit) {
        videos = videos.slice(0, parseInt(limit));
      }
      
      return videos;
    } catch (error) {
      console.error('카테고리 비디오 조회 오류:', error);
      throw error;
    }
  }

  // 카테고리 색상 조회
  getCategoryColor(category) {
    return this.categoryColors[category] || '#98D8C8';
  }

  // 모든 카테고리 색상 조회
  getAllCategoryColors() {
    return this.categoryColors;
  }

  // 카테고리 초기화 (기본값으로 리셋)
  async resetToDefault() {
    this.currentCategories = { ...this.defaultCategories };
    console.log('✅ 카테고리를 기본값으로 초기화했습니다.');
    return this.currentCategories;
  }

  // 카테고리 검증
  validateCategory(category, subCategory = null) {
    if (!this.currentCategories[category]) {
      return { valid: false, message: `카테고리 "${category}"가 존재하지 않습니다.` };
    }

    if (subCategory && !this.currentCategories[category].includes(subCategory)) {
      return { valid: false, message: `세부카테고리 "${subCategory}"가 존재하지 않습니다.` };
    }

    return { valid: true, message: '유효한 카테고리입니다.' };
  }

  // 카테고리 목록 (배열 형태)
  getCategoryList() {
    return Object.keys(this.currentCategories);
  }

  // 세부카테고리 목록 (배열 형태)
  getSubCategoryList(category) {
    return this.currentCategories[category] || [];
  }

  // 모든 세부카테고리 목록 (평면화)
  getAllSubCategories() {
    const allSubCategories = [];
    for (const subCategories of Object.values(this.currentCategories)) {
      allSubCategories.push(...subCategories);
    }
    return allSubCategories;
  }
}

export const categoryService = new CategoryService();
