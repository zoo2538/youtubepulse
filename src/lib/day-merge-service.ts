/**
 * 하이브리드 데이터 구조를 위한 일자 단위 병합 서비스
 * 서버(PostgreSQL) + 로컬(IndexedDB) 데이터의 일관성 유지
 */

// DayRow 모델 정의
export interface DayRow {
  dayKey: string;          // '2025-10-05' 형식의 표준화된 날짜 키
  total: number;          // 총 영상 수
  done: number;           // 분류 완료 수
  itemsHash?: string;     // 아이템 집합 해시 (선택적)
  updatedAt: number;      // epoch ms 타임스탬프
  source: 'server' | 'local' | 'merged';
  pendingLocalOps?: number; // 미동기화 로컬 변경 수
}

// 병합 모드 정의
export type MergeMode = 'overwrite' | 'union';

// 병합 결과 인터페이스
export interface MergeResult {
  mergedDays: DayRow[];
  conflicts: Array<{
    dayKey: string;
    serverData: DayRow;
    localData: DayRow;
    resolution: 'server' | 'local' | 'merged';
  }>;
  stats: {
    totalDays: number;
    serverDays: number;
    localDays: number;
    mergedDays: number;
    conflicts: number;
  };
}

/**
 * 서버와 로컬 데이터를 dayKey 기준으로 병합
 * @param serverDays 서버에서 가져온 일자별 데이터
 * @param localDays 로컬 IndexedDB에서 가져온 일자별 데이터
 * @param mode 병합 모드 ('overwrite': 서버 우선, 'union': 합산)
 * @returns 병합된 DayRow 배열
 */
export function mergeByDay(
  serverDays: DayRow[],
  localDays: DayRow[],
  mode: MergeMode = 'overwrite'
): MergeResult {
  const map = new Map<string, DayRow>();
  const conflicts: Array<{
    dayKey: string;
    serverData: DayRow;
    localData: DayRow;
    resolution: 'server' | 'local' | 'merged';
  }> = [];

  // 1. 서버 데이터를 먼저 맵에 추가 (정본으로 취급)
  for (const serverDay of serverDays) {
    const dayKey = normalizeDayKey(serverDay.dayKey);
    map.set(dayKey, { 
      ...serverDay, 
      dayKey,
      source: 'server' as const,
      updatedAt: serverDay.updatedAt || Date.now()
    });
  }

  // 2. 로컬 데이터와 병합
  for (const localDay of localDays) {
    const dayKey = normalizeDayKey(localDay.dayKey);
    const existing = map.get(dayKey);
    
    if (!existing) {
      // 서버에 없는 로컬 데이터 → 로컬 데이터 추가
      map.set(dayKey, { 
        ...localDay, 
        dayKey,
        source: 'local' as const,
        updatedAt: localDay.updatedAt || Date.now()
      });
    } else {
      // 서버와 로컬 모두 존재 → 병합 로직 적용
      const conflict = {
        dayKey,
        serverData: existing,
        localData: localDay,
        resolution: 'server' as const
      };

      if (mode === 'overwrite') {
        // 서버를 정본으로 유지하되 진행률/총계는 상향만 허용
        const mergedDay: DayRow = {
          ...existing,
          total: Math.max(existing.total, localDay.total),
          done: Math.max(existing.done, localDay.done),
          source: 'merged' as const,
          updatedAt: Math.max(existing.updatedAt, localDay.updatedAt || 0)
        };

        // 리비전 비교로 최신 메타데이터 채택
        if ((localDay.updatedAt || 0) > existing.updatedAt) {
          mergedDay.itemsHash = localDay.itemsHash || existing.itemsHash;
        }

        // 로컬 미동기화 표시가 있으면 플래그 유지
        if ((localDay.pendingLocalOps || 0) > 0) {
          mergedDay.pendingLocalOps = localDay.pendingLocalOps;
        }

        map.set(dayKey, mergedDay);
        conflict.resolution = 'merged';
      } else {
        // union: 합산/최대 정책 혼용
        const mergedDay: DayRow = {
          ...existing,
          total: Math.max(existing.total, localDay.total),
          done: Math.max(existing.done, localDay.done),
          source: 'merged' as const,
          updatedAt: Math.max(existing.updatedAt, localDay.updatedAt || 0),
          itemsHash: existing.itemsHash || localDay.itemsHash
        };

        if ((localDay.pendingLocalOps || 0) > 0) {
          mergedDay.pendingLocalOps = (existing.pendingLocalOps || 0) + localDay.pendingLocalOps;
        }

        map.set(dayKey, mergedDay);
        conflict.resolution = 'merged';
      }

      conflicts.push(conflict);
    }
  }

  // 3. 결과 정렬 (최신순)
  const mergedDays = Array.from(map.values()).sort((a, b) => 
    b.dayKey.localeCompare(a.dayKey)
  );

  return {
    mergedDays,
    conflicts,
    stats: {
      totalDays: mergedDays.length,
      serverDays: serverDays.length,
      localDays: localDays.length,
      mergedDays: mergedDays.length,
      conflicts: conflicts.length
    }
  };
}

