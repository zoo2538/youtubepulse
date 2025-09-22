import express from 'express';
import { categoryService } from '../services/category-service.js';

const router = express.Router();

// 카테고리 목록 조회
router.get('/', async (req, res) => {
  try {
    const categories = await categoryService.getCategories();
    
    res.json({
      success: true,
      data: categories,
      count: Object.keys(categories).length,
      message: '카테고리 목록을 조회했습니다.'
    });
  } catch (error) {
    console.error('카테고리 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '카테고리 목록 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 카테고리 저장
router.post('/', async (req, res) => {
  try {
    const { categories } = req.body;
    
    if (!categories || typeof categories !== 'object') {
      return res.status(400).json({
        success: false,
        message: '카테고리 데이터가 필요합니다.'
      });
    }

    const result = await categoryService.saveCategories(categories);
    
    res.json({
      success: true,
      data: result,
      message: '카테고리를 저장했습니다.'
    });
  } catch (error) {
    console.error('카테고리 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '카테고리 저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 세부카테고리 추가
router.post('/:category/subcategories', async (req, res) => {
  try {
    const { category } = req.params;
    const { subCategory } = req.body;
    
    if (!subCategory) {
      return res.status(400).json({
        success: false,
        message: '세부카테고리 이름이 필요합니다.'
      });
    }

    const result = await categoryService.addSubCategory(category, subCategory);
    
    res.json({
      success: true,
      data: result,
      message: `${category} 카테고리에 "${subCategory}" 세부카테고리를 추가했습니다.`
    });
  } catch (error) {
    console.error('세부카테고리 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '세부카테고리 추가 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 세부카테고리 삭제
router.delete('/:category/subcategories/:subCategory', async (req, res) => {
  try {
    const { category, subCategory } = req.params;
    
    const result = await categoryService.removeSubCategory(category, subCategory);
    
    res.json({
      success: true,
      data: result,
      message: `${category} 카테고리에서 "${subCategory}" 세부카테고리를 삭제했습니다.`
    });
  } catch (error) {
    console.error('세부카테고리 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '세부카테고리 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 세부카테고리 수정
router.put('/:category/subcategories/:oldSubCategory', async (req, res) => {
  try {
    const { category, oldSubCategory } = req.params;
    const { newSubCategory } = req.body;
    
    if (!newSubCategory) {
      return res.status(400).json({
        success: false,
        message: '새 세부카테고리 이름이 필요합니다.'
      });
    }

    const result = await categoryService.updateSubCategory(category, oldSubCategory, newSubCategory);
    
    res.json({
      success: true,
      data: result,
      message: `${category} 카테고리의 "${oldSubCategory}"를 "${newSubCategory}"로 수정했습니다.`
    });
  } catch (error) {
    console.error('세부카테고리 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '세부카테고리 수정 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 카테고리별 통계 조회
router.get('/:category/stats', async (req, res) => {
  try {
    const { category } = req.params;
    const { date } = req.query;
    
    const stats = await categoryService.getCategoryStats(category, date);
    
    res.json({
      success: true,
      data: stats,
      message: `${category} 카테고리 통계를 조회했습니다.`
    });
  } catch (error) {
    console.error('카테고리 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '카테고리 통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 카테고리별 비디오 목록 조회
router.get('/:category/videos', async (req, res) => {
  try {
    const { category } = req.params;
    const { subCategory, date, limit } = req.query;
    
    const videos = await categoryService.getCategoryVideos(category, { subCategory, date, limit });
    
    res.json({
      success: true,
      data: videos,
      count: videos.length,
      message: `${category} 카테고리 비디오 목록을 조회했습니다.`
    });
  } catch (error) {
    console.error('카테고리 비디오 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '카테고리 비디오 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

export default router;
