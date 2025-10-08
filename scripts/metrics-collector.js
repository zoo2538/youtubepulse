#!/usr/bin/env node

/**
 * YouTube Pulse 운영 메트릭 수집기
 * 백로그 적용 시점 결정을 위한 성능 데이터 수집
 */

// Node.js 22+ has native fetch support
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.youthbepulse.com';
const LOG_DIR = 'logs/metrics';

// 메트릭 데이터 구조
const metrics = {
  timestamp: new Date().toISOString(),
  system: {
    database: {},
    api: {},
    sync: {},
    performance: {}
  }
};

// 로그 디렉토리 생성
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 1. 데이터베이스 성능 메트릭
async function collectDatabaseMetrics() {
  log('📊 데이터베이스 성능 메트릭 수집 중...', 'blue');
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${API_BASE_URL}/health/db`, { timeout: 10000 });
    const endTime = Date.now();
    
    metrics.system.database = {
      responseTime: endTime - startTime,
      status: response.ok ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString()
    };
    
    if (response.ok) {
      const data = await response.json();
      metrics.system.database.poolStatus = data.poolStatus;
      metrics.system.database.queryResult = data.queryResult;
    }
    
    log(`✅ 데이터베이스 메트릭 수집 완료 (${metrics.system.database.responseTime}ms)`, 'green');
  } catch (error) {
    log(`❌ 데이터베이스 메트릭 수집 실패: ${error.message}`, 'red');
    metrics.system.database.error = error.message;
  }
}

// 2. API 성능 메트릭
async function collectApiMetrics() {
  log('📊 API 성능 메트릭 수집 중...', 'blue');
  
  const endpoints = [
    '/api/auto-collected',
    '/api/classified',
    '/api/unclassified',
    '/api/channels'
  ];
  
  metrics.system.api = {};
  
  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, { timeout: 15000 });
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      const data = await response.json();
      
      metrics.system.api[endpoint] = {
        responseTime,
        status: response.status,
        success: response.ok,
        dataSize: data.data ? data.data.length : 0,
        timestamp: new Date().toISOString()
      };
      
      log(`  ✅ ${endpoint}: ${responseTime}ms (${data.data?.length || 0}개)`, 'green');
    } catch (error) {
      log(`  ❌ ${endpoint}: ${error.message}`, 'red');
      metrics.system.api[endpoint] = {
        error: error.message,
        responseTime: -1,
        status: 'ERROR',
        success: false,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 3. 동기화 성능 메트릭
async function collectSyncMetrics() {
  log('📊 동기화 성능 메트릭 수집 중...', 'blue');
  
  try {
    // 자동수집 데이터 현황
    const autoResponse = await fetch(`${API_BASE_URL}/api/auto-collected`, { timeout: 10000 });
    const autoData = await autoResponse.json();
    
    // 분류 데이터 현황
    const classifiedResponse = await fetch(`${API_BASE_URL}/api/classified`, { timeout: 10000 });
    const classifiedData = await classifiedResponse.json();
    
    // 동기화 상태 분석
    const autoCount = autoData.success ? autoData.data.length : 0;
    const classifiedCount = classifiedData.success ? classifiedData.data.length : 0;
    
    // 최근 수집 시간 확인
    let lastCollectionTime = null;
    if (autoData.success && autoData.data.length > 0) {
      const latestItem = autoData.data[0];
      lastCollectionTime = new Date(latestItem.collectionTimestamp || latestItem.collectedAt);
    }
    
    metrics.system.sync = {
      autoCollectedCount: autoCount,
      classifiedCount: classifiedCount,
      syncRatio: autoCount > 0 ? (classifiedCount / autoCount * 100).toFixed(2) : 0,
      lastCollectionTime: lastCollectionTime?.toISOString(),
      dataFreshness: lastCollectionTime ? 
        Math.round((new Date() - lastCollectionTime) / (1000 * 60)) : null, // 분 단위
      timestamp: new Date().toISOString()
    };
    
    log(`✅ 동기화 메트릭 수집 완료 (자동: ${autoCount}, 분류: ${classifiedCount})`, 'green');
  } catch (error) {
    log(`❌ 동기화 메트릭 수집 실패: ${error.message}`, 'red');
    metrics.system.sync.error = error.message;
  }
}

// 4. 성능 임계값 체크
function checkPerformanceThresholds() {
  log('📊 성능 임계값 체크 중...', 'blue');
  
  const thresholds = {
    database: {
      responseTime: 5000, // 5초
      waitingCount: 5
    },
    api: {
      responseTime: 10000, // 10초
      successRate: 95 // 95%
    },
    sync: {
      dataFreshness: 120, // 2시간
      syncRatio: 80 // 80%
    }
  };
  
  metrics.system.performance = {
    thresholds,
    alerts: [],
    overall: 'HEALTHY'
  };
  
  // 데이터베이스 임계값 체크
  if (metrics.system.database.responseTime > thresholds.database.responseTime) {
    metrics.system.performance.alerts.push({
      type: 'database',
      message: `데이터베이스 응답 시간 초과: ${metrics.system.database.responseTime}ms`,
      severity: 'WARNING'
    });
  }
  
  if (metrics.system.database.poolStatus?.waitingCount > thresholds.database.waitingCount) {
    metrics.system.performance.alerts.push({
      type: 'database',
      message: `연결 풀 대기 수 초과: ${metrics.system.database.poolStatus.waitingCount}개`,
      severity: 'CRITICAL'
    });
  }
  
  // API 임계값 체크
  const apiEndpoints = Object.keys(metrics.system.api);
  let apiSuccessCount = 0;
  let totalApiResponseTime = 0;
  
  apiEndpoints.forEach(endpoint => {
    const endpointMetrics = metrics.system.api[endpoint];
    
    if (endpointMetrics.responseTime > thresholds.api.responseTime) {
      metrics.system.performance.alerts.push({
        type: 'api',
        message: `${endpoint} 응답 시간 초과: ${endpointMetrics.responseTime}ms`,
        severity: 'WARNING'
      });
    }
    
    if (endpointMetrics.success) {
      apiSuccessCount++;
    }
    totalApiResponseTime += endpointMetrics.responseTime;
  });
  
  const apiSuccessRate = (apiSuccessCount / apiEndpoints.length) * 100;
  if (apiSuccessRate < thresholds.api.successRate) {
    metrics.system.performance.alerts.push({
      type: 'api',
      message: `API 성공률 저하: ${apiSuccessRate.toFixed(1)}%`,
      severity: 'CRITICAL'
    });
  }
  
  // 동기화 임계값 체크
  if (metrics.system.sync.dataFreshness > thresholds.sync.dataFreshness) {
    metrics.system.performance.alerts.push({
      type: 'sync',
      message: `데이터 신선도 저하: ${metrics.system.sync.dataFreshness}분 전`,
      severity: 'WARNING'
    });
  }
  
  if (metrics.system.sync.syncRatio < thresholds.sync.syncRatio) {
    metrics.system.performance.alerts.push({
      type: 'sync',
      message: `동기화 비율 저하: ${metrics.system.sync.syncRatio}%`,
      severity: 'WARNING'
    });
  }
  
  // 전체 상태 결정
  const criticalAlerts = metrics.system.performance.alerts.filter(alert => alert.severity === 'CRITICAL');
  const warningAlerts = metrics.system.performance.alerts.filter(alert => alert.severity === 'WARNING');
  
  if (criticalAlerts.length > 0) {
    metrics.system.performance.overall = 'CRITICAL';
  } else if (warningAlerts.length > 2) {
    metrics.system.performance.overall = 'WARNING';
  } else {
    metrics.system.performance.overall = 'HEALTHY';
  }
  
  log(`✅ 성능 임계값 체크 완료 (상태: ${metrics.system.performance.overall})`, 'green');
  
  // 알림 출력
  if (metrics.system.performance.alerts.length > 0) {
    log('⚠️  성능 알림:', 'yellow');
    metrics.system.performance.alerts.forEach(alert => {
      const color = alert.severity === 'CRITICAL' ? 'red' : 'yellow';
      log(`  ${alert.severity}: ${alert.message}`, color);
    });
  }
}

// 5. 백로그 적용 시점 분석
function analyzeBacklogReadiness() {
  log('📊 백로그 적용 시점 분석 중...', 'blue');
  
  const recommendations = [];
  
  // Phase 1: 증분 동기화 전환 필요성
  const avgApiResponseTime = Object.values(metrics.system.api)
    .filter(api => api.responseTime > 0)
    .reduce((sum, api) => sum + api.responseTime, 0) / Object.keys(metrics.system.api).length;
  
  if (avgApiResponseTime > 8000) {
    recommendations.push({
      phase: 'Phase 1: 증분 동기화 전환',
      priority: 'HIGH',
      reason: `평균 API 응답 시간 ${avgApiResponseTime.toFixed(0)}ms 초과`,
      threshold: '8000ms'
    });
  }
  
  if (metrics.system.sync.autoCollectedCount > 50000) {
    recommendations.push({
      phase: 'Phase 1: 증분 동기화 전환',
      priority: 'MEDIUM',
      reason: `자동수집 데이터 ${metrics.system.sync.autoCollectedCount.toLocaleString()}개 초과`,
      threshold: '50,000개'
    });
  }
  
  // Phase 2: 스키마 강화 필요성
  if (metrics.system.performance.alerts.filter(alert => alert.type === 'database').length > 2) {
    recommendations.push({
      phase: 'Phase 2: 스키마·제약 강화',
      priority: 'HIGH',
      reason: '데이터베이스 관련 알림 다수 발생',
      threshold: '2회 이상'
    });
  }
  
  if (metrics.system.database.poolStatus?.waitingCount > 3) {
    recommendations.push({
      phase: 'Phase 2: 스키마·제약 강화',
      priority: 'MEDIUM',
      reason: `연결 풀 대기 수 ${metrics.system.database.poolStatus.waitingCount}개`,
      threshold: '3개 이상'
    });
  }
  
  metrics.backlogRecommendations = recommendations;
  
  log(`✅ 백로그 적용 시점 분석 완료 (${recommendations.length}개 권장사항)`, 'green');
  
  if (recommendations.length > 0) {
    log('📋 백로그 적용 권장사항:', 'yellow');
    recommendations.forEach(rec => {
      const color = rec.priority === 'HIGH' ? 'red' : 'yellow';
      log(`  ${rec.priority}: ${rec.phase}`, color);
      log(`    이유: ${rec.reason}`, 'blue');
      log(`    임계값: ${rec.threshold}`, 'blue');
    });
  } else {
    log('✅ 현재 시스템 상태 양호 - 백로그 적용 불필요', 'green');
  }
}

// 6. 메트릭 저장
function saveMetrics() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `metrics-${timestamp}.json`;
  const filepath = path.join(LOG_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(metrics, null, 2));
    log(`💾 메트릭 저장 완료: ${filepath}`, 'green');
    
    // 최신 메트릭 링크 생성
    const latestLink = path.join(LOG_DIR, 'latest.json');
    fs.writeFileSync(latestLink, JSON.stringify(metrics, null, 2));
    
    return filepath;
  } catch (error) {
    log(`❌ 메트릭 저장 실패: ${error.message}`, 'red');
    return null;
  }
}

// 7. 요약 리포트 생성
function generateSummaryReport() {
  const report = {
    timestamp: metrics.timestamp,
    overall: metrics.system.performance.overall,
    summary: {
      database: {
        status: metrics.system.database.status,
        responseTime: metrics.system.database.responseTime,
        waitingCount: metrics.system.database.poolStatus?.waitingCount || 0
      },
      api: {
        avgResponseTime: Object.values(metrics.system.api)
          .filter(api => api.responseTime > 0)
          .reduce((sum, api) => sum + api.responseTime, 0) / Object.keys(metrics.system.api).length,
        successRate: (Object.values(metrics.system.api).filter(api => api.success).length / Object.keys(metrics.system.api).length) * 100
      },
      sync: {
        autoCollectedCount: metrics.system.sync.autoCollectedCount,
        classifiedCount: metrics.system.sync.classifiedCount,
        syncRatio: metrics.system.sync.syncRatio,
        dataFreshness: metrics.system.sync.dataFreshness
      }
    },
    alerts: metrics.system.performance.alerts,
    recommendations: metrics.backlogRecommendations
  };
  
  console.log('\n' + '='.repeat(80));
  log('📊 운영 메트릭 수집 요약', 'blue');
  console.log('='.repeat(80));
  
  log(`🕐 수집 시간: ${report.timestamp}`, 'blue');
  log(`📈 전체 상태: ${report.overall}`, report.overall === 'HEALTHY' ? 'green' : 'yellow');
  
  log('\n📊 시스템 요약:', 'blue');
  log(`  데이터베이스: ${report.summary.database.status} (${report.summary.database.responseTime}ms, 대기: ${report.summary.database.waitingCount}개)`, 'blue');
  log(`  API: 평균 ${report.summary.api.avgResponseTime.toFixed(0)}ms, 성공률 ${report.summary.api.successRate.toFixed(1)}%`, 'blue');
  log(`  동기화: 자동 ${report.summary.sync.autoCollectedCount.toLocaleString()}개, 분류 ${report.summary.sync.classifiedCount.toLocaleString()}개 (${report.summary.sync.syncRatio}%)`, 'blue');
  
  if (report.alerts.length > 0) {
    log('\n⚠️  알림:', 'yellow');
    report.alerts.forEach(alert => {
      const color = alert.severity === 'CRITICAL' ? 'red' : 'yellow';
      log(`  ${alert.severity}: ${alert.message}`, color);
    });
  }
  
  if (report.recommendations.length > 0) {
    log('\n📋 백로그 적용 권장사항:', 'yellow');
    report.recommendations.forEach(rec => {
      const color = rec.priority === 'HIGH' ? 'red' : 'yellow';
      log(`  ${rec.priority}: ${rec.phase}`, color);
    });
  }
  
  console.log('='.repeat(80));
  
  return report;
}

// 메인 실행 함수
async function main() {
  log('🚀 YouTube Pulse 운영 메트릭 수집 시작', 'blue');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'blue');
  
  try {
    await collectDatabaseMetrics();
    await collectApiMetrics();
    await collectSyncMetrics();
    checkPerformanceThresholds();
    analyzeBacklogReadiness();
    
    const filepath = saveMetrics();
    const report = generateSummaryReport();
    
    log(`\n✅ 메트릭 수집 완료!`, 'green');
    if (filepath) {
      log(`📁 저장 위치: ${filepath}`, 'blue');
    }
    
    // 종료 코드 설정 (알림이 있으면 1, 없으면 0)
    process.exit(report.alerts.length > 0 ? 1 : 0);
    
  } catch (error) {
    log(`❌ 메트릭 수집 실패: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 스크립트 실행
main();
