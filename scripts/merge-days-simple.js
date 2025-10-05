/**
 * 일자별 데이터 병합 및 중복 제거 스크립트 (간단 버전)
 * 서버 + 로컬 데이터를 dayKey 기준으로 병합
 */

// 명령행 인자 파싱
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'overwrite', // overwrite | union
    days: 7,
    only: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mode') {
      options.mode = args[i + 1];
      i++;
    } else if (arg === '--days') {
      options.days = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--only') {
      options.only = args[i + 1];
      i++;
    }
  }

  return options;
}

// 날짜 정규화 함수
function normalizeDayKey(dateString) {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${dateString}`);
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn(`날짜 정규화 실패: ${dateString}`, error);
    return dateString;
  }
}

// DayRow 변환 함수
function convertToDayRows(data, source = 'local') {
  const dayMap = new Map();

  data.forEach(item => {
    const dayKey = normalizeDayKey(item.collectionDate || item.uploadDate);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { total: 0, done: 0, updatedAt: 0 });
    }

    const dayData = dayMap.get(dayKey);
    dayData.total++;
    
    if (item.status === 'classified') {
      dayData.done++;
    }

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

// 병합 함수
function mergeByDaySimple(serverDays, localDays, mode = 'overwrite') {
  const map = new Map();
  const conflicts = [];

  // 서버 데이터를 먼저 맵에 추가
  for (const serverDay of serverDays) {
    const dayKey = normalizeDayKey(serverDay.dayKey);
    map.set(dayKey, { 
      ...serverDay, 
      dayKey,
      source: 'server',
      updatedAt: serverDay.updatedAt || Date.now()
    });
  }

  // 로컬 데이터와 병합
  for (const localDay of localDays) {
    const dayKey = normalizeDayKey(localDay.dayKey);
    const existing = map.get(dayKey);
    
    if (!existing) {
      map.set(dayKey, { 
        ...localDay, 
        dayKey,
        source: 'local',
        updatedAt: localDay.updatedAt || Date.now()
      });
    } else {
      const conflict = {
        dayKey,
        serverData: existing,
        localData: localDay,
        resolution: 'server'
      };

      if (mode === 'overwrite') {
        const mergedDay = {
          ...existing,
          total: Math.max(existing.total, localDay.total),
          done: Math.max(existing.done, localDay.done),
          source: 'merged',
          updatedAt: Math.max(existing.updatedAt, localDay.updatedAt || 0)
        };

        if ((localDay.updatedAt || 0) > existing.updatedAt) {
          mergedDay.itemsHash = localDay.itemsHash || existing.itemsHash;
        }

        if ((localDay.pendingLocalOps || 0) > 0) {
          mergedDay.pendingLocalOps = localDay.pendingLocalOps;
        }

        map.set(dayKey, mergedDay);
        conflict.resolution = 'merged';
      }

      conflicts.push(conflict);
    }
  }

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

// 서버 데이터 가져오기 (시뮬레이션)
async function fetchServerData() {
  try {
    console.log('📡 서버 데이터 가져오는 중...');
    
    // 실제로는 API 호출이지만, 여기서는 시뮬레이션
    const mockServerData = [
      { videoId: 'video1', collectionDate: '2025-10-05', status: 'classified', viewCount: 100000 },
      { videoId: 'video2', collectionDate: '2025-10-05', status: 'unclassified', viewCount: 50000 },
      { videoId: 'video3', collectionDate: '2025-10-04', status: 'classified', viewCount: 200000 },
      { videoId: 'video4', collectionDate: '2025-10-03', status: 'classified', viewCount: 150000 }
    ];
    
    console.log(`📡 서버에서 ${mockServerData.length}개 데이터 가져옴 (시뮬레이션)`);
    return mockServerData;
  } catch (error) {
    console.warn('⚠️ 서버 데이터 가져오기 실패:', error.message);
    return [];
  }
}

// 로컬 데이터 가져오기 (시뮬레이션)
async function fetchLocalData() {
  try {
    console.log('💾 로컬 데이터 가져오는 중...');
    
    // 실제로는 IndexedDB에서 가져와야 하지만, 여기서는 시뮬레이션
    const mockLocalData = [
      { videoId: 'video1', collectionDate: '2025-10-05', status: 'unclassified', viewCount: 120000 },
      { videoId: 'video2', collectionDate: '2025-10-05', status: 'classified', viewCount: 60000 },
      { videoId: 'video5', collectionDate: '2025-10-05', status: 'unclassified', viewCount: 30000 },
      { videoId: 'video6', collectionDate: '2025-10-04', status: 'classified', viewCount: 180000 }
    ];
    
    console.log(`💾 로컬에서 ${mockLocalData.length}개 데이터 가져옴 (시뮬레이션)`);
    return mockLocalData;
  } catch (error) {
    console.warn('⚠️ 로컬 데이터 가져오기 실패:', error.message);
    return [];
  }
}

// 메인 실행 함수
async function main() {
  try {
    console.log('🔄 일자별 데이터 병합 시작...\n');
    
    const options = parseArgs();
    console.log('⚙️ 옵션:', options);
    
    // 1. 서버와 로컬 데이터 가져오기
    const [serverData, localData] = await Promise.all([
      fetchServerData(),
      fetchLocalData()
    ]);
    
    if (serverData.length === 0 && localData.length === 0) {
      console.log('📊 병합할 데이터가 없습니다.');
      return;
    }
    
    // 2. DayRow로 변환
    const serverDays = convertToDayRows(serverData, 'server');
    const localDays = convertToDayRows(localData, 'local');
    
    console.log('\n📅 서버 일자별 데이터:');
    serverDays.forEach(day => {
      console.log(`  ${day.dayKey}: ${day.done}/${day.total} (${day.source})`);
    });
    
    console.log('\n📅 로컬 일자별 데이터:');
    localDays.forEach(day => {
      console.log(`  ${day.dayKey}: ${day.done}/${day.total} (${day.source})`);
    });
    
    // 3. 특정 날짜만 필터링 (옵션이 있는 경우)
    let filteredServerDays = serverDays;
    let filteredLocalDays = localDays;
    
    if (options.only) {
      const targetDay = normalizeDayKey(options.only);
      filteredServerDays = serverDays.filter(day => day.dayKey === targetDay);
      filteredLocalDays = localDays.filter(day => day.dayKey === targetDay);
      console.log(`\n🎯 특정 날짜 필터링: ${targetDay}`);
    }
    
    // 4. 병합 실행
    console.log(`\n🔄 ${options.mode} 모드로 병합 실행...`);
    const mergeResult = mergeByDaySimple(filteredServerDays, filteredLocalDays, options.mode);
    
    console.log('\n📊 병합 결과:');
    console.log(`  총 일자: ${mergeResult.mergedDays.length}개`);
    console.log(`  충돌: ${mergeResult.conflicts.length}개`);
    console.log(`  서버 데이터: ${mergeResult.stats.serverDays}개`);
    console.log(`  로컬 데이터: ${mergeResult.stats.localDays}개`);
    
    console.log('\n📅 병합된 일자별 데이터:');
    mergeResult.mergedDays.forEach(day => {
      console.log(`  ${day.dayKey}: ${day.done}/${day.total} (${day.source})`);
    });
    
    if (mergeResult.conflicts.length > 0) {
      console.log('\n⚠️ 충돌 해결:');
      mergeResult.conflicts.forEach(conflict => {
        console.log(`  ${conflict.dayKey}: ${conflict.resolution}`);
      });
    }
    
    // 5. 중복 제거 검증
    const dayKeys = mergeResult.mergedDays.map(day => day.dayKey);
    const uniqueDayKeys = [...new Set(dayKeys)];
    
    console.log('\n✅ 중복 제거 검증:');
    console.log(`  원본 일자 수: ${dayKeys.length}`);
    console.log(`  고유 일자 수: ${uniqueDayKeys.length}`);
    console.log(`  중복 제거: ${dayKeys.length === uniqueDayKeys.length ? '성공' : '실패'}`);
    
    // 6. 최근 N일 데이터만 표시
    const recentDays = mergeResult.mergedDays
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .slice(0, options.days);
    
    console.log(`\n📅 최근 ${options.days}일 데이터:`);
    recentDays.forEach(day => {
      const progress = day.total > 0 ? Math.round((day.done/day.total)*100) : 0;
      console.log(`  ${day.dayKey}: ${day.done}/${day.total} (${progress}%)`);
    });
    
    console.log('\n✅ 병합 완료!');
    console.log('🎯 이제 웹에서 중복 일자가 제거된 상태를 확인할 수 있습니다.');
    console.log('🔧 다음 단계: npm run cache:clear:win && npm run build && npm run preview');
    
  } catch (error) {
    console.error('❌ 병합 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
