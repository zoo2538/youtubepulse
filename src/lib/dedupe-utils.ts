// 화면 집계 중복 제거 유틸리티
export interface VideoItem {
  videoId: string;
  dayKeyLocal?: string;
  collectionDate?: string;
  uploadDate?: string;
  viewCount?: number;
  likeCount?: number;
  category?: string;
  subCategory?: string;
  status?: string;
  [key: string]: any;
}

/**
 * 영상별 날짜별 중복 제거 (최대 조회수 보존)
 * @param rows 영상 데이터 배열
 * @returns 중복 제거된 영상 데이터 배열
 */
export function dedupeByVideoDay(rows: VideoItem[]): VideoItem[] {
  const map = new Map<string, VideoItem>();
  
  for (const row of rows) {
    // dayKeyLocal 우선, 없으면 collectionDate, uploadDate 순으로 사용
    const dayKey = row.dayKeyLocal || 
                   (row.collectionDate ? new Date(row.collectionDate).toISOString().split('T')[0] : null) ||
                   (row.uploadDate ? new Date(row.uploadDate).toISOString().split('T')[0] : null);
    
    if (!dayKey) continue; // 날짜 키가 없으면 스킵
    
    const key = `${row.videoId}|${dayKey}`;
    const existing = map.get(key);
    
    if (!existing) {
      // 첫 번째 항목
      map.set(key, row);
    } else {
      // 중복 발견 - 최대 조회수 보존
      const currentViews = row.viewCount || 0;
      const existingViews = existing.viewCount || 0;
      
      if (currentViews > existingViews) {
        // 현재 항목이 조회수가 더 높으면 교체
        map.set(key, row);
      } else if (currentViews === existingViews) {
        // 조회수가 같으면 분류 상태 우선 (classified > unclassified)
        const currentStatus = row.status || 'unclassified';
        const existingStatus = existing.status || 'unclassified';
        
        if (currentStatus === 'classified' && existingStatus !== 'classified') {
          map.set(key, row);
        } else if (currentStatus === existingStatus) {
          // 상태도 같으면 최신 항목 유지 (updatedAt 기준)
          const currentTime = new Date(row.updatedAt || row.createdAt || 0).getTime();
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          
          if (currentTime > existingTime) {
            map.set(key, row);
          }
        }
      }
    }
  }
  
  return Array.from(map.values());
}

/**
 * 카테고리별 중복 제거
 * @param rows 영상 데이터 배열
 * @returns 카테고리별 중복 제거된 데이터
 */
export function dedupeByCategory(rows: VideoItem[]): VideoItem[] {
  const categoryMap = new Map<string, VideoItem[]>();
  
  // 카테고리별로 그룹핑
  for (const row of rows) {
    const category = row.category || '미분류';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(row);
  }
  
  // 각 카테고리별로 중복 제거
  const result: VideoItem[] = [];
  for (const [category, items] of categoryMap.entries()) {
    const deduped = dedupeByVideoDay(items);
    result.push(...deduped);
  }
  
  return result;
}

/**
 * 날짜별 중복 제거
 * @param rows 영상 데이터 배열
 * @param targetDate 대상 날짜 (YYYY-MM-DD)
 * @returns 해당 날짜의 중복 제거된 데이터
 */
export function dedupeByDate(rows: VideoItem[], targetDate: string): VideoItem[] {
  const filtered = rows.filter(row => {
    const dayKey = row.dayKeyLocal || 
                   (row.collectionDate ? new Date(row.collectionDate).toISOString().split('T')[0] : null) ||
                   (row.uploadDate ? new Date(row.uploadDate).toISOString().split('T')[0] : null);
    return dayKey === targetDate;
  });
  
  return dedupeByVideoDay(filtered);
}

/**
 * 통합 중복 제거 (영상별 + 날짜별 + 카테고리별)
 * @param rows 영상 데이터 배열
 * @returns 완전히 중복 제거된 데이터
 */
export function dedupeComprehensive(rows: VideoItem[]): VideoItem[] {
  // 1단계: 영상별 날짜별 중복 제거
  const step1 = dedupeByVideoDay(rows);
  
  // 2단계: 카테고리별 중복 제거
  const step2 = dedupeByCategory(step1);
  
  // 3단계: 최종 정리 (같은 영상이 다른 날짜에 있는 경우 최신 날짜 우선)
  const finalMap = new Map<string, VideoItem>();
  
  for (const row of step2) {
    const key = row.videoId;
    const existing = finalMap.get(key);
    
    if (!existing) {
      finalMap.set(key, row);
    } else {
      // 같은 영상이 여러 날짜에 있는 경우 최신 날짜 우선
      const currentDate = row.dayKeyLocal || 
                         (row.collectionDate ? new Date(row.collectionDate).toISOString().split('T')[0] : null) ||
                         (row.uploadDate ? new Date(row.uploadDate).toISOString().split('T')[0] : null);
      const existingDate = existing.dayKeyLocal || 
                          (existing.collectionDate ? new Date(existing.collectionDate).toISOString().split('T')[0] : null) ||
                          (existing.uploadDate ? new Date(existing.uploadDate).toISOString().split('T')[0] : null);
      
      if (currentDate && existingDate && currentDate > existingDate) {
        finalMap.set(key, row);
      }
    }
  }
  
  return Array.from(finalMap.values());
}
