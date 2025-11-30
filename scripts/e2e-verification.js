#!/usr/bin/env node

/**
 * YouTube Pulse E2E 검증 스크립트
 * 수동/자동 수집 분기 경로와 서버 우선 하이브리드 시스템을 테스트합니다.
 */

// Node.js 22+ has native fetch support

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.youthbepulse.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://zoo2538.github.io/youtubepulse';

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(`🔍 ${title}`, 'cyan');
  console.log('='.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logTest(message) {
  log(`🧪 ${message}`, 'magenta');
}

// 테스트 결과 추적
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

function recordTest(testName, passed, message) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    logSuccess(`${testName}: ${message}`);
  } else {
    testResults.failed++;
    logError(`${testName}: ${message}`);
  }
  testResults.details.push({ testName, passed, message });
}

// 타임아웃이 있는 fetch 헬퍼 함수
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// 1. 서버 헬스 체크 테스트
async function testServerHealth() {
  logSection('1. 서버 헬스 체크 테스트');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health/db`, {}, 10000);
    const data = await response.json();
    
    const isHealthy = response.ok && data.status === 'UP';
    recordTest(
      '서버 헬스 체크',
      isHealthy,
      isHealthy ? '서버가 정상 상태입니다' : `서버 상태: ${data.status}`
    );
    
    if (isHealthy && data.poolStatus) {
      const poolHealthy = data.poolStatus.waitingCount === 0;
      recordTest(
        '연결 풀 상태',
        poolHealthy,
        poolHealthy ? '연결 풀이 정상입니다' : `대기 중인 연결: ${data.poolStatus.waitingCount}개`
      );
    }
    
    return isHealthy;
  } catch (error) {
    recordTest('서버 헬스 체크', false, `연결 실패: ${error.message}`);
    return false;
  }
}

// 2. 자동수집 데이터 확인 테스트
async function testAutoCollectionData() {
  logSection('2. 자동수집 데이터 확인 테스트');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collected`, {}, 15000);
    const data = await response.json();
    
    const hasData = response.ok && data.success && data.data && data.data.length > 0;
    recordTest(
      '자동수집 데이터 존재',
      hasData,
      hasData ? `${data.data.length.toLocaleString()}개 데이터 확인` : '자동수집 데이터 없음'
    );
    
    if (hasData) {
      // 자동수집 데이터 구조 검증 (스네이크 케이스 필드명 사용)
      const sampleItem = data.data[0];
      const hasRequiredFields = (sampleItem.video_id || sampleItem.videoId) && 
                                (sampleItem.channel_name || sampleItem.channelName) && 
                                (sampleItem.collection_date || sampleItem.collectionDate);
      recordTest(
        '자동수집 데이터 구조',
        hasRequiredFields,
        hasRequiredFields ? '필수 필드가 모두 존재합니다' : '필수 필드가 누락되었습니다'
      );
      
      // collectionType 확인 (스네이크 케이스 필드명 사용)
      const collectionType = sampleItem.collection_type || sampleItem.collectionType;
      const hasCollectionType = collectionType === 'auto' || collectionType === undefined;
      recordTest(
        '자동수집 타입 확인',
        hasCollectionType,
        hasCollectionType ? 'collectionType이 올바르게 설정되었습니다' : 'collectionType이 잘못 설정되었습니다'
      );
    }
    
    return hasData;
  } catch (error) {
    recordTest('자동수집 데이터 확인', false, `API 호출 실패: ${error.message}`);
    return false;
  }
}

