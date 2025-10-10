// 10월 6일 데이터의 고유 ID를 새로운 형식으로 업데이트하는 함수
import { indexedDBService } from './indexeddb-service';

export async function updateOctober6DataIds(): Promise<{
  success: boolean;
  message: string;
  updatedCount: number;
  errorCount: number;
}> {
  console.log('🔄 10월 6일 데이터 ID 업데이트 시작...');
  
  try {
    // 10월 6일 데이터 조회
    const allData = await indexedDBService.loadUnclassifiedData();
    
    // 10월 6일 데이터 필터링
    const october6Data = allData.filter(item => {
      const collectionDate = item.collectionDate || item.uploadDate;
      return collectionDate && collectionDate.includes('2025-10-06');
    });
    
    console.log(`📊 10월 6일 데이터 발견: ${october6Data.length}개`);
    
    if (october6Data.length === 0) {
      return {
        success: true,
        message: '10월 6일 데이터가 없습니다.',
        updatedCount: 0,
        errorCount: 0
      };
    }
    
    // 새로운 ID 형식으로 업데이트
    const updatedData = october6Data.map((item, index) => {
      const timestamp = Date.now() + index; // 인덱스 추가로 고유성 보장
      const random = Math.random().toString(36).substr(2, 9);
      const videoIdPrefix = item.videoId ? item.videoId.substring(0, 8) : 'unknown';
      
      // 새로운 ID 생성: videoId_${timestamp}_${random}
      const newId = `${videoIdPrefix}_${timestamp}_${random}`;
      
      console.log(`🔄 ID 업데이트: ${item.id} → ${newId}`);
      
      return {
        ...item,
        id: newId,
        updatedAt: new Date().toISOString()
      };
    });
    
    // 기존 데이터에서 10월 6일 데이터 제거
    const otherData = allData.filter(item => {
      const collectionDate = item.collectionDate || item.uploadDate;
      return !collectionDate || !collectionDate.includes('2025-10-06');
    });
    
    // 업데이트된 데이터와 기존 데이터 합치기
    const finalData = [...otherData, ...updatedData];
    
    // IndexedDB에 저장
    await indexedDBService.saveUnclassifiedData(finalData);
    
    console.log(`🎉 10월 6일 데이터 ID 업데이트 완료!`);
    console.log(`   - 업데이트된 데이터: ${updatedData.length}개`);
    console.log(`   - 총 데이터: ${finalData.length}개`);
    
    return {
      success: true,
      message: `10월 6일 데이터 ${updatedData.length}개의 ID가 새로운 형식으로 업데이트되었습니다.`,
      updatedCount: updatedData.length,
      errorCount: 0
    };
    
  } catch (error) {
    console.error('❌ ID 업데이트 실패:', error);
    return {
      success: false,
      message: `ID 업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      updatedCount: 0,
      errorCount: 1
    };
  }
}

// ID 형식 검증 함수
export function validateIdFormat(id: string): boolean {
  // videoId_${timestamp}_${random} 형식 검증
  const pattern = /^[a-zA-Z0-9_-]+_\d+_[a-zA-Z0-9]+$/;
  return pattern.test(id);
}

// 새로운 ID 생성 함수
export function generateNewId(videoId: string, index: number = 0): string {
  const timestamp = Date.now() + index;
  const random = Math.random().toString(36).substr(2, 9);
  const videoIdPrefix = videoId ? videoId.substring(0, 8) : 'unknown';
  
  return `${videoIdPrefix}_${timestamp}_${random}`;
}
