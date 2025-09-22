import { indexedDBService } from './indexeddb-service';

export async function migrateLongformToSenior() {
  console.log('🔄 롱폼 → 시니어 카테고리 마이그레이션 시작...');
  try {
    const unclassifiedData = await indexedDBService.loadUnclassifiedData();
    const classifiedData = await indexedDBService.loadClassifiedData();

    let unclassifiedChangedCount = 0;
    let classifiedChangedCount = 0;

    const processData = (data: any[], isClassified: boolean) => {
      return data.map(item => {
        let changed = false;

        // 기존: category: "롱폼"
        // 변경: category: "시니어"
        if (item.category === '롱폼') {
          item.category = '시니어';
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

    console.log(`✅ unclassifiedData에서 ${unclassifiedChangedCount}개 항목 카테고리 변경 완료`);
    console.log(`✅ classifiedData에서 ${classifiedChangedCount}개 항목 카테고리 변경 완료`);
    console.log('🎉 롱폼 → 시니어 카테고리 마이그레이션 완료!');
    console.log(`📊 총 ${unclassifiedChangedCount + classifiedChangedCount}개 항목이 변경되었습니다.`);
  } catch (error) {
    console.error('❌ 롱폼 → 시니어 카테고리 마이그레이션 실패:', error);
  }
}














