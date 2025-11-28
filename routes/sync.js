/**
 * 동기화 API 라우터
 * 클라이언트와 서버 간 데이터 동기화 처리
 */

const express = require('express');
const router = express.Router();
const { getDifferentialData } = require('../lib/postgresql-server-service');
const { parseJsonBody } = require('../middleware/body-parser');

/**
 * [POST] /api/sync/download
 * 클라이언트에서 마지막 동기화 시간을 받아 증분 데이터를 전송합니다.
 */
router.post('/download', parseJsonBody, async (req, res) => {
  try {
    const { lastSyncTime } = req.body;
    const pool = req.app.locals.pool;

    if (!lastSyncTime) {
      return res.status(400).json({ error: 'lastSyncTime is required' });
    }

    if (!pool) {
      return res.status(503).json({ 
        error: 'Database connection not available',
        message: 'PostgreSQL pool이 초기화되지 않았습니다.'
      });
    }

    // 1. PostgreSQL에서 최신 데이터 조회 (증분 동기화 로직)
    //    * 주의: 이 함수는 lastSyncTime 이후에 업데이트된 데이터만 가져와야 합니다.
    const recentData = await getDifferentialData(pool, lastSyncTime);

    // 2. 응답 전송
    res.status(200).json({
      success: true,
      channels: recentData.channels || [],
      videos: recentData.videos || [],
      classificationData: recentData.classificationData || [],
      unclassifiedData: recentData.unclassifiedData || [],
      syncTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 동기화 다운로드 API 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '서버 동기화 처리 중 오류 발생',
      message: error.message
    });
  }
});

module.exports = router;