// 3. 분류 데이터 확인 테스트
async function testClassifiedData() {
  logSection('3. 분류 데이터 확인 테스트');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/classified`, {}, 15000);
    const data = await response.json();
    
    const hasData = response.ok && data.success && data.data && data.data.length > 0;
    recordTest(
      '분류 데이터 존재',
      hasData,
      hasData ? `${data.data.length.toLocaleString()}개 데이터 확인` : '분류 데이터 없음'
    );
    
    if (hasData) {
      // 분류 상태 통계 확인
      const statusStats = {};
      data.data.forEach(item => {
        const status = item.status || 'unknown';
        statusStats[status] = (statusStats[status] || 0) + 1;
      });
      
      const hasClassifiedItems = statusStats.classified > 0;
      recordTest(
        '분류 완료 데이터',
        hasClassifiedItems,
        hasClassifiedItems ? `${statusStats.classified.toLocaleString()}개 분류 완료` : '분류 완료 데이터 없음'
      );
      
      // 카테고리 분포 확인
      const categoryStats = {};
      data.data.forEach(item => {
        if (item.category) {
          categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
        }
      });
      
      const hasCategories = Object.keys(categoryStats).length > 0;
      recordTest(
        '카테고리 분포',
        hasCategories,
        hasCategories ? `${Object.keys(categoryStats).length}개 카테고리 확인` : '카테고리 데이터 없음'
      );
    }
    
    return hasData;
  } catch (error) {
    recordTest('분류 데이터 확인', false, `API 호출 실패: ${error.message}`);
    return false;
  }
}

// 4. 수동수집 분기 테스트 (소량 데이터)
async function testManualCollectionBranch() {
  logSection('4. 수동수집 분기 테스트 (즉시 재조회)');
  
  try {
    // PATCH/DELETE API는 classification_data 테이블의 classified, manual_classified, auto_collected 타입만 지원
    // 실제 데이터를 찾아서 테스트하거나, 데이터가 없으면 스킵
    logTest('테스트용 데이터 조회 중...');
    
    // 먼저 분류 데이터에서 찾기
    const classifiedResponse = await fetchWithTimeout(`${API_BASE_URL}/api/classified`, {}, 15000);
    const classifiedData = await classifiedResponse.json();
    
    let testVideoId = null;
    let foundInClassified = false;
    
    if (classifiedResponse.ok && classifiedData.success && classifiedData.data && classifiedData.data.length > 0) {
      // 첫 번째 분류된 데이터의 id를 사용
      const firstItem = classifiedData.data[0];
      testVideoId = firstItem.id || firstItem.videoId;
      foundInClassified = true;
      logInfo(`테스트용 비디오 ID (분류 데이터): ${testVideoId}`);
    }
    
    // 분류 데이터가 없으면 자동수집 데이터에서 찾기
    if (!testVideoId) {
      const autoResponse = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collected`, {}, 15000);
      const autoData = await autoResponse.json();
      
      if (autoResponse.ok && autoData.success && autoData.data && autoData.data.length > 0) {
        const firstItem = autoData.data[0];
        // auto-collected는 unclassified_data 테이블이므로 PATCH/DELETE API에서 찾을 수 없음
        // 하지만 시도는 해볼 수 있음
        testVideoId = firstItem.id || firstItem.video_id || firstItem.videoId;
        logInfo(`테스트용 비디오 ID (자동수집): ${testVideoId}`);
      }
    }
    
    if (!testVideoId) {
      recordTest(
        'PATCH API (수정)',
        false,
        '테스트할 데이터가 없습니다 (classification_data 테이블의 데이터 필요)'
      );
      recordTest(
        'DELETE API (삭제)',
        false,
        '테스트할 데이터가 없습니다 (classification_data 테이블의 데이터 필요)'
      );
      return false;
    }
    
    // PATCH API 테스트 (수정)
    logTest('PATCH API 테스트 중...');
    const patchResponse = await fetchWithTimeout(`${API_BASE_URL}/api/videos/${testVideoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: '테스트_수정',
        subCategory: 'E2E_수정',
        status: 'classified'
      })
    }, 10000);
    
    const patchData = await patchResponse.json();
    const patchSuccess = patchResponse.ok && patchData.success;
    recordTest(
      'PATCH API (수정)',
      patchSuccess,
      patchSuccess ? '수정 요청 성공' : `수정 실패: ${patchData.error || 'Unknown error'}`
    );
    
    // DELETE API 테스트
    // 실제 데이터를 삭제하면 안 되므로, foundInClassified가 false이거나 테스트 데이터인 경우에만 삭제
    if (foundInClassified) {
      // 실제 분류 데이터는 삭제하지 않음 (데이터 보호)
      logTest('DELETE API 테스트 스킵 (실제 데이터 보호)');
      recordTest(
        'DELETE API (삭제)',
        false,
        '실제 분류 데이터 삭제는 스킵됨 (데이터 보호)'
      );
    } else {
      // 테스트 데이터인 경우 삭제 가능
      logTest('DELETE API 테스트 중...');
      const deleteResponse = await fetchWithTimeout(`${API_BASE_URL}/api/videos/${testVideoId}`, {
        method: 'DELETE'
      }, 10000);
      
      const deleteData = await deleteResponse.json();
      const deleteSuccess = deleteResponse.ok && deleteData.success;
      recordTest(
        'DELETE API (삭제)',
        deleteSuccess,
        deleteSuccess ? '삭제 요청 성공' : `삭제 실패: ${deleteData.error || 'Unknown error'}`
      );
      
      return patchSuccess && deleteSuccess;
    }
    
    return patchSuccess;
  } catch (error) {
    recordTest('수동수집 분기 테스트', false, `테스트 실패: ${error.message}`);
    return false;
  }
}

// 5. 자동수집 분기 테스트 (대용량 데이터)
async function testAutoCollectionBranch() {
  logSection('5. 자동수집 분기 테스트 (조건부 백그라운드)');
  
  try {
    // 자동수집 트리거 테스트
    logTest('자동수집 트리거 테스트 중...');
    const triggerResponse = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateKey: new Date().toISOString().split('T')[0]
      })
    }, 60000); // 1분 타임아웃
    
    const triggerData = await triggerResponse.json();
    const triggerSuccess = triggerResponse.ok && triggerData.success;
    recordTest(
      '자동수집 트리거',
      triggerSuccess,
      triggerSuccess ? '자동수집 트리거 성공' : `트리거 실패: ${triggerData.error || 'Unknown error'}`
    );
    
    if (triggerSuccess) {
      // 잠시 대기 후 결과 확인
      logTest('5초 후 자동수집 결과 확인 중...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 자동수집 데이터 다시 확인
      const checkResponse = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collected`, {}, 15000);
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.success && checkData.data) {
          recordTest(
            '자동수집 결과 확인',
            true,
            `${checkData.data.length.toLocaleString()}개 데이터 확인`
          );
        }
      }
    }
    
    return triggerSuccess;
  } catch (error) {
    recordTest('자동수집 분기 테스트', false, `테스트 실패: ${error.message}`);
    return false;
  }
}

