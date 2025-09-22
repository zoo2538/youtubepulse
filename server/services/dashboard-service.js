// 대시보드 서비스 (데스크탑 앱과 동일한 기능)
import { dataService } from './data-service.js';
import { categoryService } from './category-service.js';

export class DashboardService {
  constructor() {
    this.dataService = dataService;
    this.categoryService = categoryService;
  }

  // 대시보드 개요 데이터 조회
  async getOverviewData(date = null) {
    try {
      const [classifiedData, unclassifiedData, categories] = await Promise.all([
        this.dataService.loadClassifiedData({ date }),
        this.dataService.loadUnclassifiedData({ date }),
        this.categoryService.getCategories()
      ]);

      // 카테고리별 통계 계산
      const categoryStats = {};
      const previousDayStats = {};

      for (const [categoryName, subCategories] of Object.entries(categories)) {
        const categoryVideos = classifiedData.filter(item => item.category === categoryName);
        
        categoryStats[categoryName] = {
          totalVideos: categoryVideos.length,
          totalViews: categoryVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0),
          totalLikes: categoryVideos.reduce((sum, video) => sum + (video.likeCount || 0), 0),
          totalComments: categoryVideos.reduce((sum, video) => sum + (video.commentCount || 0), 0),
          subCategories: subCategories.map(subCat => ({
            name: subCat,
            count: categoryVideos.filter(video => video.subCategory === subCat).length
          }))
        };
      }

      // 전체 통계
      const totalStats = {
        totalVideos: classifiedData.length + unclassifiedData.length,
        classifiedVideos: classifiedData.length,
        unclassifiedVideos: unclassifiedData.length,
        totalViews: classifiedData.reduce((sum, video) => sum + (video.viewCount || 0), 0),
        totalLikes: classifiedData.reduce((sum, video) => sum + (video.likeCount || 0), 0),
        totalComments: classifiedData.reduce((sum, video) => sum + (video.commentCount || 0), 0)
      };

      return {
        totalStats,
        categoryStats,
        previousDayStats,
        date: date || new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('대시보드 개요 데이터 조회 오류:', error);
      throw error;
    }
  }