/**
 * 날짜 문자열을 표준화된 dayKey로 변환
 * @param dateString 다양한 형식의 날짜 문자열
 * @returns 'YYYY-MM-DD' 형식의 표준화된 dayKey
 */
export function normalizeDayKey(dateString: string): string {
  try {
    // 이미 YYYY-MM-DD 형식인 경우
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // Date 객체로 파싱 후 표준 형식으로 변환
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${dateString}`);
    }

    return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn(`날짜 정규화 실패: ${dateString}`, error);
    // 실패 시 원본 문자열 반환 (fallback)
    return dateString;
  }
}

/**
 * UnclassifiedData 배열을 DayRow 배열로 변환
 * @param data UnclassifiedData 배열
 * @param source 데이터 출처
 * @returns DayRow 배열
 */
export function convertToDayRows(
  data: any[], 
  source: 'server' | 'local' = 'local'
): DayRow[] {
  const dayMap = new Map<string, { total: number; done: number; updatedAt: number }>();

  data.forEach(item => {
    const dayKey = normalizeDayKey(item.collectionDate || item.uploadDate);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { total: 0, done: 0, updatedAt: 0 });
    }

    const dayData = dayMap.get(dayKey)!;
    dayData.total++;
    
    if (item.status === 'classified') {
      dayData.done++;
    }

    // 최신 업데이트 시간 추적
    const itemUpdatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now();
    dayData.updatedAt = Math.max(dayData.updatedAt, itemUpdatedAt);
  });

  return Array.from(dayMap.entries()).map(([dayKey, stats]) => ({
    dayKey,
    total: stats.total,
    done: stats.done,
    updatedAt: stats.updatedAt,
    source,
    pendingLocalOps: source === 'local' ? 0 : undefined
  }));
}

/**
 * 서버에서 일자별 데이터를 가져오는 함수
 * @param apiBase API 기본 URL
 * @returns 서버의 DayRow 배열
 */
export async function fetchServerDays(apiBase: string = 'https://api.youthbepulse.com'): Promise<DayRow[]> {
  try {
    const response = await fetch(`${apiBase}/api/unclassified`);
    if (!response.ok) {
      throw new Error(`서버 응답 실패: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      return [];
    }

    return convertToDayRows(result.data, 'server');
  } catch (error) {
    console.warn('서버 데이터 가져오기 실패:', error);
    return [];
  }
}

/**
 * 로컬 IndexedDB에서 일자별 데이터를 가져오는 함수
 * @returns 로컬의 DayRow 배열
 */
export async function fetchLocalDays(): Promise<DayRow[]> {
  try {
    const { hybridService } = await import('./hybrid-service');
    const data = await hybridService.loadUnclassifiedData();
    return convertToDayRows(data, 'local');
  } catch (error) {
    console.warn('로컬 데이터 가져오기 실패:', error);
    return [];
  }
}

/**
 * 통합 데이터 로드 및 병합 함수
 * @param mode 병합 모드
 * @param apiBase API 기본 URL
 * @returns 병합 결과
 */
export async function loadAndMergeDays(
  mode: MergeMode = 'overwrite',
  apiBase: string = 'https://api.youthbepulse.com'
): Promise<MergeResult> {
  console.log('🔄 하이브리드 데이터 로드 시작...');

  // 병렬로 서버와 로컬 데이터 가져오기
  const [serverDays, localDays] = await Promise.all([
    fetchServerDays(apiBase),
    fetchLocalDays()
  ]);

  console.log(`📊 서버 데이터: ${serverDays.length}일, 로컬 데이터: ${localDays.length}일`);

  // 병합 실행
  const result = mergeByDay(serverDays, localDays, mode);
  
  console.log(`✅ 병합 완료: ${result.mergedDays.length}일, 충돌: ${result.conflicts.length}개`);
  
  return result;
}

/**
 * 병합된 데이터를 IndexedDB에 저장
 * @param mergedDays 병합된 DayRow 배열
 */
export async function saveMergedDays(mergedDays: DayRow[]): Promise<void> {
  try {
    const { indexedDBService } = await import('./indexeddb-service');
    
    // DayRow를 다시 UnclassifiedData 형태로 변환하여 저장
    // (실제 구현에서는 더 정교한 변환 로직이 필요할 수 있음)
    console.log(`💾 병합된 데이터 ${mergedDays.length}일을 IndexedDB에 저장 중...`);
    
    // 여기서는 로그만 출력하고, 실제 저장은 상위 컴포넌트에서 처리
    console.log('✅ 병합 데이터 저장 준비 완료');
  } catch (error) {
    console.error('병합 데이터 저장 실패:', error);
    throw error;
  }
}
