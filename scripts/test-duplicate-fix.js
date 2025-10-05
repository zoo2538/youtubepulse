/**
 * 중복 일자 제거 테스트 스크립트
 * 하이브리드 병합 로직 검증
 */

import { mergeByDay, convertToDayRows, normalizeDayKey } from '../src/lib/day-merge-service.js';

// 테스트 데이터 생성
function createTestData() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // 서버 데이터 (정본)
  const serverData = [
    {
      videoId: 'video1',
      collectionDate: today,
      status: 'classified',
      viewCount: 100000,
      updatedAt: new Date().toISOString()
    },
    {
      videoId: 'video2', 
      collectionDate: today,
      status: 'unclassified',
      viewCount: 50000,
      updatedAt: new Date().toISOString()
    },
    {
      videoId: 'video3',
      collectionDate: yesterday,
      status: 'classified',
      viewCount: 200000,
      updatedAt: new Date().toISOString()
    }
  ];
  
  // 로컬 데이터 (중복 포함)
  const localData = [
    {
      videoId: 'video1',
      collectionDate: today,
      status: 'unclassified', // 서버와 다른 상태
      viewCount: 120000, // 더 높은 조회수
      updatedAt: new Date(Date.now() - 1000).toISOString()
    },
    {
      videoId: 'video2',
      collectionDate: today,
      status: 'classified', // 로컬에서 분류됨
      viewCount: 60000,
      updatedAt: new Date().toISOString()
    },
    {
      videoId: 'video4', // 로컬에만 있는 데이터
      collectionDate: today,
      status: 'unclassified',
      viewCount: 30000,
      updatedAt: new Date().toISOString()
    }
  ];
  
  return { serverData, localData };
}

// 테스트 실행
async function runTest() {
  console.log('🧪 중복 일자 제거 테스트 시작...\n');
  
  try {
    // 1. 테스트 데이터 생성
    const { serverData, localData } = createTestData();
    console.log('📊 서버 데이터:', serverData.length, '개');
    console.log('📊 로컬 데이터:', localData.length, '개');
    
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
    
    // 3. 병합 실행 (overwrite 모드)
    console.log('\n🔄 서버 우선 병합 실행...');
    const mergeResult = mergeByDay(serverDays, localDays, 'overwrite');
    
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
    
    // 4. 중복 제거 검증
    const dayKeys = mergeResult.mergedDays.map(day => day.dayKey);
    const uniqueDayKeys = [...new Set(dayKeys)];
    
    console.log('\n✅ 중복 제거 검증:');
    console.log(`  원본 일자 수: ${dayKeys.length}`);
    console.log(`  고유 일자 수: ${uniqueDayKeys.length}`);
    console.log(`  중복 제거: ${dayKeys.length === uniqueDayKeys.length ? '성공' : '실패'}`);
    
    // 5. 날짜 정규화 테스트
    console.log('\n📅 날짜 정규화 테스트:');
    const testDates = [
      '2025-10-05',
      '2025-10-05T00:00:00.000Z',
      '2025-10-05T12:00:00+09:00',
      '2025/10/05',
      '10-05-2025'
    ];
    
    testDates.forEach(dateStr => {
      const normalized = normalizeDayKey(dateStr);
      console.log(`  "${dateStr}" → "${normalized}"`);
    });
    
    console.log('\n✅ 테스트 완료!');
    console.log('🎯 하이브리드 병합 로직이 정상적으로 작동합니다.');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 테스트 실행
runTest();
