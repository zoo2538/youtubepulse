import { indexedDBService } from './indexeddb-service';
import { subCategories } from './subcategories';

// 기존 하드코딩된 세부카테고리를 동적으로 마이그레이션하는 함수
export const migrateSubCategoriesToDynamic = async () => {
  try {
    console.log('🔄 세부카테고리 마이그레이션 시작...');
    
    // 1. 기존 분류된 데이터 로드
    const classifiedData = await indexedDBService.loadClassifiedData();
    console.log(`📊 기존 분류된 데이터: ${classifiedData.length}개`);
    
    // 2. 기존 미분류 데이터 로드
    const unclassifiedData = await indexedDBService.loadUnclassifiedData();
    console.log(`📊 기존 미분류 데이터: ${unclassifiedData.length}개`);
    
    // 3. 하드코딩된 세부카테고리를 IndexedDB에 저장
    await indexedDBService.saveCategories(subCategories);
    console.log('✅ 하드코딩된 세부카테고리를 IndexedDB에 저장 완료');
    
    // 4. 기존 데이터에서 사용된 모든 카테고리와 세부카테고리 추출
    const usedCategories = new Set<string>();
    const usedSubCategories = new Set<string>();
    
    // 분류된 데이터에서 추출
    classifiedData.forEach(item => {
      if (item.category) usedCategories.add(item.category);
      if (item.subCategory) usedSubCategories.add(item.subCategory);
    });
    
    // 미분류 데이터에서 추출
    unclassifiedData.forEach(item => {
      if (item.category) usedCategories.add(item.category);
      if (item.subCategory) usedSubCategories.add(item.subCategory);
    });
    
    console.log('📊 사용된 카테고리:', Array.from(usedCategories));
    console.log('📊 사용된 세부카테고리:', Array.from(usedSubCategories));
    
    // 5. 사용된 카테고리들이 하드코딩된 카테고리에 있는지 확인
    const missingCategories = Array.from(usedCategories).filter(cat => !subCategories[cat]);
    if (missingCategories.length > 0) {
      console.warn('⚠️ 하드코딩에 없는 카테고리들:', missingCategories);
    }
    
    // 6. 사용된 세부카테고리들이 하드코딩된 세부카테고리에 있는지 확인
    const missingSubCategories = Array.from(usedSubCategories).filter(subCat => {
      return !Object.values(subCategories).flat().includes(subCat);
    });
    if (missingSubCategories.length > 0) {
      console.warn('⚠️ 하드코딩에 없는 세부카테고리들:', missingSubCategories);
    }
    
    // 7. categoriesUpdated 이벤트 발생 (모든 페이지에서 새 카테고리 로드)
    window.dispatchEvent(new CustomEvent('categoriesUpdated'));
    console.log('📡 categoriesUpdated 이벤트 발생');
    
    console.log('✅ 세부카테고리 마이그레이션 완료!');
    return {
      success: true,
      classifiedDataCount: classifiedData.length,
      unclassifiedDataCount: unclassifiedData.length,
      usedCategories: Array.from(usedCategories),
      usedSubCategories: Array.from(usedSubCategories),
      missingCategories,
      missingSubCategories
    };
    
  } catch (error) {
    console.error('❌ 세부카테고리 마이그레이션 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// 마이그레이션 상태 확인 함수
export const checkMigrationStatus = async () => {
  try {
    const savedCategories = await indexedDBService.loadCategories();
    const hasDynamicCategories = savedCategories && Object.keys(savedCategories).length > 0;
    
    return {
      hasDynamicCategories,
      savedCategories,
      defaultCategories: subCategories
    };
  } catch (error) {
    console.error('❌ 마이그레이션 상태 확인 실패:', error);
    return {
      hasDynamicCategories: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
