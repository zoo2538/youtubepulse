import express from 'express';
import { dataService } from '../services/data-service.js';

const router = express.Router();

// 데이터 저장 (IndexedDB와 동일한 기능)
router.post('/save', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        message: '데이터 타입과 데이터가 필요합니다.'
      });
    }

    const result = await dataService.saveData(type, data);
    
    res.json({
      success: true,
      data: result,
      message: `${type} 데이터를 저장했습니다.`
    });
  } catch (error) {
    console.error('데이터 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터 로드 (IndexedDB와 동일한 기능)
router.get('/load/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { date, limit } = req.query;
    
    const data = await dataService.loadData(type, { date, limit });
    
    res.json({
      success: true,
      data,
      count: Array.isArray(data) ? data.length : 1,
      message: `${type} 데이터를 로드했습니다.`
    });
  } catch (error) {
    console.error('데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 분류된 데이터 로드
router.get('/classified', async (req, res) => {
  try {
    const { date, category, subCategory } = req.query;
    
    const data = await dataService.loadClassifiedData({ date, category, subCategory });
    
    res.json({
      success: true,
      data,
      count: data.length,
      message: '분류된 데이터를 로드했습니다.'
    });
  } catch (error) {
    console.error('분류된 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '분류된 데이터 로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 미분류 데이터 로드
router.get('/unclassified', async (req, res) => {
  try {
    const { date, limit } = req.query;
    
    const data = await dataService.loadUnclassifiedData({ date, limit });
    
    res.json({
      success: true,
      data,
      count: data.length,
      message: '미분류 데이터를 로드했습니다.'
    });
  } catch (error) {
    console.error('미분류 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '미분류 데이터 로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 데이터 분류 업데이트
router.put('/classify', async (req, res) => {
  try {
    const { videoId, category, subCategory } = req.body;
    
    if (!videoId || !category || !subCategory) {
      return res.status(400).json({
        success: false,
        message: '비디오 ID, 카테고리, 세부카테고리가 필요합니다.'
      });
    }

    const result = await dataService.updateClassification(videoId, category, subCategory);
    
    res.json({
      success: true,
      data: result,
      message: '데이터 분류를 업데이트했습니다.'
    });
  } catch (error) {
    console.error('데이터 분류 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 분류 업데이트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일별 데이터 로드
router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const data = await dataService.loadDailyData(date);
    
    res.json({
      success: true,
      data,
      count: data.length,
      message: `${date} 일별 데이터를 로드했습니다.`
    });
  } catch (error) {
    console.error('일별 데이터 로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '일별 데이터 로드 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 사용 가능한 날짜 목록 조회
router.get('/dates', async (req, res) => {
  try {
    const dates = await dataService.getAvailableDates();
    
    res.json({
      success: true,
      data: dates,
      count: dates.length,
      message: '사용 가능한 날짜 목록을 조회했습니다.'
    });
  } catch (error) {
    console.error('날짜 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '날짜 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오래된 데이터 정리 (7일 보존 정책)
router.delete('/cleanup', async (req, res) => {
  try {
    const { retentionDays = 7 } = req.body;
    
    const deletedCount = await dataService.cleanupOldData(retentionDays);
    
    res.json({
      success: true,
      data: { deletedCount },
      message: `${retentionDays}일 이상 된 데이터 ${deletedCount}개를 정리했습니다.`
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

// 데이터베이스 정보 조회
router.get('/info', async (req, res) => {
  try {
    const info = await dataService.getDatabaseInfo();
    
    res.json({
      success: true,
      data: info,
      message: '데이터베이스 정보를 조회했습니다.'
    });
  } catch (error) {
    console.error('데이터베이스 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터베이스 정보 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
