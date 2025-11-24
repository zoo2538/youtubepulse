#!/usr/bin/env node

/**
 * YouTube Pulse 헬스 체크 스크립트
 * Railway 배포 후 데이터베이스 연결 및 자동수집 상태를 점검합니다.
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
  console.log('\n' + '='.repeat(60));
  log(`🔍 ${title}`, 'cyan');
  console.log('='.repeat(60));
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

async function checkHealthEndpoint(retries = 3) {
  logSection('데이터베이스 헬스 체크');
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        logInfo(`재시도 ${attempt}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 지수 백오프
      }
      
      const response = await fetchWithTimeout(`${API_BASE_URL}/health/db`, {}, 15000);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'UP') {
        logSuccess('데이터베이스 연결 정상');
        logInfo(`서비스: ${data.service}`);
        logInfo(`메시지: ${data.message}`);
        
        if (data.poolStatus) {
          logInfo(`연결 풀 상태:`);
          logInfo(`  - 총 연결: ${data.poolStatus.totalCount}`);
          logInfo(`  - 유휴 연결: ${data.poolStatus.idleCount}`);
          logInfo(`  - 대기 중: ${data.poolStatus.waitingCount}`);
          
          // 대기 중인 연결이 있으면 경고
          if (data.poolStatus.waitingCount > 0) {
            logWarning(`대기 중인 연결이 ${data.poolStatus.waitingCount}개 있습니다`);
          }
        }
        
        if (data.queryResult) {
          logInfo(`쿼리 테스트: ${data.queryResult.health_check}`);
          logInfo(`현재 시간: ${data.queryResult.current_time}`);
        }
        
        return true;
      } else {
        logError(`데이터베이스 상태: ${data.status}`);
        logError(`메시지: ${data.message}`);
        if (attempt < retries) continue;
        return false;
      }
    } catch (error) {
      logError(`헬스 체크 실패 (시도 ${attempt}/${retries}): ${error.message}`);
      if (attempt < retries) continue;
      return false;
    }
  }
  
  return false;
}

async function checkAutoCollectionData() {
  logSection('자동수집 데이터 확인');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collected`, {}, 10000);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      const count = data.data.length;
      logSuccess(`자동수집 데이터: ${count.toLocaleString()}개`);
      
      if (count > 0) {
        // 최근 수집 데이터 분석
        const recentData = data.data.slice(0, 5);
        logInfo('최근 수집 데이터 샘플:');
        recentData.forEach((item, index) => {
          logInfo(`  ${index + 1}. ${item.videoTitle?.substring(0, 50)}...`);
          logInfo(`     채널: ${item.channelName}`);
          logInfo(`     조회수: ${item.viewCount?.toLocaleString()}회`);
          logInfo(`     수집일: ${item.collectionDate}`);
        });
        
        // 날짜별 분포 확인
        const dateDistribution = {};
        data.data.forEach(item => {
          const date = item.collectionDate?.split('T')[0] || 'unknown';
          dateDistribution[date] = (dateDistribution[date] || 0) + 1;
        });
        
        logInfo('날짜별 수집 분포:');
        Object.entries(dateDistribution)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 7)
          .forEach(([date, count]) => {
            logInfo(`  ${date}: ${count}개`);
          });
      } else {
        logWarning('자동수집 데이터가 없습니다 (정상일 수 있음)');
      }
      
      return true;
    } else {
      logWarning('자동수집 데이터 없음 또는 API 응답 오류');
      // 데이터가 없어도 API가 정상 응답했다면 성공으로 간주
      return data.success !== false;
    }
  } catch (error) {
    logError(`자동수집 데이터 확인 실패: ${error.message}`);
    // 네트워크 오류 등은 실패로 처리하되, 전체 프로세스를 중단하지 않음
    return false;
  }
}

async function checkClassifiedData() {
  logSection('분류 데이터 확인');
  
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/classified`, {}, 10000);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      const count = data.data.length;
      logSuccess(`분류 데이터: ${count.toLocaleString()}개`);
      
      if (count > 0) {
        // 분류 상태별 통계
        const statusStats = {};
        const categoryStats = {};
        
        data.data.forEach(item => {
          const status = item.status || 'unknown';
          const category = item.category || 'uncategorized';
          
          statusStats[status] = (statusStats[status] || 0) + 1;
          categoryStats[category] = (categoryStats[category] || 0) + 1;
        });
        
        logInfo('분류 상태별 통계:');
        Object.entries(statusStats).forEach(([status, count]) => {
          const percentage = ((count / data.data.length) * 100).toFixed(1);
          logInfo(`  ${status}: ${count.toLocaleString()}개 (${percentage}%)`);
        });
        
        logInfo('상위 카테고리별 통계:');
        Object.entries(categoryStats)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .forEach(([category, count]) => {
            logInfo(`  ${category}: ${count.toLocaleString()}개`);
          });
      } else {
        logWarning('분류 데이터가 없습니다 (정상일 수 있음)');
      }
      
      return true;
    } else {
      logWarning('분류 데이터 없음 또는 API 응답 오류');
      // 데이터가 없어도 API가 정상 응답했다면 성공으로 간주
      return data.success !== false;
    }
  } catch (error) {
    logError(`분류 데이터 확인 실패: ${error.message}`);
    // 네트워크 오류 등은 실패로 처리하되, 전체 프로세스를 중단하지 않음
    return false;
  }
}

async function testAutoCollectionTrigger() {
  logSection('자동수집 트리거 테스트');
  
  try {
    logInfo('자동수집 API 호출 중...');
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dateKey: new Date().toISOString().split('T')[0]
      })
    }, 60000); // 1분 타임아웃 (자동수집은 시간이 걸림)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      logSuccess('자동수집 트리거 성공');
      logInfo(`메시지: ${data.message}`);
      
      // 잠시 대기 후 결과 확인
      logInfo('2초 후 자동수집 결과 확인 중...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 자동수집 데이터 다시 확인
      const checkResponse = await fetchWithTimeout(`${API_BASE_URL}/api/auto-collected`, {}, 5000);
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.success && checkData.data) {
          logSuccess(`자동수집 후 데이터: ${checkData.data.length.toLocaleString()}개`);
        }
      }
      
      return true;
    } else {
      logError(`자동수집 트리거 실패: ${data.error}`);
      return false;
    }
  } catch (error) {
    logError(`자동수집 트리거 테스트 실패: ${error.message}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  logSection('환경 변수 확인');
  
  const requiredEnvs = [
    'DATABASE_URL',
    'NODE_ENV',
    'PORT'
  ];
  
  const optionalEnvs = [
    'RAILWAY_ENVIRONMENT',
    'RAILWAY_SERVICE_NAME',
    'RAILWAY_PROJECT_ID'
  ];
  
  logInfo('필수 환경 변수:');
  requiredEnvs.forEach(env => {
    if (process.env[env]) {
      const value = env.includes('KEY') || env.includes('URL') 
        ? `${process.env[env].substring(0, 10)}...` 
        : process.env[env];
      logSuccess(`${env}: ${value}`);
    } else {
      logError(`${env}: 설정되지 않음`);
    }
  });
  
  logInfo('선택적 환경 변수:');
  optionalEnvs.forEach(env => {
    if (process.env[env]) {
      logSuccess(`${env}: ${process.env[env]}`);
    } else {
      logWarning(`${env}: 설정되지 않음`);
    }
  });
  
  return true;
}

async function generateHealthReport() {
  logSection('헬스 체크 보고서 생성');
  
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    apiBaseUrl: API_BASE_URL,
    environment: process.env.NODE_ENV || 'unknown',
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT || 'local',
    checks: {
      database: false,
      autoCollection: false,
      classifiedData: false,
      autoCollectionTrigger: false,
      environmentVariables: false
    }
  };
  
  return report;
}

async function main() {
  log('🚀 YouTube Pulse 헬스 체크 시작', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'blue');
  log(`🕐 시작 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'blue');
  
  const report = await generateHealthReport();
  
  // 1. 환경 변수 확인
  report.checks.environmentVariables = await checkEnvironmentVariables();
  
  // 2. 데이터베이스 헬스 체크
  report.checks.database = await checkHealthEndpoint();
  
  // 3. 자동수집 데이터 확인 (병렬 처리)
  if (report.checks.database) {
    logInfo('병렬로 데이터 확인 중...');
    const [autoCollectionResult, classifiedDataResult] = await Promise.all([
      checkAutoCollectionData(),
      checkClassifiedData()
    ]);
    
    report.checks.autoCollection = autoCollectionResult;
    report.checks.classifiedData = classifiedDataResult;
    
    // 4. 자동수집 트리거 테스트 (선택적)
    const shouldTestTrigger = process.argv.includes('--test-auto-collect');
    if (shouldTestTrigger) {
      logInfo('자동수집 트리거 테스트 활성화됨');
      report.checks.autoCollectionTrigger = await testAutoCollectionTrigger();
    } else {
      logInfo('자동수집 트리거 테스트 생략 (--test-auto-collect 플래그로 활성화 가능)');
    }
  }
  
  // 최종 결과
  logSection('헬스 체크 결과 요약');
  
  const allChecks = Object.entries(report.checks);
  const passedChecks = allChecks.filter(([, passed]) => passed).length;
  const totalChecks = allChecks.length;
  
  // 필수 체크와 선택적 체크 구분
  const criticalChecks = ['database', 'environmentVariables'];
  const optionalChecks = ['autoCollection', 'classifiedData', 'autoCollectionTrigger'];
  
  const criticalPassed = allChecks
    .filter(([check]) => criticalChecks.includes(check))
    .filter(([, passed]) => passed).length;
  const criticalTotal = criticalChecks.length;
  
  allChecks.forEach(([check, passed]) => {
    const isCritical = criticalChecks.includes(check);
    if (passed) {
      logSuccess(`${check}: 통과${isCritical ? ' (필수)' : ' (선택)'}`);
    } else {
      if (isCritical) {
        logError(`${check}: 실패 (필수)`);
      } else {
        logWarning(`${check}: 실패 (선택)`);
      }
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  // 필수 체크가 모두 통과했는지 확인
  if (criticalPassed === criticalTotal) {
    if (passedChecks === totalChecks) {
      log(`🎉 모든 헬스 체크 통과! (${passedChecks}/${totalChecks})`, 'green');
      log('✅ 시스템이 정상적으로 운영 중입니다.', 'green');
    } else {
      log(`✅ 필수 헬스 체크 통과! (${criticalPassed}/${criticalTotal})`, 'green');
      log(`⚠️  일부 선택적 체크 실패 (${passedChecks}/${totalChecks})`, 'yellow');
      log('ℹ️  시스템은 정상 작동 중이지만 일부 기능을 확인할 수 없습니다.', 'blue');
    }
  } else {
    log(`❌ 필수 헬스 체크 실패 (${criticalPassed}/${criticalTotal})`, 'red');
    log(`⚠️  전체 체크 결과 (${passedChecks}/${totalChecks})`, 'yellow');
    log('🔧 문제를 확인하고 수정해주세요.', 'yellow');
  }
  console.log('='.repeat(60));
  
  log(`🕐 완료 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'blue');
  
  // 종료 코드 설정: 필수 체크가 모두 통과하면 성공
  const exitCode = criticalPassed === criticalTotal ? 0 : 1;
  process.exit(exitCode);
}

// 스크립트 실행
main().catch(error => {
  logError(`헬스 체크 실행 실패: ${error.message}`);
  process.exit(1);
});