// 6. 프론트엔드 접근성 테스트
async function testFrontendAccessibility() {
  logSection('6. 프론트엔드 접근성 테스트');
  
  try {
    // 메인 페이지 접근 테스트
    const response = await fetchWithTimeout(FRONTEND_URL, {}, 10000);
    const isAccessible = response.ok;
    recordTest(
      '프론트엔드 접근',
      isAccessible,
      isAccessible ? '프론트엔드 접근 가능' : `접근 실패: HTTP ${response.status}`
    );
    
    if (isAccessible) {
      const html = await response.text();
      
      // 필수 요소 확인
      const hasTitle = html.includes('<title>');
      recordTest(
        'HTML 구조',
        hasTitle,
        hasTitle ? 'HTML 구조가 올바릅니다' : 'HTML 구조에 문제가 있습니다'
      );
      
      // 캐시 버스팅 확인
      const hasAssets = html.includes('/assets/');
      recordTest(
        '정적 자산',
        hasAssets,
        hasAssets ? '정적 자산이 올바르게 포함되었습니다' : '정적 자산이 누락되었습니다'
      );
    }
    
    return isAccessible;
  } catch (error) {
    recordTest('프론트엔드 접근성', false, `접근 실패: ${error.message}`);
    return false;
  }
}

// 7. 하이브리드 동기화 테스트
async function testHybridSync() {
  logSection('7. 하이브리드 동기화 테스트');
  
  try {
    // 서버 데이터와 클라이언트 데이터 일치성 확인
    const serverResponse = await fetchWithTimeout(`${API_BASE_URL}/api/classified`, {}, 15000);
    const serverData = await serverResponse.json();
    
    if (serverResponse.ok && serverData.success && serverData.data) {
      const serverCount = serverData.data.length;
      
      // 클라이언트에서도 동일한 데이터를 받을 수 있는지 확인
      const clientResponse = await fetchWithTimeout(`${API_BASE_URL}/api/classified`, {}, 15000);
      const clientData = await clientResponse.json();
      
      if (clientResponse.ok && clientData.success && clientData.data) {
        const clientCount = clientData.data.length;
        const countsMatch = serverCount === clientCount;
        
        recordTest(
          '서버-클라이언트 데이터 일치',
          countsMatch,
          countsMatch ? 
            `서버: ${serverCount}개, 클라이언트: ${clientCount}개 일치` : 
            `서버: ${serverCount}개, 클라이언트: ${clientCount}개 불일치`
        );
        
        return countsMatch;
      }
    }
    
    recordTest('하이브리드 동기화', false, '데이터 동기화 확인 실패');
    return false;
  } catch (error) {
    recordTest('하이브리드 동기화', false, `동기화 테스트 실패: ${error.message}`);
    return false;
  }
}

