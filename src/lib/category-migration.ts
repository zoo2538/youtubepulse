// 카테고리 마이그레이션 스크립트
// 기존 데이터의 "테크", "음식" 카테고리를 중앙화된 카테고리로 변경

import { indexedDBService } from './indexeddb-service';

export const migrateCategories = async () => {
  try {
    console.log('🔄 카테고리 마이그레이션 시작...');
    
    // 1. unclassifiedData에서 카테고리 변경
    const unclassifiedData = await indexedDBService.loadUnclassifiedData();
    let unclassifiedUpdated = 0;
    
    const updatedUnclassifiedData = unclassifiedData.map((item: any) => {
      if (item.category === '테크') {
        item.category = 'AI'; // 테크 → AI로 변경
        item.subCategory = 'AI 영상'; // 적절한 세부카테고리로 변경
        unclassifiedUpdated++;
      } else if (item.category === '음식') {
        item.category = '라이프스타일'; // 음식 → 라이프스타일로 변경
        item.subCategory = '요리/음식'; // 적절한 세부카테고리로 변경
        unclassifiedUpdated++;
      }
      return item;
    });
    
    if (unclassifiedUpdated > 0) {
      await indexedDBService.updateUnclassifiedData(updatedUnclassifiedData);
      console.log(`✅ unclassifiedData에서 ${unclassifiedUpdated}개 항목 카테고리 변경 완료`);
    }
    
    // 2. classifiedData에서 카테고리 변경
    const classifiedData = await indexedDBService.loadClassifiedData();
    let classifiedUpdated = 0;
    
    const updatedClassifiedData = classifiedData.map((item: any) => {
      if (item.category === '테크') {
        item.category = 'AI';
        item.subCategory = 'AI 영상';
        classifiedUpdated++;
      } else if (item.category === '음식') {
        item.category = '라이프스타일';
        item.subCategory = '요리/음식';
        classifiedUpdated++;
      }
      return item;
    });
    
    if (classifiedUpdated > 0) {
      await indexedDBService.saveClassifiedData(updatedClassifiedData);
      console.log(`✅ classifiedData에서 ${classifiedUpdated}개 항목 카테고리 변경 완료`);
    }
    
    console.log('🎉 카테고리 마이그레이션 완료!');
    console.log(`📊 총 ${unclassifiedUpdated + classifiedUpdated}개 항목이 중앙화된 카테고리로 변경되었습니다.`);
    
  } catch (error) {
    console.error('❌ 카테고리 마이그레이션 실패:', error);
    throw error;
  }
};

// 마이그레이션 실행 함수 (개발자 도구에서 호출 가능)
(window as any).migrateCategories = migrateCategories;