  // 카테고리별 통계 조회
  async getCategoryStats(date = null, category = null) {
    try {
      const options = { date };
      if (category) {
        options.category = category;
      }

      const classifiedData = await this.dataService.loadClassifiedData(options);
      const categories = await this.categoryService.getCategories();

      const stats = {};

      for (const [categoryName, subCategories] of Object.entries(categories)) {
        if (category && categoryName !== category) continue;

        const categoryVideos = classifiedData.filter(item => item.category === categoryName);
        
        stats[categoryName] = {
          totalVideos: categoryVideos.length,
          totalViews: categoryVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0),
          totalLikes: categoryVideos.reduce((sum, video) => sum + (video.likeCount || 0), 0),
          totalComments: categoryVideos.reduce((sum, video) => sum + (video.commentCount || 0), 0),
          averageViews: categoryVideos.length > 0 ? 
            Math.round(categoryVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0) / categoryVideos.length) : 0,
          subCategoryStats: subCategories.map(subCat => {
            const subCatVideos = categoryVideos.filter(video => video.subCategory === subCat);
            return {
              name: subCat,
              count: subCatVideos.length,
              views: subCatVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0),
              likes: subCatVideos.reduce((sum, video) => sum + (video.likeCount || 0), 0),
              comments: subCatVideos.reduce((sum, video) => sum + (video.commentCount || 0), 0)
            };
          })
        };
      }

      return stats;
    } catch (error) {
      console.error('카테고리별 통계 조회 오류:', error);
      throw error;
    }
  }

  // 트렌딩 비디오 조회
  async getTrendingVideos(date = null, options = {}) {
    try {
      const { limit = 20, category } = options;
      
      let classifiedData = await this.dataService.loadClassifiedData({ date });
      
      if (category) {
        classifiedData = classifiedData.filter(item => item.category === category);
      }

      // 조회수 기준으로 정렬
      const trendingVideos = classifiedData
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, limit)
        .map(video => ({
          ...video,
          performanceRatio: this.calculatePerformanceRatio(video),
          categoryColor: this.categoryService.getCategoryColor(video.category)
        }));

      return trendingVideos;
    } catch (error) {
      console.error('트렌딩 비디오 조회 오류:', error);
      throw error;
    }
  }

  // 채널 트렌딩 조회
  async getChannelTrending(date = null, limit = 50) {
    try {
      const classifiedData = await this.dataService.loadClassifiedData({ date });
      
      // 채널별 통계 계산
      const channelStats = new Map();
      
      for (const video of classifiedData) {
        const channelId = video.channelId;
        const channelTitle = video.channelTitle;
        
        if (!channelStats.has(channelId)) {
          channelStats.set(channelId, {
            channelId,
            channelTitle,
            videoCount: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            categories: new Set(),
            videos: []
          });
        }
        
        const stats = channelStats.get(channelId);
        stats.videoCount++;
        stats.totalViews += video.viewCount || 0;
        stats.totalLikes += video.likeCount || 0;
        stats.totalComments += video.commentCount || 0;
        stats.categories.add(video.category);
        stats.videos.push(video);
      }

      // 채널별 평균 조회수 계산 및 정렬
      const channelTrending = Array.from(channelStats.values())
        .map(channel => ({
          ...channel,
          averageViews: Math.round(channel.totalViews / channel.videoCount),
          categoryCount: channel.categories.size,
          categories: Array.from(channel.categories)
        }))
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, limit);

      return channelTrending;
    } catch (error) {
      console.error('채널 트렌딩 조회 오류:', error);
      throw error;
    }
  }

  // 성과 비디오 조회
  async getPerformanceVideos(date = null, options = {}) {
    try {
      const { limit = 20, category } = options;
      
      let classifiedData = await this.dataService.loadClassifiedData({ date });
      
      if (category) {
        classifiedData = classifiedData.filter(item => item.category === category);
      }

      // 성과 비율 계산 및 정렬
      const performanceVideos = classifiedData
        .map(video => ({
          ...video,
          performanceRatio: this.calculatePerformanceRatio(video),
          categoryColor: this.categoryService.getCategoryColor(video.category)
        }))
        .sort((a, b) => b.performanceRatio - a.performanceRatio)
        .slice(0, limit);

      return performanceVideos;
    } catch (error) {
      console.error('성과 비디오 조회 오류:', error);
      throw error;
    }
  }

  // 일별 카테고리 순위 조회
  async getCategoryDailyRanking(date = null, limit = 10) {
    try {
      const classifiedData = await this.dataService.loadClassifiedData({ date });
      const categories = await this.categoryService.getCategories();

      // 카테고리별 통계 계산
      const categoryRanking = [];

      for (const [categoryName, subCategories] of Object.entries(categories)) {
        const categoryVideos = classifiedData.filter(item => item.category === categoryName);
        
        const totalViews = categoryVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
        const totalLikes = categoryVideos.reduce((sum, video) => sum + (video.likeCount || 0), 0);
        const totalComments = categoryVideos.reduce((sum, video) => sum + (video.commentCount || 0), 0);
        
        if (categoryVideos.length > 0) {
          categoryRanking.push({
            category: categoryName,
            videoCount: categoryVideos.length,
            totalViews,
            totalLikes,
            totalComments,
            averageViews: Math.round(totalViews / categoryVideos.length),
            categoryColor: this.categoryService.getCategoryColor(categoryName)
          });
        }
      }

      // 조회수 기준으로 정렬
      return categoryRanking
        .sort((a, b) => b.totalViews - a.totalViews)
        .slice(0, limit);
    } catch (error) {
      console.error('일별 카테고리 순위 조회 오류:', error);
      throw error;
    }
  }

  // 조회수 데이터 조회 (차트용)
  async getViewsData(date = null, options = {}) {
    try {
      const { category, days = 7 } = options;
      
      // 실제로는 날짜별 데이터를 조회해야 하지만, 여기서는 임시 데이터 반환
      const viewsData = [];
      const categories = await this.categoryService.getCategories();
      
      for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - i);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        const dayData = {
          date: dateStr,
          totalViews: 0,
          categoryViews: {}
        };

        // 카테고리별 조회수 계산
        for (const categoryName of Object.keys(categories)) {
          if (category && categoryName !== category) continue;
          
          const categoryVideos = await this.dataService.loadClassifiedData({ 
            date: dateStr, 
            category: categoryName 
          });
          
          const categoryViews = categoryVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
          dayData.categoryViews[categoryName] = categoryViews;
          dayData.totalViews += categoryViews;
        }

        viewsData.push(dayData);
      }

      return viewsData;
    } catch (error) {
      console.error('조회수 데이터 조회 오류:', error);
      throw error;
    }
  }

  // 대시보드 필터 옵션 조회
  async getFilterOptions() {
    try {
      const categories = await this.categoryService.getCategories();
      const availableDates = await this.dataService.getAvailableDates();
      
      return {
        categories: Object.keys(categories),
        subCategories: this.categoryService.getAllSubCategories(),
        availableDates,
        categoryColors: this.categoryService.getAllCategoryColors()
      };
    } catch (error) {
      console.error('대시보드 필터 옵션 조회 오류:', error);
      throw error;
    }
  }

  // 실시간 통계 조회
  async getRealtimeStats() {
    try {
      const [classifiedData, unclassifiedData, dbInfo] = await Promise.all([
        this.dataService.loadClassifiedData(),
        this.dataService.loadUnclassifiedData(),
        this.dataService.getDatabaseInfo()
      ]);

      return {
        totalVideos: classifiedData.length + unclassifiedData.length,
        classifiedVideos: classifiedData.length,
        unclassifiedVideos: unclassifiedData.length,
        databaseSize: dbInfo.size,
        lastUpdate: new Date().toISOString(),
        systemStatus: 'healthy'
      };
    } catch (error) {
      console.error('실시간 통계 조회 오류:', error);
      throw error;
    }
  }

  // 성과 비율 계산 (좋아요/조회수 비율)
  calculatePerformanceRatio(video) {
    const views = video.viewCount || 0;
    const likes = video.likeCount || 0;
    
    if (views === 0) return 0;
    
    return Math.round((likes / views) * 10000) / 100; // 소수점 둘째 자리까지
  }
}

export const dashboardService = new DashboardService();
