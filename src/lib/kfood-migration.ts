import { indexedDBService } from './indexeddb-service';

export async function migrateKFoodToKoreanCooking() {
  console.log('🔄 K푸드 → 요리/한식 카테고리 마이그레이션 시작...');
  try {
    const unclassifiedData = await indexedDBService.loadUnclassifiedData();
    const classifiedData = await indexedDBService.loadClassifiedData();

    let unclassifiedChangedCount = 0;
    let classifiedChangedCount = 0;

    const processData = (data: any[], isClassified: boolean) => {
      return data.map(item => {
        let changed = false;

        // 기존: subCategory: "K푸드"
        // 변경: subCategory: "요리/한식"
        if (item.subCategory === 'K푸드') {
          item.subCategory = '요리/한식';
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

    await indexedDBService.saveUnclassifiedData(updatedUnclassifiedData);
    await indexedDBService.saveClassifiedData(updatedClassifiedData);

    console.log(`✅ unclassifiedData에서 ${unclassifiedChangedCount}개 항목 세부카테고리 변경 완료`);
    console.log(`✅ classifiedData에서 ${classifiedChangedCount}개 항목 세부카테고리 변경 완료`);
    console.log('🎉 K푸드 → 요리/한식 카테고리 마이그레이션 완료!');
    console.log(`📊 총 ${unclassifiedChangedCount + classifiedChangedCount}개 항목이 변경되었습니다.`);
  } catch (error) {
    console.error('❌ K푸드 → 요리/한식 카테고리 마이그레이션 실패:', error);
  }
}


