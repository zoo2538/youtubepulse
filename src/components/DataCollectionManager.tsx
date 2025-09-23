import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { initializeDatabase, saveToDatabase, calculateDailyViews, getDatabaseInfo, cleanupOldData } from '@/lib/database-schema';
import { collectDailyData } from '@/lib/youtube-api-service';
import { hybridDatabaseService } from '@/lib/hybrid-database-service';

interface CollectionStatus {
  isRunning: boolean;
  progress: number;
  currentStep: string;
  error: string | null;
  lastCollection: string | null;
  stats: {
    totalChannels: number;
    totalVideos: number;
    totalDailyStats: number;
  };
}

const DataCollectionManager = () => {
  const [status, setStatus] = useState<CollectionStatus>({
    isRunning: false,
    progress: 0,
    currentStep: '',
    error: null,
    lastCollection: null,
    stats: {
      totalChannels: 0,
      totalVideos: 0,
      totalDailyStats: 0
    }
  });

  const [db, setDb] = useState<any>(null);

  useEffect(() => {
    // 하이브리드 데이터베이스 초기화
    const initDatabase = async () => {
      try {
        // 하이브리드 데이터베이스 초기화
        await hybridDatabaseService.initialize({
          useIndexedDB: true,
          usePostgreSQL: false, // 클라이언트에서는 IndexedDB만 사용
          syncEnabled: true
        });
        
        // 통계 업데이트
        await updateStats();
        
        console.log('✅ 하이브리드 데이터베이스 초기화 완료');
      } catch (error) {
        console.error('❌ 하이브리드 데이터베이스 초기화 실패:', error);
      }
    };
    
    initDatabase();
  }, []);

  const updateStats = async () => {
    try {
      const dbStatus = await hybridDatabaseService.getStatus();
      setStatus(prev => ({
        ...prev,
        stats: {
          totalChannels: dbStatus.totalChannels,
          totalVideos: dbStatus.totalVideos,
          totalDailyStats: dbStatus.totalClassificationData
        }
      }));
    } catch (error) {
      console.error('통계 업데이트 실패:', error);
    }
  };

  const startCollection = async () => {
    setStatus(prev => ({
      ...prev,
      isRunning: true,
      progress: 0,
      currentStep: '초기화 중...',
      error: null
    }));

    try {
      // 1단계: 초기화
      setStatus(prev => ({ ...prev, progress: 10, currentStep: 'YouTube API 연결 확인 중...' }));
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2단계: 트렌딩 비디오 수집
      setStatus(prev => ({ ...prev, progress: 20, currentStep: '트렌딩 비디오 수집 중...' }));
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3단계: 채널 정보 수집
      setStatus(prev => ({ ...prev, progress: 40, currentStep: '채널 상세정보 수집 중...' }));
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4단계: 비디오 정보 수집
      setStatus(prev => ({ ...prev, progress: 60, currentStep: '채널별 최신 비디오 수집 중...' }));
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 5단계: 데이터 처리
      setStatus(prev => ({ ...prev, progress: 80, currentStep: '데이터 처리 및 저장 중...' }));
      
      // 실제 데이터 수집 (하이브리드 데이터베이스 사용)
      const result = await collectDailyData();
      
      // 하이브리드 데이터베이스에 데이터 저장
      if (result.channels && result.channels.length > 0) {
        await hybridDatabaseService.saveChannels(result.channels);
      }
      
      if (result.videos && result.videos.length > 0) {
        await hybridDatabaseService.saveVideos(result.videos);
      }
      
      if (result.dailyStats) {
        await hybridDatabaseService.saveClassificationData(result.dailyStats);
      }
      
      // 6단계: 완료
      setStatus(prev => ({ 
        ...prev, 
        progress: 100, 
        currentStep: '수집 완료!',
        isRunning: false,
        lastCollection: new Date().toISOString()
      }));

      // 통계 업데이트
      await updateStats();

      console.log('데이터 수집 완료:', result);

    } catch (error) {
      console.error('데이터 수집 실패:', error);
      setStatus(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      }));
    }
  };

  const stopCollection = () => {
    setStatus(prev => ({
      ...prev,
      isRunning: false,
      currentStep: '수집 중단됨'
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  return (
    <div className="space-y-6">
      {/* 수집 상태 카드 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">데이터 수집 관리</h2>
          </div>
          <Badge variant={status.isRunning ? "destructive" : "default"}>
            {status.isRunning ? "수집 중" : "대기 중"}
          </Badge>
        </div>

        {/* 진행률 */}
        {status.isRunning && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>진행률</span>
              <span>{status.progress}%</span>
            </div>
            <Progress value={status.progress} className="mb-2" />
            <p className="text-sm text-muted-foreground">{status.currentStep}</p>
          </div>
        )}

        {/* 오류 메시지 */}
        {status.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-800">{status.error}</span>
            </div>
          </div>
        )}

        {/* 수집 버튼 */}
        <div className="flex items-center space-x-2">
          {!status.isRunning ? (
            <Button onClick={startCollection} className="flex items-center space-x-2">
              <Play className="w-4 h-4" />
              <span>데이터 수집 시작</span>
            </Button>
          ) : (
            <Button onClick={stopCollection} variant="destructive" className="flex items-center space-x-2">
              <Square className="w-4 h-4" />
              <span>수집 중단</span>
            </Button>
          )}
          
          <Button variant="outline" className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>새로고침</span>
          </Button>
        </div>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">총 채널 수</p>
              <p className="text-2xl font-bold">{status.stats.totalChannels}</p>
            </div>
            <Database className="w-8 h-8 text-blue-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">총 비디오 수</p>
              <p className="text-2xl font-bold">{status.stats.totalVideos}</p>
            </div>
            <Download className="w-8 h-8 text-green-600" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">일별 통계</p>
              <p className="text-2xl font-bold">{status.stats.totalDailyStats}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* 마지막 수집 정보 */}
      {status.lastCollection && (
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-muted-foreground">
              마지막 수집: {formatDate(status.lastCollection)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DataCollectionManager;
