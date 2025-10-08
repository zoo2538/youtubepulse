// 서버 재조회 후 IndexedDB 덮어쓰기 유틸
import { hybridService } from './hybrid-service';
import { indexedDBService } from './indexeddb-service';

export interface FetchAndHydrateOptions {
  scope?: 'all' | 'classified' | 'unclassified';
  dateRange?: {
    start: string;
    end: string;
  };
  silent?: boolean; // 로그 최소화
}

export interface FetchAndHydrateResult {
  success: boolean;
  count: number;
  source: 'server' | 'local';
  error?: string;
}

/**
 * 서버에서 최신 데이터를 가져와 IndexedDB에 덮어쓰기
 */
export async function fetchAndHydrate(
  options: FetchAndHydrateOptions = {}
): Promise<FetchAndHydrateResult> {
  const { scope = 'all', silent = false } = options;

  try {
    if (!silent) {
      console.log(`🔄 fetchAndHydrate 시작 - scope: ${scope}`);
    }

    let serverData: any[] = [];
    let storeName: string;

    // scope에 따라 데이터 조회
    if (scope === 'classified' || scope === 'all') {
      const classifiedData = await hybridService.getClassifiedData();
      if (classifiedData && classifiedData.length > 0) {
        await indexedDBService.saveClassifiedData(classifiedData);
        serverData = [...serverData, ...classifiedData];
        if (!silent) {
          console.log(`✅ 분류 데이터 ${classifiedData.length}개 서버 동기화 완료`);
        }
      }
    }

    if (scope === 'unclassified' || scope === 'all') {
      const unclassifiedData = await hybridService.loadUnclassifiedData();
      if (unclassifiedData && unclassifiedData.length > 0) {
        await indexedDBService.saveUnclassifiedData(unclassifiedData);
        serverData = [...serverData, ...unclassifiedData];
        if (!silent) {
          console.log(`✅ 미분류 데이터 ${unclassifiedData.length}개 서버 동기화 완료`);
        }
      }
    }

    if (!silent) {
      console.log(`✅ fetchAndHydrate 완료 - 총 ${serverData.length}개 데이터 동기화`);
    }

    return {
      success: true,
      count: serverData.length,
      source: 'server'
    };
  } catch (error) {
    console.error('❌ fetchAndHydrate 실패:', error);

    // 폴백: 로컬 데이터 사용
    try {
      const localData = scope === 'classified'
        ? await indexedDBService.loadClassifiedData()
        : scope === 'unclassified'
        ? await indexedDBService.loadUnclassifiedData()
        : [
            ...(await indexedDBService.loadClassifiedData() || []),
            ...(await indexedDBService.loadUnclassifiedData() || [])
          ];

      if (!silent) {
        console.log(`⚠️ 로컬 데이터로 폴백: ${localData?.length || 0}개`);
      }

      return {
        success: false,
        count: localData?.length || 0,
        source: 'local',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } catch (localError) {
      return {
        success: false,
        count: 0,
        source: 'local',
        error: 'Both server and local fetch failed'
      };
    }
  }
}

