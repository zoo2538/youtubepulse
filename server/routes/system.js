import express from 'express';
import { systemService } from '../services/system-service.js';

const router = express.Router();

// 시스템 정보 조회
router.get('/info', async (req, res) => {
  try {
    const info = await systemService.getSystemInfo();
    
    res.json({
      success: true,
      data: info,
      message: '시스템 정보를 조회했습니다.'
    });
  } catch (error) {
    console.error('시스템 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터베이스 연결 테스트
router.post('/test-database', async (req, res) => {
  try {
    const { host, port, database, username, password, connectionType } = req.body;
    
    const result = await systemService.testDatabaseConnection({
      host, port, database, username, password, connectionType
    });
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? '데이터베이스 연결 성공' : '데이터베이스 연결 실패'
    });
  } catch (error) {
    console.error('데이터베이스 연결 테스트 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터베이스 연결 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// Redis 연결 테스트
router.post('/test-redis', async (req, res) => {
  try {
    const { host, port, password, database } = req.body;
    
    const result = await systemService.testRedisConnection({
      host, port, password, database
    });
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Redis 연결 성공' : 'Redis 연결 실패'
    });
  } catch (error) {
    console.error('Redis 연결 테스트 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Redis 연결 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// YouTube API 키 테스트
router.post('/test-youtube-api', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API 키가 필요합니다.'
      });
    }

    const result = await systemService.testYouTubeApi(apiKey);
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'YouTube API 연결 성공' : 'YouTube API 연결 실패'
    });
  } catch (error) {
    console.error('YouTube API 테스트 오류:', error);
    res.status(500).json({
      success: false,
      message: 'YouTube API 테스트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터 수집 시작
router.post('/start-collection', async (req, res) => {
  try {
    const { apiKey, keywords, maxVideos, minViewCount } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API 키가 필요합니다.'
      });
    }

    const result = await systemService.startDataCollection({
      apiKey,
      keywords: keywords || ['먹방', 'ASMR', '챌린지', '브이로그', '리뷰'],
      maxVideos: maxVideos || 10000,
      minViewCount: minViewCount || 10000
    });
    
    res.json({
      success: true,
      data: result,
      message: '데이터 수집을 시작했습니다.'
    });
  } catch (error) {
    console.error('데이터 수집 시작 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 수집 시작 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터 수집 상태 조회
router.get('/collection-status', async (req, res) => {
  try {
    const status = await systemService.getCollectionStatus();
    
    res.json({
      success: true,
      data: status,
      message: '데이터 수집 상태를 조회했습니다.'
    });
  } catch (error) {
    console.error('데이터 수집 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 수집 상태 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터 수집 중지
router.post('/stop-collection', async (req, res) => {
  try {
    const result = await systemService.stopDataCollection();
    
    res.json({
      success: true,
      data: result,
      message: '데이터 수집을 중지했습니다.'
    });
  } catch (error) {
    console.error('데이터 수집 중지 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 수집 중지 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 시스템 설정 저장
router.post('/config', async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: '설정 데이터가 필요합니다.'
      });
    }

    const result = await systemService.saveSystemConfig(config);
    
    res.json({
      success: true,
      data: result,
      message: '시스템 설정을 저장했습니다.'
    });
  } catch (error) {
    console.error('시스템 설정 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 설정 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 시스템 설정 로드
router.get('/config', async (req, res) => {
  try {
    const config = await systemService.loadSystemConfig();
    
    res.json({
      success: true,
      data: config,
      message: '시스템 설정을 로드했습니다.'
    });
  } catch (error) {
    console.error('시스템 설정 로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 설정 로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터 정리 실행
router.post('/cleanup', async (req, res) => {
  try {
    const { retentionDays = 7 } = req.body;
    
    const result = await systemService.cleanupData(retentionDays);
    
    res.json({
      success: true,
      data: result,
      message: `${retentionDays}일 이상 된 데이터를 정리했습니다.`
    });
  } catch (error) {
    console.error('데이터 정리 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 정리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 시스템 로그 조회
router.get('/logs', async (req, res) => {
  try {
    const { level, limit = 100 } = req.query;
    
    const logs = await systemService.getSystemLogs({ level, limit });
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      message: '시스템 로그를 조회했습니다.'
    });
  } catch (error) {
    console.error('시스템 로그 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '시스템 로그 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
