/**
 * 헬스체크 라우터
 * 데이터베이스 연결 상태 및 서비스 상태 확인
 */

const express = require('express');
const router = express.Router();
const { checkPoolHealth } = require('../lib/db-pool');

/**
 * 기본 헬스체크
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'youtube-pulse-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

/**
 * 데이터베이스 헬스체크
 * GET /health/db
 */
router.get('/db', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 풀 상태 확인
    const poolHealth = await checkPoolHealth(req.app.locals.pool);
    const responseTime = Date.now() - startTime;
    
    if (poolHealth.healthy) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        database: {
          connected: true,
          version: poolHealth.version,
          currentTime: poolHealth.timestamp,
          poolStats: poolHealth.poolStats
        }
      });
    } else {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        database: {
          connected: false,
          error: poolHealth.error,
          code: poolHealth.code
        }
      });
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      database: {
        connected: false,
        error: error.message,
        code: error.code
      }
    });
  }
});

/**
 * 환경변수 헬스체크
 * GET /health/env
 */
router.get('/env', (req, res) => {
  const requiredEnvVars = [
    'DATABASE_URL',
    'VITE_YOUTUBE_API_KEY',
    'NODE_ENV'
  ];
  
  const envStatus = {};
  let allPresent = true;
  
  requiredEnvVars.forEach(varName => {
    const present = !!process.env[varName];
    envStatus[varName] = present;
    if (!present) allPresent = false;
  });
  
  const status = allPresent ? 'healthy' : 'unhealthy';
  const statusCode = allPresent ? 200 : 500;
  
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      railwayEnv: process.env.RAILWAY_ENVIRONMENT || null,
      serviceName: process.env.RAILWAY_SERVICE_NAME || null,
      requiredVars: envStatus,
      allPresent
    }
  });
});

/**
 * 자동수집 상태 헬스체크
 * GET /health/auto-collect
 */
router.get('/auto-collect', (req, res) => {
  const isAutoCollecting = global.autoCollectionInProgress || false;
  const isManualCollecting = global.manualCollectionInProgress || false;
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    autoCollect: {
      inProgress: isAutoCollecting,
      manualInProgress: isManualCollecting,
      lastRun: global.lastAutoCollectionRun || null,
      canRun: !isAutoCollecting && !isManualCollecting
    }
  });
});

/**
 * 전체 헬스체크
 * GET /health/full
 */
router.get('/full', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 데이터베이스 상태 확인
    const dbHealth = await checkPoolHealth(req.app.locals.pool);
    
    // 환경변수 상태 확인
    const requiredEnvVars = ['DATABASE_URL', 'VITE_YOUTUBE_API_KEY', 'NODE_ENV'];
    const envHealth = requiredEnvVars.every(varName => !!process.env[varName]);
    
    // 자동수집 상태 확인
    const autoCollectHealth = {
      inProgress: global.autoCollectionInProgress || false,
      manualInProgress: global.manualCollectionInProgress || false,
      canRun: !global.autoCollectionInProgress && !global.manualCollectionInProgress
    };
    
    const responseTime = Date.now() - startTime;
    
    const overallStatus = dbHealth.healthy && envHealth && autoCollectHealth.canRun ? 'healthy' : 'unhealthy';
    const statusCode = overallStatus === 'healthy' ? 200 : 500;
    
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          healthy: dbHealth.healthy,
          version: dbHealth.version,
          poolStats: dbHealth.poolStats
        },
        environment: {
          healthy: envHealth,
          nodeEnv: process.env.NODE_ENV || 'development',
          railwayEnv: process.env.RAILWAY_ENVIRONMENT || null
        },
        autoCollect: autoCollectHealth
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error.message
    });
  }
});

module.exports = router;
