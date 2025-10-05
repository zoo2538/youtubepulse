// 로컬 IndexedDB 압축 및 중복 제거
import { indexedDBService } from './indexeddb-service';
import { dedupeComprehensive, type VideoItem } from './dedupe-utils';

export interface CompressionResult {
  before: number;
  after: number;
  duplicatesRemoved: number;
  compressionRate: number;
}

/**
 * 로컬 IndexedDB 압축 및 중복 제거
 * @returns 압축 결과 통계
 */
export async function compressLocalIndexedDB(): Promise<CompressionResult> {
  try {
    console.log('🗜️ 로컬 IndexedDB 압축 시작...');
    
    // 1. 현재 데이터 로드
    const allData = await indexedDBService.loadUnclassifiedData();
    console.log(`📊 압축 전: ${allData.length}개 항목`);
    
    if (allData.length === 0) {
      return { before: 0, after: 0, duplicatesRemoved: 0, compressionRate: 0 };
    }
    
    // 2. 중복 제거 적용
    const dedupedData = dedupeComprehensive(allData as VideoItem[]);
    const duplicatesRemoved = allData.length - dedupedData.length;
    const compressionRate = allData.length > 0 ? (duplicatesRemoved / allData.length * 100) : 0;
    
    console.log(`✅ 압축 후: ${dedupedData.length}개 항목`);
    console.log(`🗑️ 중복 제거: ${duplicatesRemoved}개`);
    console.log(`📊 압축률: ${compressionRate.toFixed(2)}%`);
    
    // 3. 기존 데이터 삭제 후 압축된 데이터 저장
    if (duplicatesRemoved > 0) {
      console.log('🔄 IndexedDB 업데이트 중...');
      
      // 기존 데이터 삭제
      await indexedDBService.clearUnclassifiedData();
      
      // 압축된 데이터 저장
      await indexedDBService.saveUnclassifiedData(dedupedData as any[]);
      
      console.log('✅ IndexedDB 압축 완료');
    }
    
    return {
      before: allData.length,
      after: dedupedData.length,
      duplicatesRemoved,
      compressionRate
    };
    
  } catch (error) {
    console.error('❌ 로컬 압축 실패:', error);
    throw error;
  }
}

/**
 * 특정 날짜의 로컬 압축
 * @param targetDate 대상 날짜 (YYYY-MM-DD)
 * @returns 압축 결과
 */
export async function compressByDate(targetDate: string): Promise<CompressionResult> {
  try {
    console.log(`🗜️ ${targetDate} 날짜별 압축 시작...`);
    
    // 해당 날짜 데이터만 로드
    const allData = await indexedDBService.loadUnclassifiedData();
    const dateData = allData.filter(item => {
      const dayKey = item.dayKeyLocal || 
                    (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : null) ||
                    (item.uploadDate ? new Date(item.uploadDate).toISOString().split('T')[0] : null);
      return dayKey === targetDate;
    });
    
    console.log(`📊 ${targetDate} 압축 전: ${dateData.length}개 항목`);
    
    if (dateData.length === 0) {
      return { before: 0, after: 0, duplicatesRemoved: 0, compressionRate: 0 };
    }
    
    // 중복 제거
    const dedupedData = dedupeComprehensive(dateData as VideoItem[]);
    const duplicatesRemoved = dateData.length - dedupedData.length;
    const compressionRate = dateData.length > 0 ? (duplicatesRemoved / dateData.length * 100) : 0;
    
    console.log(`✅ ${targetDate} 압축 후: ${dedupedData.length}개 항목`);
    console.log(`🗑️ 중복 제거: ${duplicatesRemoved}개`);
    
    // 해당 날짜 데이터만 업데이트
    if (duplicatesRemoved > 0) {
      // 해당 날짜 데이터 삭제
      const otherData = allData.filter(item => {
        const dayKey = item.dayKeyLocal || 
                      (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : null) ||
                      (item.uploadDate ? new Date(item.uploadDate).toISOString().split('T')[0] : null);
        return dayKey !== targetDate;
      });
      
      // 전체 데이터 재구성
      const finalData = [...otherData, ...dedupedData];
      
      // IndexedDB 업데이트
      await indexedDBService.clearUnclassifiedData();
      await indexedDBService.saveUnclassifiedData(finalData as any[]);
      
      console.log(`✅ ${targetDate} 날짜별 압축 완료`);
    }
    
    return {
      before: dateData.length,
      after: dedupedData.length,
      duplicatesRemoved,
      compressionRate
    };
    
  } catch (error) {
    console.error(`❌ ${targetDate} 날짜별 압축 실패:`, error);
    throw error;
  }
}