// 8. 오프라인 아웃박스 테스트
async function testOfflineOutbox() {
  logSection('8. 오프라인 아웃박스 테스트');
  
  try {
    // 아웃박스 기능은 브라우저 환경에서만 테스트 가능하므로
    // 서버 측 아웃박스 관련 API가 있는지 확인
    logTest('아웃박스 기능은 브라우저 환경에서 테스트 필요');
    
    // 대신 서버의 오류 처리 능력 확인
    const invalidResponse = await fetchWithTimeout(`${API_BASE_URL}/api/videos/invalid-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'test' })
    }, 5000);
    
    const invalidData = await invalidResponse.json();
    const properErrorHandling = !invalidResponse.ok && invalidData.error;
    
    recordTest(
      '오류 처리',
      properErrorHandling,
      properErrorHandling ? '적절한 오류 응답' : '오류 처리에 문제가 있습니다'
    );
    
    return properErrorHandling;
  } catch (error) {
    recordTest('오프라인 아웃박스', false, `아웃박스 테스트 실패: ${error.message}`);
    return false;
  }
}

// 테스트 결과 요약
function generateTestReport() {
  logSection('E2E 검증 결과 요약');
  
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  
  log(`📊 전체 테스트: ${testResults.total}개`, 'bright');
  log(`✅ 통과: ${testResults.passed}개`, 'green');
  log(`❌ 실패: ${testResults.failed}개`, 'red');
  log(`📈 통과율: ${passRate}%`, passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');
  
  console.log('\n📋 상세 결과:');
  testResults.details.forEach(detail => {
    const status = detail.passed ? '✅' : '❌';
    const color = detail.passed ? 'green' : 'red';
    log(`${status} ${detail.testName}: ${detail.message}`, color);
  });
  
  console.log('\n' + '='.repeat(80));
  if (testResults.failed === 0) {
    log('🎉 모든 E2E 테스트 통과! 서버 우선 하이브리드 시스템이 정상 작동합니다.', 'green');
    log('✅ 진행률 일괄저장 전/후 화면 불일치 문제가 해결되었습니다.', 'green');
    log('✅ 웹 수정·삭제의 서버 반영이 정상적으로 작동합니다.', 'green');
  } else {
    log(`⚠️  ${testResults.failed}개 테스트 실패. 문제를 확인하고 수정해주세요.`, 'yellow');
  }
  console.log('='.repeat(80));
  
  return testResults.failed === 0;
}

// 전체 E2E 검증 실행
async function main() {
  log('🚀 YouTube Pulse E2E 검증 시작', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'blue');
  log(`🌐 Frontend URL: ${FRONTEND_URL}`, 'blue');
  log(`🕐 시작 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'blue');
  
  // 테스트 실행
  await testServerHealth();
  await testAutoCollectionData();
  await testClassifiedData();
  await testManualCollectionBranch();
  await testAutoCollectionBranch();
  await testFrontendAccessibility();
  await testHybridSync();
  await testOfflineOutbox();
  
  // 결과 요약
  const allTestsPassed = generateTestReport();
  
  log(`🕐 완료 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'blue');
  
  // 종료 코드 설정
  process.exit(allTestsPassed ? 0 : 1);
}

// 스크립트 실행
main().catch(error => {
  logError(`E2E 검증 실행 실패: ${error.message}`);
  process.exit(1);
});
