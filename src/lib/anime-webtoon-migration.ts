import { indexedDBService } from './indexeddb-service';

export async function migrateAnimeWebtoonData() {
  console.log('🔄 애니/웹툰 카테고리 마이그레이션 시작...');
  try {
    const unclassifiedData = await indexedDBService.loadUnclassifiedData();
    const classifiedData = await indexedDBService.loadClassifiedData();

    let unclassifiedChangedCount = 0;
    let classifiedChangedCount = 0;

    const processData = (data: any[], isClassified: boolean) => {
      return data.map(item => {
        let changed = false;
        
        // 기존: category: "짜집기", subCategory: "애니/웹툰"
        // 변경: category: "애니/웹툰", subCategory: "요약/명장면" (기본값)
        if (item.category === '짜집기' && item.subCategory === '애니/웹툰') {
          item.category = '애니/웹툰';
          item.subCategory = '요약/명장면'; // 기본 세부카테고리로 설정
          changed = true;
        }
        
        // 기존: category: "애니/웹툰", subCategory: "애니메이션"
        // 변경: category: "애니/웹툰", subCategory: "요약/명장면"
        if (item.category === '애니/웹툰' && item.subCategory === '애니메이션') {
          item.subCategory = '요약/명장면';
          changed = true;
        }
        
        // 기존: category: "애니/웹툰", subCategory: "웹툰/만화"
        // 변경: category: "애니/웹툰", subCategory: "이슈/정보"
        if (item.category === '애니/웹툰' && item.subCategory === '웹툰/만화') {
          item.subCategory = '이슈/정보';
          changed = true;
        }
        
        // 기존: category: "애니/웹툰", subCategory: "게임/애니"
        // 변경: category: "애니/웹툰", subCategory: "종합/기타"
        if (item.category === '애니/웹툰' && item.subCategory === '게임/애니') {
          item.subCategory = '종합/기타';
          changed = true;
        }
        
        if (changed) {
          if (isClassified) classifiedChangedCount++;
          else unclassifiedChangedCount++;
        }
        return item;
      });
    };

    const updatedUnclassifiedData = processData(unclassifiedData, false);
    const updatedClassifiedData = processData(classifiedData, true);

    // 변경된 데이터가 있는 경우에만 저장
    if (unclassifiedChangedCount > 0 || classifiedChangedCount > 0) {
      await indexedDBService.saveUnclassifiedData(updatedUnclassifiedData);
      await indexedDBService.saveClassifiedData(updatedClassifiedData);
      
      console.log(`✅ unclassifiedData에서 ${unclassifiedChangedCount}개 항목을 '애니/웹툰' 카테고리로 변경 완료`);
      console.log(`✅ classifiedData에서 ${classifiedChangedCount}개 항목을 '애니/웹툰' 카테고리로 변경 완료`);
      console.log('🎉 애니/웹툰 카테고리 마이그레이션 완료!');
      console.log(`📊 총 ${unclassifiedChangedCount + classifiedChangedCount}개 항목이 새로운 '애니/웹툰' 카테고리로 변경되었습니다.`);
    } else {
      console.log('ℹ️ 마이그레이션할 데이터가 없습니다. (기존에 "짜집기" → "애니/웹툰"으로 분류된 데이터가 없음)');
    }
  } catch (error) {
    console.error('❌ 애니/웹툰 카테고리 마이그레이션 실패:', error);
  }
}
