#!/usr/bin/env node

/**
 * YouTube Pulse 운영 진단 도구
 * 장애 시 진단 및 복구를 위한 도구 모음
 */

// Node.js 22+ has native fetch support

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.youthbepulse.com';

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

function logCritical(message) {
  log(`🚨 ${message}`, 'red');
}

// 1. 데이터베이스 연결 진단
async function diagnoseDatabaseConnection() {
  logSection('1. 데이터베이스 연결 진단');
  
  try {
    const response = await fetch(`${API_BASE_URL}/health/db`, { timeout: 10000 });
    
    if (!response.ok) {
      logCritical(`데이터베이스 연결 실패: HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    if (data.status === 'UP') {
      logSuccess('데이터베이스 연결 정상');
      
      if (data.poolStatus) {
        logInfo(`연결 풀 상태:`);
        logInfo(`  - 총 연결: ${data.poolStatus.totalCount}`);
        logInfo(`  - 유휴 연결: ${data.poolStatus.idleCount}`);
        logInfo(`  - 대기 중: ${data.poolStatus.waitingCount}`);
        
        if (data.poolStatus.waitingCount > 5) {
          logCritical(`연결 풀 부족: ${data.poolStatus.waitingCount}개 대기 중`);
          logInfo('해결 방법: 연결 풀 크기 증가 또는 연결 타임아웃 조정');
        }
      }
      
      return true;
    } else {
      logCritical(`데이터베이스 상태: ${data.status}`);
      logError(`메시지: ${data.message}`);
      return false;
    }
  } catch (error) {
    logCritical(`데이터베이스 연결 오류: ${error.message}`);
    return false;
  }
}

// 2. 아웃박스 큐 적체 확인
async function checkOutboxQueue() {
  logSection('2. 아웃박스 큐 적체 확인');
  
  try {
    // 실제로는 브라우저 환경에서만 확인 가능하지만,
    // 서버 로그나 메트릭으로 추정 가능
    logInfo('아웃박스 큐 상태 확인 중...');
    
    // 최근 API 호출 패턴 분석
    const endpoints = ['/api/classified', '/api/auto-collected', '/api/unclassified'];
    let totalRequests = 0;
    let failedRequests = 0;
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { timeout: 5000 });
        totalRequests++;
        if (!response.ok) {
          failedRequests++;
        }
      } catch (error) {
        totalRequests++;
        failedRequests++;
      }
    }
    
    const failureRate = (failedRequests / totalRequests) * 100;
    
    if (failureRate > 20) {
      logCritical(`API 실패율 높음: ${failureRate.toFixed(1)}%`);
      logInfo('아웃박스 큐에 적체된 요청이 많을 가능성');
      logInfo('해결 방법: 네트워크 상태 확인 및 서버 리소스 점검');
    } else if (failureRate > 5) {
      logWarning(`API 실패율 보통: ${failureRate.toFixed(1)}%`);
    } else {
      logSuccess(`API 실패율 정상: ${failureRate.toFixed(1)}%`);
    }
    
    return failureRate < 20;
  } catch (error) {
    logError(`아웃박스 큐 확인 실패: ${error.message}`);
    return false;
  }
}

// 3. 백그라운드 동기화 상태 확인
async function checkBackgroundSync() {
  logSection('3. 백그라운드 동기화 상태 확인');
  
  try {
    logInfo('자동수집 데이터 확인 중...');
    const autoResponse = await fetch(`${API_BASE_URL}/api/auto-collected`, { timeout: 10000 });
    
    if (autoResponse.ok) {
      const autoData = await autoResponse.json();
      if (autoData.success && autoData.data) {
        const autoCount = autoData.data.length;
        logSuccess(`자동수집 데이터: ${autoCount.toLocaleString()}개`);
        
        // 최근 수집 시간 확인
        if (autoCount > 0) {
          const latestItem = autoData.data[0];
          const collectionTime = new Date(latestItem.collectionTimestamp || latestItem.collectedAt);
          const now = new Date();
          const timeDiff = (now - collectionTime) / (1000 * 60); // 분 단위
          
          if (timeDiff > 60) {
            logWarning(`자동수집 지연: 마지막 수집 ${Math.round(timeDiff)}분 전`);
            logInfo('백그라운드 동기화가 지연되었을 가능성');
          } else {
            logSuccess(`자동수집 최신: ${Math.round(timeDiff)}분 전`);
          }
        }
      }
    }
    
    logInfo('분류 데이터 확인 중...');
    const classifiedResponse = await fetch(`${API_BASE_URL}/api/classified`, { timeout: 10000 });
    
    if (classifiedResponse.ok) {
      const classifiedData = await classifiedResponse.json();
      if (classifiedData.success && classifiedData.data) {
        const classifiedCount = classifiedData.data.length;
        logSuccess(`분류 데이터: ${classifiedCount.toLocaleString()}개`);
        
        // 분류 상태별 통계
        const statusStats = {};
        classifiedData.data.forEach(item => {
          const status = item.status || 'unknown';
          statusStats[status] = (statusStats[status] || 0) + 1;
        });
        
        logInfo('분류 상태별 통계:');
        Object.entries(statusStats).forEach(([status, count]) => {
          const percentage = ((count / classifiedData.data.length) * 100).toFixed(1);
          logInfo(`  ${status}: ${count.toLocaleString()}개 (${percentage}%)`);
        });
      }
    }
    
    return true;
  } catch (error) {
    logError(`백그라운드 동기화 확인 실패: ${error.message}`);
    return false;
  }
}

// 4. 캐시 상태 확인
async function checkCacheStatus() {
  logSection('4. 캐시 상태 확인');
  
  try {
    logInfo('프론트엔드 캐시 확인 중...');
    const frontendUrl = 'https://zoo2538.github.io/youtubepulse/';
    
    // 메인 페이지 요청
    const response = await fetch(frontendUrl, { 
      timeout: 10000,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (response.ok) {
      logSuccess('프론트엔드 접근 가능');
      
      // 캐시 헤더 확인
      const cacheControl = response.headers.get('cache-control');
      const etag = response.headers.get('etag');
      
      if (cacheControl) {
        logInfo(`캐시 정책: ${cacheControl}`);
      }
      if (etag) {
        logInfo(`ETag: ${etag}`);
      }
      
      // HTML 내용 확인
      const html = await response.text();
      
      // assets 파일 해시 확인
      const assetMatches = html.match(/\/assets\/[^"]+\.js/g);
      if (assetMatches && assetMatches.length > 0) {
        logSuccess(`정적 자산 파일: ${assetMatches.length}개 확인`);
        assetMatches.slice(0, 3).forEach(asset => {
          logInfo(`  ${asset}`);
        });
      } else {
        logWarning('정적 자산 파일을 찾을 수 없음');
      }
      
      // Service Worker 확인
      if (html.includes('serviceWorker') || html.includes('sw.js')) {
        logWarning('Service Worker가 활성화되어 있음 (비활성 권장)');
      } else {
        logSuccess('Service Worker 비활성 상태 (정상)');
      }
      
    } else {
      logCritical(`프론트엔드 접근 실패: HTTP ${response.status}`);
    }
    
    return response.ok;
  } catch (error) {
    logError(`캐시 상태 확인 실패: ${error.message}`);
    return false;
  }
}

// 5. 시스템 리소스 확인
async function checkSystemResources() {
  logSection('5. 시스템 리소스 확인');
  
  try {
    // API 응답 시간 측정
    const endpoints = [
      '/health/db',
      '/api/auto-collected',
      '/api/classified',
      '/api/unclassified'
    ];
    
    logInfo('API 응답 시간 측정 중...');
    const responseTimes = {};
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { timeout: 15000 });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        responseTimes[endpoint] = responseTime;
        
        if (responseTime > 10000) {
          logWarning(`${endpoint}: ${responseTime}ms (느림)`);
        } else if (responseTime > 5000) {
          logWarning(`${endpoint}: ${responseTime}ms (보통)`);
        } else {
          logSuccess(`${endpoint}: ${responseTime}ms (빠름)`);
        }
      } catch (error) {
        responseTimes[endpoint] = -1;
        logError(`${endpoint}: 타임아웃 또는 오류`);
      }
    }
    
    // 평균 응답 시간 계산
    const validTimes = Object.values(responseTimes).filter(time => time > 0);
    if (validTimes.length > 0) {
      const avgTime = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
      logInfo(`평균 응답 시간: ${avgTime.toFixed(0)}ms`);
      
      if (avgTime > 8000) {
        logCritical('시스템 리소스 부족 또는 네트워크 지연');
        logInfo('해결 방법: 서버 리소스 모니터링 및 스케일링 검토');
      }
    }
    
    return validTimes.length > 0;
  } catch (error) {
    logError(`시스템 리소스 확인 실패: ${error.message}`);
    return false;
  }
}

// 6. 복구 가이드 출력
function printRecoveryGuide() {
  logSection('6. 복구 가이드');
  
  logInfo('🚨 장애 발생 시 다음 순서로 진단하세요:');
  console.log('');
  
  log('1. 데이터베이스 연결 확인', 'yellow');
  log('   curl https://api.youthbepulse.com/health/db', 'blue');
  log('   → 연결 풀 대기 수가 5개 이상이면 서버 리소스 부족', 'blue');
  console.log('');
  
  log('2. 아웃박스 큐 적체 확인', 'yellow');
  log('   브라우저 개발자 도구에서:', 'blue');
  log('   → IndexedDB → YouTubePulseOutbox → outbox 테이블 확인', 'blue');
  log('   → pending 상태 항목이 많으면 네트워크 문제', 'blue');
  console.log('');
  
  log('3. 백그라운드 동기화 수동 트리거', 'yellow');
  log('   브라우저 콘솔에서:', 'blue');
  log('   → window.__debugTriggerBackgroundSync() 실행', 'blue');
  log('   → 5-10분 후 데이터 갱신 확인', 'blue');
  console.log('');
  
  log('4. 캐시 문제 해결', 'yellow');
  log('   → 강제 새로고침: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)', 'blue');
  log('   → 캐시 무효화: ?v=buildHash 파라미터 추가', 'blue');
  log('   → Service Worker 비활성화 상태 유지', 'blue');
  console.log('');
  
  log('5. 긴급 복구 절차', 'yellow');
  log('   → Railway 대시보드에서 서비스 재시작', 'blue');
  log('   → 환경 변수 확인 (DATABASE_URL, VITE_YOUTUBE_API_KEY)', 'blue');
  log('   → 로그 확인: railway logs --service youtubepulse-backend', 'blue');
}

// 전체 진단 실행
async function runDiagnostics() {
  log('🔧 YouTube Pulse 운영 진단 시작', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'blue');
  log(`🕐 시작 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'blue');
  
  const results = {
    database: await diagnoseDatabaseConnection(),
    outbox: await checkOutboxQueue(),
    backgroundSync: await checkBackgroundSync(),
    cache: await checkCacheStatus(),
    systemResources: await checkSystemResources()
  };
  
  // 진단 결과 요약
  logSection('진단 결과 요약');
  
  const totalChecks = Object.keys(results).length;
  const passedChecks = Object.values(results).filter(Boolean).length;
  const passRate = ((passedChecks / totalChecks) * 100).toFixed(1);
  
  Object.entries(results).forEach(([check, passed]) => {
    const status = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${status} ${check}: ${passed ? '정상' : '문제 발견'}`, color);
  });
  
  console.log('');
  log(`📊 전체 진단: ${passedChecks}/${totalChecks} 통과 (${passRate}%)`, 
      passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');
  
  if (passedChecks < totalChecks) {
    printRecoveryGuide();
  } else {
    log('🎉 모든 진단 통과! 시스템이 정상 작동 중입니다.', 'green');
  }
  
  log(`🕐 완료 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'blue');
  
  return passedChecks === totalChecks;
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  runDiagnostics().catch(error => {
    logError(`진단 실행 실패: ${error.message}`);
    process.exit(1);
  });
}

export { runDiagnostics };
