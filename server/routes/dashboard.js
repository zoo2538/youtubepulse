import express from 'express';
import { dashboardService } from '../services/dashboard-service.js';

const router = express.Router();

// 대시보드 개요 데이터 조회
router.get('/overview', async (req, res) => {
  try {
    const { date } = req.query;
    
    const overview = await dashboardService.getOverviewData(date);
    
    res.json({
      success: true,
      data: overview,
      message: '대시보드 개요 데이터를 조회했습니다.'
    });
  } catch (error) {
    console.error('대시보드 개요 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '대시보드 개요 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 카테고리별 통계 조회
router.get('/category-stats', async (req, res) => {
  try {
    const { date, category } = req.query;
    
    const stats = await dashboardService.getCategoryStats(date, category);
    
    res.json({
      success: true,
      data: stats,
      message: '카테고리별 통계를 조회했습니다.'
    });
  } catch (error) {
    console.error('카테고리별 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '카테고리별 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 트렌딩 비디오 조회
router.get('/trending-videos', async (req, res) => {
  try {
    const { date, limit = 20, category } = req.query;
    
    const videos = await dashboardService.getTrendingVideos(date, { limit, category });
    
    res.json({
      success: true,
      data: videos,
      count: videos.length,
      message: '트렌딩 비디오를 조회했습니다.'
    });
  } catch (error) {
    console.error('트렌딩 비디오 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '트렌딩 비디오 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 채널 트렌딩 테이블 조회
router.get('/channel-trending', async (req, res) => {
  try {
    const { date, limit = 50 } = req.query;
    
    const channels = await dashboardService.getChannelTrending(date, limit);
    
    res.json({
      success: true,
      data: channels,
      count: channels.length,
      message: '채널 트렌딩 데이터를 조회했습니다.'
    });
  } catch (error) {
    console.error('채널 트렌딩 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '채널 트렌딩 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 성과 비디오 목록 조회
router.get('/performance-videos', async (req, res) => {
  try {
    const { date, limit = 20, category } = req.query;
    
    const videos = await dashboardService.getPerformanceVideos(date, { limit, category });
    
    res.json({
      success: true,
      data: videos,
      count: videos.length,
      message: '성과 비디오 목록을 조회했습니다.'
    });
  } catch (error) {
    console.error('성과 비디오 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '성과 비디오 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 일별 카테고리 순위 조회
router.get('/category-daily-ranking', async (req, res) => {
  try {
    const { date, limit = 10 } = req.query;
    
    const ranking = await dashboardService.getCategoryDailyRanking(date, limit);
    
    res.json({
      success: true,
      data: ranking,
      count: ranking.length,
      message: '일별 카테고리 순위를 조회했습니다.'
    });
  } catch (error) {
    console.error('일별 카테고리 순위 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '일별 카테고리 순위 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 조회수 데이터 조회 (차트용)
router.get('/views-data', async (req, res) => {
  try {
    const { date, category, days = 7 } = req.query;
    
    const viewsData = await dashboardService.getViewsData(date, { category, days });
    
    res.json({
      success: true,
      data: viewsData,
      message: '조회수 데이터를 조회했습니다.'
    });
  } catch (error) {
    console.error('조회수 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '조회수 데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 대시보드 필터 옵션 조회
router.get('/filters', async (req, res) => {
  try {
    const filters = await dashboardService.getFilterOptions();
    
    res.json({
      success: true,
      data: filters,
      message: '대시보드 필터 옵션을 조회했습니다.'
    });
  } catch (error) {
    console.error('대시보드 필터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '대시보드 필터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 실시간 통계 조회
router.get('/realtime-stats', async (req, res) => {
  try {
    const stats = await dashboardService.getRealtimeStats();
    
    res.json({
      success: true,
      data: stats,
      message: '실시간 통계를 조회했습니다.'
    });
  } catch (error) {
    console.error('실시간 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '실시간 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
