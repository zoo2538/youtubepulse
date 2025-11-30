/**
 * 일자별 데이터 병합 및 중복 제거 스크립트
 * 서버 + 로컬 데이터를 dayKey 기준으로 병합
 */

// 동적 import로 TypeScript 파일 로드
let mergeByDay, convertToDayRows, normalizeDayKey;

async function loadDayMergeService() {
  try {
    const module = await import('../src/lib/day-merge-service.ts');
    mergeByDay = module.mergeByDay;
    convertToDayRows = module.convertToDayRows;
    normalizeDayKey = module.normalizeDayKey;
  } catch (error) {
    console.error('❌ day-merge-service 모듈 로드 실패:', error);
    throw new Error('day-merge-service 모듈을 로드할 수 없습니다.');
  }
}

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

// 서버 데이터 가져오기
async function fetchServerData() {
  try {
    console.log('📡 서버 데이터 가져오는 중...');
    const response = await fetch('https://api.youthbepulse.com/api/unclassified');
    
    if (!response.ok) {
      throw new Error(`서버 응답 실패: ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.data) {
      console.log('📡 서버에 데이터 없음');
      return [];
    }
    
    console.log(`📡 서버에서 ${result.data.length}개 데이터 가져옴`);
    return result.data;
  } catch (error) {
    console.warn('⚠️ 서버 데이터 가져오기 실패:', error.message);
    return [];
  }
}

// 로컬 데이터 가져오기 (파일 시스템 사용)
import fs from 'fs';
import path from 'path';

async function fetchLocalData() {
  try {
    console.log('💾 로컬 데이터 가져오는 중...');
    
    // 로컬 데이터 파일 경로 (선택적)
    const localDataPath = path.join(process.cwd(), 'data', 'local-unclassified.json');
    
    if (fs.existsSync(localDataPath)) {
      const fileContent = fs.readFileSync(localDataPath, 'utf-8');
      const localData = JSON.parse(fileContent);
      console.log(`💾 로컬 파일에서 ${localData.length}개 데이터 가져옴`);
      return localData;
    } else {
      console.log('💾 로컬 데이터 파일이 없습니다. 빈 배열 반환.');
      return [];
    }
  } catch (error) {
    console.warn('⚠️ 로컬 데이터 가져오기 실패:', error.message);
    return [];
  }
}

// 병합된 데이터를 서버에 업로드
async function uploadMergedData(mergedDays) {
  try {
    console.log('📤 병합된 데이터 서버 업로드 중...');
    
    // 각 일자별로 서버에 업로드
    for (const dayRow of mergedDays) {
      const response = await fetch('https://api.youthbepulse.com/api/sync/upload-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayKey: dayRow.dayKey,
          total: dayRow.total,
          done: dayRow.done,
          updatedAt: dayRow.updatedAt,
          source: 'merged'
        })
      });
      
      if (!response.ok) {
        console.warn(`⚠️ 일자 ${dayRow.dayKey} 업로드 실패: ${response.status}`);
      } else {
        console.log(`✅ 일자 ${dayRow.dayKey} 업로드 성공`);
      }
    }
    
    console.log('📤 서버 업로드 완료');
  } catch (error) {
    console.error('❌ 서버 업로드 실패:', error.message);
  }
}

// 메인 실행 함수
async function main() {
  try {
    console.log('🔄 일자별 데이터 병합 시작...\n');
    
    // day-merge-service 모듈 로드
    await loadDayMergeService();
    
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
    const mergeResult = mergeByDay(filteredServerDays, filteredLocalDays, options.mode);
    
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
    
    // 6. 서버에 업로드 (선택적)
    if (mergeResult.mergedDays.length > 0) {
      await uploadMergedData(mergeResult.mergedDays);
    }
    
    // 7. 최근 N일 데이터만 표시
    const recentDays = mergeResult.mergedDays
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .slice(0, options.days);
    
    console.log(`\n📅 최근 ${options.days}일 데이터:`);
    recentDays.forEach(day => {
      console.log(`  ${day.dayKey}: ${day.done}/${day.total} (${Math.round((day.done/day.total)*100)}%)`);
    });
    
    console.log('\n✅ 병합 완료!');
    console.log('🎯 이제 웹에서 중복 일자가 제거된 상태를 확인할 수 있습니다.');
    
  } catch (error) {
    console.error('❌ 병합 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
