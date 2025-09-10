import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  Database, 
  Key, 
  Globe, 
  RefreshCw, 
  Save, 
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Download,
  Upload,
  Filter,
  Play
} from "lucide-react";
import DataCollectionManager from "@/components/DataCollectionManager";
import { postgresqlService } from "@/lib/postgresql-service";
import { redisService } from "@/lib/redis-service";
import { migrateSubCategoriesToDynamic, checkMigrationStatus } from "@/lib/data-migration";
import { indexedDBService } from "@/lib/indexeddb-service";
import { loadCollectionConfig, EXPANDED_KEYWORDS } from "@/lib/data-collection-config";

interface ApiConfig {
  youtubeApiKey: string;
  youtubeApiEnabled: boolean;
  customApiUrl: string;
  customApiEnabled: boolean;
  customApiKey: string;
}

interface DatabaseConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  connectionType: 'mysql' | 'postgresql' | 'mongodb';
}

interface RedisConfig {
  host: string;
  port: string;
  password: string;
  database: number;
}

interface SystemConfig {
  dataRefreshInterval: number;
  maxRetryAttempts: number;
  enableAutoSync: boolean;
  enableNotifications: boolean;
}

const System = () => {
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    // localStorage에서 저장된 설정 불러오기
    const savedApiKey = localStorage.getItem('youtubeApiKey') || '';
    return {
      youtubeApiKey: savedApiKey,
      youtubeApiEnabled: !!savedApiKey,
      customApiUrl: '',
      customApiEnabled: false,
      customApiKey: ''
    };
  });

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    host: 'localhost',
    port: '5432',
    database: 'youtubepulse',
    username: 'postgres',
    password: '',
    connectionType: 'postgresql'
  });

  const [redisConfig, setRedisConfig] = useState<RedisConfig>({
    host: 'localhost',
    port: '6379',
    password: '',
    database: 0
  });

  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    dataRefreshInterval: 300,
    maxRetryAttempts: 3,
    enableAutoSync: true,
    enableNotifications: true
  });

  const [dbInfo, setDbInfo] = useState<any>(null);
  const [isLoadingDbInfo, setIsLoadingDbInfo] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);

  // 페이지 로드 시 IndexedDB 정보 로드
  React.useEffect(() => {
    loadDatabaseInfo();
    checkMigration();
  }, []);

  // 마이그레이션 상태 확인
  const checkMigration = async () => {
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('마이그레이션 상태 확인 실패:', error);
    }
  };

  // 세부카테고리 마이그레이션 실행
  const handleMigration = async () => {
    try {
      const result = await migrateSubCategoriesToDynamic();
      if (result.success) {
        alert(`✅ 마이그레이션 완료!\n\n분류된 데이터: ${result.classifiedDataCount}개\n미분류 데이터: ${result.unclassifiedDataCount}개\n사용된 카테고리: ${result.usedCategories.length}개\n사용된 세부카테고리: ${result.usedSubCategories.length}개`);
        await checkMigration();
      } else {
        alert(`❌ 마이그레이션 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('마이그레이션 실행 실패:', error);
      alert('❌ 마이그레이션 실행 중 오류가 발생했습니다.');
    }
  };

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [redisConnectionStatus, setRedisConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [redisTestMessage, setRedisTestMessage] = useState('');
  const [youtubeApiStatus, setYoutubeApiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [youtubeApiMessage, setYoutubeApiMessage] = useState('');

  const loadDatabaseInfo = async () => {
    try {
      setIsLoadingDbInfo(true);
      const info = await indexedDBService.getDatabaseInfo();
      setDbInfo(info);
    } catch (error) {
      console.error('데이터베이스 정보 로드 오류:', error);
    } finally {
      setIsLoadingDbInfo(false);
    }
  };

  const handleCleanupOldData = async () => {
    if (window.confirm('14일이 지난 오래된 데이터를 정리하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      try {
        const deletedCount = await indexedDBService.cleanupOldData(14);
        alert(`데이터 정리가 완료되었습니다!\n\n삭제된 데이터: ${deletedCount}개`);
        loadDatabaseInfo(); // 정보 새로고침
      } catch (error) {
        console.error('데이터 정리 오류:', error);
        alert('데이터 정리 중 오류가 발생했습니다.');
      }
    }
  };


  const testConnection = async () => {
    setConnectionStatus('testing');
    setTestMessage('PostgreSQL 연결을 테스트하고 있습니다...');
    
    try {

      
      const success = await postgresqlService.connect(dbConfig);
      
      if (success) {
        // 테이블 생성
        await postgresqlService.createTables();
        setConnectionStatus('success');
        setTestMessage('PostgreSQL 연결이 성공적으로 설정되었습니다!');
      } else {
        setConnectionStatus('error');
        setTestMessage('PostgreSQL 연결에 실패했습니다. 설정을 확인해주세요.');
      }
    } catch (error) {
      setConnectionStatus('error');
      setTestMessage(`PostgreSQL 연결 오류: ${error}`);
    }
  };

  const testRedisConnection = async () => {
    setRedisConnectionStatus('testing');
    setRedisTestMessage('Redis 연결을 테스트하고 있습니다...');
    
    try {

      
      const success = await redisService.connect(redisConfig);
      
      if (success) {
        // 간단한 테스트 데이터 저장/조회
        await redisService.set('test_key', { message: 'Redis 연결 테스트 성공' }, 60);
        const testData = await redisService.get('test_key');
        
        if (testData) {
          setRedisConnectionStatus('success');
          setRedisTestMessage('Redis 연결이 성공적으로 설정되었습니다!');
        } else {
          setRedisConnectionStatus('error');
          setRedisTestMessage('Redis 데이터 저장/조회 테스트에 실패했습니다.');
        }
      } else {
        setRedisConnectionStatus('error');
        setRedisTestMessage('Redis 연결에 실패했습니다. 설정을 확인해주세요.');
      }
    } catch (error) {
      setRedisConnectionStatus('error');
      setRedisTestMessage(`Redis 연결 오류: ${error}`);
    }
  };

  const testYouTubeAPI = async () => {
    setYoutubeApiStatus('testing');
    setYoutubeApiMessage('YouTube API를 테스트하고 있습니다...');
    
    try {
      // YouTube API 테스트 (간단한 검색 요청)
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${apiConfig.youtubeApiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API 키가 유효하지 않습니다.');
      }
      
      setYoutubeApiStatus('success');
      setYoutubeApiMessage('YouTube API 연결이 성공했습니다!');
    } catch (error) {
      setYoutubeApiStatus('error');
      setYoutubeApiMessage(error instanceof Error ? error.message : 'API 테스트에 실패했습니다.');
    }
  };

  const saveConfig = async () => {
    try {
      // 설정 저장 로직
      console.log('설정 저장:', { apiConfig, dbConfig, systemConfig });
      
      // API 키를 localStorage에 저장
      if (apiConfig.youtubeApiKey) {
        localStorage.setItem('youtubeApiKey', apiConfig.youtubeApiKey);
      }
      
      // 다른 설정들도 localStorage에 저장
      localStorage.setItem('dbConfig', JSON.stringify(dbConfig));
      localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
      
      alert('설정이 저장되었습니다!');
    } catch (error) {
      alert('설정 저장에 실패했습니다.');
    }
  };

  const exportConfig = () => {
    const config = { apiConfig, dbConfig, systemConfig };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtubepulse-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 키워드 추출 함수 (현재 사용하지 않음 - 트렌드 기반 수집으로 변경)
  const extractKeywordsFromVideos = (videos: any[]): string[] => {
    // 이 함수는 현재 사용되지 않습니다.
    // 트렌드 기반 수집으로 변경되어 키워드 기반 검색을 하지 않습니다.
    return [];
  };

  const handleStartDataCollection = async () => {
    try {
      if (!apiConfig.youtubeApiKey) {
        alert('YouTube API 키를 먼저 입력해주세요.');
        return;
      }

      // 🔥 설정 파일에서 조회수 기준 로드
      const collectionConfig = loadCollectionConfig();
      const minViewCount = collectionConfig.minViewCount || 10000; // 50,000 → 10,000으로 낮춤

      console.log('=== 트렌딩 기반 데이터 수집 설정 ===');
      console.log(`조회수 기준: ${minViewCount.toLocaleString()}회 이상`);
      console.log(`수집 방식: mostPopular API (트렌딩 기반)`);
      console.log('=====================================');

      console.log('트렌딩 기반 영상 수집 시작...');
      
      const maxVideos = 10000; // 최대 10,000개 영상 수집
      let allVideos: any[] = [];
      let pageToken = '';
      let totalCollected = 0;
      let requestCount = 0;
      
      // 🔥 키워드 기반 영상 수집 (search API 사용)
      const keywords = collectionConfig.keywords || ['먹방', 'ASMR', '챌린지', '브이로그', '리뷰'];
      
      for (const keyword of keywords) {
        if (allVideos.length >= maxVideos) {
          console.log(`최대 수집 수(${maxVideos}) 도달`);
          break;
        }
        
        try {
          console.log(`키워드 "${keyword}" 수집 시작...`);
          
        // 키워드로 검색
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&regionCode=KR&key=${apiConfig.youtubeApiKey}`;
        
        const searchResponse = await fetch(searchUrl);
        
        if (!searchResponse.ok) {
          console.error(`키워드 "${keyword}" 검색 오류:`, searchResponse.status);
          continue;
        }
        
        const searchData = await searchResponse.json();
        requestCount++;
        
        if (searchData.error) {
          console.error(`키워드 "${keyword}" API 오류:`, searchData.error);
          continue;
        }
        
        if (!searchData.items || searchData.items.length === 0) {
          console.log(`키워드 "${keyword}" 검색 결과 없음`);
          continue;
        }
        
        // 비디오 ID 추출
        const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
        
        // 비디오 상세 정보 조회
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiConfig.youtubeApiKey}`;
        
        const videosResponse = await fetch(videosUrl);
        
        if (!videosResponse.ok) {
          console.error(`키워드 "${keyword}" 비디오 정보 오류:`, videosResponse.status);
          continue;
        }
        
        const videosData = await videosResponse.json();
        requestCount++;
          
          if (videosData.error) {
            console.error(`키워드 "${keyword}" 비디오 API 오류:`, videosData.error);
            continue;
          }
          
          // 조회수 필터링
          const filteredVideos = videosData.items.filter((video: any) => {
            const viewCount = parseInt(video.statistics?.viewCount || '0');
            return viewCount >= minViewCount;
          });
          
          console.log(`키워드 "${keyword}" 조회수 필터링: ${videosData.items.length}개 → ${filteredVideos.length}개 (${minViewCount.toLocaleString()}회 이상)`);
          
          if (filteredVideos.length === 0) {
            console.log(`키워드 "${keyword}" 조회수 필터링 후 결과 없음 (${minViewCount.toLocaleString()}회 이상)`);
            continue;
          }
          
          allVideos = [...allVideos, ...filteredVideos];
          totalCollected += videosData.items.length;
          
          console.log(`키워드 "${keyword}" 수집: ${filteredVideos.length}개 영상 추가 (총 ${allVideos.length}개)`);
          
          // 요청 간 지연
          await new Promise(resolve => setTimeout(resolve, 500)); // API 할당량 보호를 위해 지연 시간 증가
          
        } catch (error) {
          console.error(`키워드 "${keyword}" 수집 오류:`, error);
          continue;
        }
      }
      
      console.log(`키워드 수집 완료: 총 ${allVideos.length}개 영상 수집 (조회수 ${minViewCount.toLocaleString()}회 이상)`);
      
      // 중복 제거 적용 (videoId 기준으로 고유성 보장)
      const seen = new Set<string>();
      const uniqueVideos = [];
      const duplicates = [];
      
      allVideos.forEach(video => {
        const videoId = video.id;
        if (videoId && !seen.has(videoId)) {
          seen.add(videoId);
          uniqueVideos.push(video);
        } else {
          duplicates.push(video);
        }
      });
      
      console.log(`🔄 키워드 수집 중복 제거: ${allVideos.length}개 → ${uniqueVideos.length}개 (${duplicates.length}개 중복 제거됨)`);
      
      // 키워드 수집 통계 출력
      console.log('=== 키워드 수집 통계 ===');
      console.log(`전체 수집: ${totalCollected}개 영상`);
      console.log(`조회수 ${minViewCount.toLocaleString()}회 이상: ${allVideos.length}개 영상`);
      console.log(`중복 제거 후: ${uniqueVideos.length}개 영상`);
      console.log(`필터링 비율: ${((allVideos.length / totalCollected) * 100).toFixed(1)}%`);
      console.log(`중복 제거 비율: ${((duplicates.length / allVideos.length) * 100).toFixed(1)}%`);
      console.log(`API 요청: ${requestCount}번`);
      console.log('========================');

      // 2. 채널 정보 수집 (50개씩 나누어서 요청)
      const channelIds = [...new Set(uniqueVideos.map((video: any) => video.snippet.channelId))];
      let allChannels: any[] = [];
      
      // 채널 ID를 50개씩 나누어서 요청 (YouTube API 제한)
      for (let i = 0; i < channelIds.length; i += 50) {
        const batchChannelIds = channelIds.slice(i, i + 50);
        const channelsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batchChannelIds.join(',')}&key=${apiConfig.youtubeApiKey}`
        );

        if (!channelsResponse.ok) {
          if (channelsResponse.status === 403) {
            console.error('❌ YouTube API 할당량 초과 또는 권한 오류 (403)');
            console.error('해결 방법:');
            console.error('1. YouTube API 할당량 확인');
            console.error('2. API 키 권한 확인');
            console.error('3. 잠시 후 다시 시도');
            throw new Error('YouTube API 할당량 초과 또는 권한 오류 (403). 잠시 후 다시 시도해주세요.');
          }
          throw new Error(`채널 정보 수집 오류: ${channelsResponse.status}`);
        }

        const channelsData = await channelsResponse.json();
        
        if (channelsData.error) {
          throw new Error(channelsData.error.message || '채널 정보 수집 오류');
        }
        
        allChannels = [...allChannels, ...channelsData.items];
        requestCount++; // 채널 정보 요청 카운트
        
        // 진행 상황 표시
        console.log(`채널 정보 수집: ${allChannels.length}/${channelIds.length} 채널 완료`);
        
        // API 할당량을 고려하여 잠시 대기 (지연 시간 증가)
        if (i + 50 < channelIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 100ms → 500ms로 증가
        }
      }

      // 3. 기존 분류된 데이터에서 카테고리 정보 가져오기 (IndexedDB에서)
      let existingClassifiedData: any[] = [];
      try {
        existingClassifiedData = await indexedDBService.loadUnclassifiedData();
        // 분류된 데이터만 필터링
        existingClassifiedData = existingClassifiedData.filter((item: any) => item.status === 'classified');
      } catch (error) {
        console.log('기존 분류 데이터 로드 실패, 새로 시작합니다.');
        existingClassifiedData = [];
      }
      
      const classifiedChannelMap = new Map();
      existingClassifiedData.forEach((item: any) => {
        classifiedChannelMap.set(item.channelId, {
          category: item.category,
          subCategory: item.subCategory
        });
      });
      
      console.log(`기존 분류된 채널: ${classifiedChannelMap.size}개`);
      
      // 5. 데이터 변환 및 저장
      const { getKoreanDateString, getKoreanDateTimeString } = await import('@/lib/utils');
      const today = getKoreanDateString(); // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD 형식)
      console.log('🔥 데이터 수집 날짜 (한국시간):', today);
      console.log('🔥 현재 시간 (한국시간):', new Date(getKoreanDateTimeString()).toLocaleString('ko-KR'));
      console.log('🔥 수집된 영상 개수:', uniqueVideos.length);
      const newData = uniqueVideos.map((video: any, index: number) => {
        const channel = allChannels.find((ch: any) => ch.id === video.snippet.channelId);
        const existingClassification = classifiedChannelMap.get(video.snippet.channelId);
        
        return {
          id: Date.now() + index,
          channelId: video.snippet.channelId,
          channelName: video.snippet.channelTitle,
          description: channel?.snippet?.description || "설명 없음",
          videoId: video.id,
          videoTitle: video.snippet.title,
          videoDescription: video.snippet.description,
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          uploadDate: video.snippet.publishedAt.split('T')[0],
          collectionDate: today, // 🔥 수집일 추가
          thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '', // 🔥 썸네일 URL 추가
          category: existingClassification?.category || "",
          subCategory: existingClassification?.subCategory || "",
          status: existingClassification ? "classified" as const : "unclassified" as const
        };
      });

      // 5. 기존 데이터와 새 데이터를 합쳐서 저장 (누적 저장)
      try {
        // 기존 데이터 로드
        const existingData = await indexedDBService.loadUnclassifiedData();
        
        // 분류된 데이터를 우선적으로 보존하는 중복 제거 로직
        const videoIdMap = new Map();
        
        // 1단계: 기존 데이터를 먼저 추가 (분류된 데이터 우선)
        existingData.forEach(item => {
          videoIdMap.set(item.videoId, item);
        });
        
        // 2단계: 새 데이터 추가 (기존에 없는 videoId만)
        newData.forEach(item => {
          if (!videoIdMap.has(item.videoId)) {
            videoIdMap.set(item.videoId, item);
          } else {
            // 기존 데이터가 분류되지 않은 상태이고 새 데이터가 분류된 상태라면 업데이트
            const existing = videoIdMap.get(item.videoId);
            if (existing.status === 'unclassified' && item.status === 'classified') {
              videoIdMap.set(item.videoId, item);
            }
          }
        });
        
        const finalData = Array.from(videoIdMap.values());
        
        console.log(`데이터 누적: 기존 ${existingData.length}개 + 새 ${newData.length}개 = 총 ${finalData.length}개`);
        console.log(`분류 보존: 기존 분류된 데이터 우선 보존`);
        
        // IndexedDB에 저장
        await indexedDBService.saveUnclassifiedData(finalData);
      } catch (error) {
        console.error('IndexedDB 저장 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
      }

      const newChannels = newData.filter(item => !classifiedChannelMap.has(item.channelId)).length;
      const autoClassified = newData.filter(item => classifiedChannelMap.has(item.channelId)).length;

      // 키워드 수집 통계를 알림 메시지에 포함
      const totalApiRequests = requestCount;
      const estimatedUnits = totalApiRequests * 100; // search API는 100 units
      const filterRatio = totalCollected > 0 ? ((allVideos.length / totalCollected) * 100).toFixed(1) : '0';
      
      alert(`키워드 기반 데이터 수집이 완료되었습니다!\n\n수집 방식: search API (키워드 기반)\n전체 수집: ${totalCollected}개 영상\n조회수 ${minViewCount.toLocaleString()}회 이상: ${allVideos.length}개 영상\n필터링 비율: ${filterRatio}%\n중복 제거 후: ${uniqueVideos.length}개\n총 수집된 채널: ${newData.length}개\n새로운 채널: ${newChannels}개 (분류 필요)\n자동 분류된 채널: ${autoClassified}개 (이미 분류된 채널)\n\n=== 키워드 수집 통계 ===\nAPI 요청: ${totalApiRequests}번\n할당량 사용: 약 ${estimatedUnits} units\n\n데이터 분류 관리 페이지에서 분류 작업을 진행하세요.`);
    } catch (error) {
      console.error('데이터 수집 오류:', error);
      alert('데이터 수집 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : error));
    }
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          setApiConfig(config.apiConfig);
          setDbConfig(config.dbConfig);
          setSystemConfig(config.systemConfig);
          alert('설정이 가져와졌습니다!');
        } catch (error) {
          alert('설정 파일 형식이 올바르지 않습니다.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">YT</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-pink-300 to-red-600 bg-clip-text text-transparent">
                  YouTube Pulse
                </h1>
                <p className="text-gray-300 text-sm">실시간 유튜브 트렌드 분석 플랫폼</p>
              </div>
            </Link>

            {/* Navigation Buttons */}
            <div className="flex items-center space-x-3">
              <Link to="/dashboard">
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  국내
                </Button>
              </Link>
              <Button 
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                시스템
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* 페이지 헤더 */}
                  <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">시스템 설정</h1>
              <p className="text-muted-foreground">데이터 연동 및 시스템 설정을 관리합니다</p>
              <p className="text-xs text-muted-foreground mt-1">
                저장 기준: IndexedDB · 조회수 조건: 50,000회 이상 · 보관 기간: 14일 · 자동 정리: 활성화
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleStartDataCollection}
              >
                <Play className="w-4 h-4 mr-2" />
                데이터 수집 시작
              </Button>
              <Button variant="outline" onClick={exportConfig}>
                <Download className="w-4 h-4 mr-2" />
                설정 내보내기
              </Button>
              <Button variant="outline" asChild>
                <label htmlFor="import-config">
                  <Upload className="w-4 h-4 mr-2" />
                  설정 가져오기
                </label>
              </Button>
              <input
                id="import-config"
                type="file"
                accept=".json"
                onChange={importConfig}
                className="hidden"
              />
              <Button onClick={saveConfig}>
                <Save className="w-4 h-4 mr-2" />
                설정 저장
              </Button>
              <Link to="/data-classification">
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  데이터 분류 관리
                </Button>
              </Link>
            </div>
          </div>

                                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 첫 번째 행 */}
                    <Card className="p-6 h-96">
                      <div className="flex items-center space-x-2 mb-4">
                        <Globe className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold text-foreground">API 설정</h2>
                      </div>
                      
                      <div className="space-y-4">
                        {/* YouTube API */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">YouTube Data API</Label>
                            <Switch
                              checked={apiConfig.youtubeApiEnabled}
                              onCheckedChange={(checked) => 
                                setApiConfig(prev => ({ ...prev, youtubeApiEnabled: checked }))
                              }
                            />
                          </div>
                          {apiConfig.youtubeApiEnabled && (
                            <div className="space-y-2">
                              <Label htmlFor="youtube-api-key">API 키</Label>
                              <div className="flex space-x-2">
                                <Input
                                  id="youtube-api-key"
                                  type="password"
                                  placeholder="YouTube Data API 키를 입력하세요"
                                  value={apiConfig.youtubeApiKey}
                                  onChange={(e) => 
                                    setApiConfig(prev => ({ ...prev, youtubeApiKey: e.target.value }))
                                  }
                                  className="flex-1"
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={testYouTubeAPI}
                                  disabled={!apiConfig.youtubeApiKey || youtubeApiStatus === 'testing'}
                                >
                                  <TestTube className="w-4 h-4 mr-1" />
                                  {youtubeApiStatus === 'testing' ? '테스트 중...' : '테스트'}
                                </Button>
                              </div>
                              
                              {/* API 테스트 결과 */}
                              {youtubeApiStatus !== 'idle' && (
                                <div className={`p-2 rounded-lg text-sm ${
                                  youtubeApiStatus === 'success' 
                                    ? 'bg-green-50 border border-green-200 text-green-800' 
                                    : youtubeApiStatus === 'error'
                                    ? 'bg-red-50 border border-red-200 text-red-800'
                                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                                }`}>
                                  <div className="flex items-center space-x-2">
                                    {youtubeApiStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                                    {youtubeApiStatus === 'error' && <XCircle className="w-4 h-4" />}
                                    {youtubeApiStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>{youtubeApiMessage}</span>
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  <ExternalLink className="w-3 h-3 inline mr-1" />
                                  <a 
                                    href="https://console.cloud.google.com/apis/credentials" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    Google Cloud Console에서 API 키 발급받기
                                  </a>
                                </p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <h4 className="text-sm font-medium text-blue-800 mb-2">API 키 발급 방법:</h4>
                                  <ol className="text-xs text-blue-700 space-y-1">
                                    <li>1. <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a>에 로그인</li>
                                    <li>2. 새 프로젝트 생성 또는 기존 프로젝트 선택</li>
                                    <li>3. <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline">YouTube Data API v3</a> 활성화</li>
                                    <li>4. <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">사용자 인증 정보</a>에서 API 키 생성</li>
                                    <li>5. 생성된 API 키를 위에 입력</li>
                                  </ol>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 커스텀 API */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">커스텀 API</Label>
                            <Switch
                              checked={apiConfig.customApiEnabled}
                              onCheckedChange={(checked) => 
                                setApiConfig(prev => ({ ...prev, customApiEnabled: checked }))
                              }
                            />
                          </div>
                          {apiConfig.customApiEnabled && (
                            <div className="space-y-2">
                              <Label htmlFor="custom-api-url">API URL</Label>
                              <Input
                                id="custom-api-url"
                                placeholder="https://api.example.com"
                                value={apiConfig.customApiUrl}
                                onChange={(e) => 
                                  setApiConfig(prev => ({ ...prev, customApiUrl: e.target.value }))
                                }
                              />
                              <Label htmlFor="custom-api-key">API 키</Label>
                              <Input
                                id="custom-api-key"
                                type="password"
                                placeholder="API 키를 입력하세요"
                                value={apiConfig.customApiKey}
                                onChange={(e) => 
                                  setApiConfig(prev => ({ ...prev, customApiKey: e.target.value }))
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* PostgreSQL 설정 */}
                    <Card className="p-6 h-96">
                      <div className="flex items-center space-x-2 mb-4">
                        <Database className="w-5 h-5 text-green-600" />
                        <h2 className="text-xl font-semibold text-foreground">PostgreSQL 설정</h2>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="db-host">호스트</Label>
                            <Input
                              id="db-host"
                              placeholder="localhost"
                              value={dbConfig.host}
                              onChange={(e) => 
                                setDbConfig(prev => ({ ...prev, host: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="db-port">포트</Label>
                            <Input
                              id="db-port"
                              placeholder="5432"
                              value={dbConfig.port}
                              onChange={(e) => 
                                setDbConfig(prev => ({ ...prev, port: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="db-name">데이터베이스명</Label>
                          <Input
                            id="db-name"
                            placeholder="youtubepulse"
                            value={dbConfig.database}
                            onChange={(e) => 
                              setDbConfig(prev => ({ ...prev, database: e.target.value }))
                            }
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="db-username">사용자명</Label>
                            <Input
                              id="db-username"
                              placeholder="postgres"
                              value={dbConfig.username}
                              onChange={(e) => 
                                setDbConfig(prev => ({ ...prev, username: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="db-password">비밀번호</Label>
                            <Input
                              id="db-password"
                              type="password"
                              placeholder="비밀번호"
                              value={dbConfig.password}
                              onChange={(e) => 
                                setDbConfig(prev => ({ ...prev, password: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <Button onClick={testConnection} disabled={connectionStatus === 'testing'}>
                          {connectionStatus === 'testing' ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4 mr-2" />
                          )}
                          연결 테스트
                        </Button>

                        {testMessage && (
                          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                            connectionStatus === 'success' ? 'bg-green-50 text-green-800' :
                            connectionStatus === 'error' ? 'bg-red-50 text-red-800' :
                            'bg-blue-50 text-blue-800'
                          }`}>
                            {connectionStatus === 'success' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : connectionStatus === 'error' ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                            <span className="text-sm">{testMessage}</span>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* 두 번째 행 */}
                    {/* Redis 설정 */}
                    <Card className="p-6 h-96">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="w-5 h-5 bg-red-600 rounded flex items-center justify-center">
                          <span className="text-white text-xs font-bold">R</span>
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">Redis 설정</h2>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="redis-host">호스트</Label>
                            <Input
                              id="redis-host"
                              placeholder="localhost"
                              value={redisConfig.host}
                              onChange={(e) => 
                                setRedisConfig(prev => ({ ...prev, host: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="redis-port">포트</Label>
                            <Input
                              id="redis-port"
                              placeholder="6379"
                              value={redisConfig.port}
                              onChange={(e) => 
                                setRedisConfig(prev => ({ ...prev, port: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="redis-password">비밀번호</Label>
                            <Input
                              id="redis-password"
                              type="password"
                              placeholder="비밀번호 (선택사항)"
                              value={redisConfig.password}
                              onChange={(e) => 
                                setRedisConfig(prev => ({ ...prev, password: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="redis-database">데이터베이스</Label>
                            <Input
                              id="redis-database"
                              type="number"
                              min="0"
                              max="15"
                              placeholder="0"
                              value={redisConfig.database}
                              onChange={(e) => 
                                setRedisConfig(prev => ({ ...prev, database: parseInt(e.target.value) }))
                              }
                            />
                          </div>
                        </div>

                        <Button onClick={testRedisConnection} disabled={redisConnectionStatus === 'testing'}>
                          {redisConnectionStatus === 'testing' ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4 mr-2" />
                          )}
                          연결 테스트
                        </Button>

                        {redisTestMessage && (
                          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                            redisConnectionStatus === 'success' ? 'bg-green-50 text-green-800' :
                            redisConnectionStatus === 'error' ? 'bg-red-50 text-red-800' :
                            'bg-blue-50 text-blue-800'
                          }`}>
                            {redisConnectionStatus === 'success' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : redisConnectionStatus === 'error' ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                            <span className="text-sm">{redisTestMessage}</span>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* 시스템 설정 */}
                    <Card className="p-6 h-96">
                      <div className="flex items-center space-x-2 mb-4">
                        <Settings className="w-5 h-5 text-purple-600" />
                        <h2 className="text-xl font-semibold text-foreground">시스템 설정</h2>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="refresh-interval">데이터 새로고침 간격 (초)</Label>
                          <Input
                            id="refresh-interval"
                            type="number"
                            min="60"
                            max="3600"
                            value={systemConfig.dataRefreshInterval}
                            onChange={(e) => 
                              setSystemConfig(prev => ({ ...prev, dataRefreshInterval: parseInt(e.target.value) }))
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            최소 60초, 최대 3600초 (1시간)
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="retry-attempts">최대 재시도 횟수</Label>
                          <Input
                            id="retry-attempts"
                            type="number"
                            min="1"
                            max="10"
                            value={systemConfig.maxRetryAttempts}
                            onChange={(e) => 
                              setSystemConfig(prev => ({ ...prev, maxRetryAttempts: parseInt(e.target.value) }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">자동 동기화</Label>
                          <Switch
                            checked={systemConfig.enableAutoSync}
                            onCheckedChange={(checked) => 
                              setSystemConfig(prev => ({ ...prev, enableAutoSync: checked }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">알림 활성화</Label>
                          <Switch
                            checked={systemConfig.enableNotifications}
                            onCheckedChange={(checked) => 
                              setSystemConfig(prev => ({ ...prev, enableNotifications: checked }))
                            }
                          />
                        </div>
                      </div>
                    </Card>

                    {/* 연동 상태 */}
                    <Card className="p-6 h-96">
                      <div className="flex items-center space-x-2 mb-4">
                        <Key className="w-5 h-5 text-orange-600" />
                        <h2 className="text-xl font-semibold text-foreground">연동 상태</h2>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              apiConfig.youtubeApiEnabled ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-sm font-medium">YouTube API</span>
                          </div>
                          <Badge variant={apiConfig.youtubeApiEnabled ? "default" : "secondary"}>
                            {apiConfig.youtubeApiEnabled ? "연결됨" : "연결 안됨"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              connectionStatus === 'success' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-sm font-medium">PostgreSQL</span>
                          </div>
                          <Badge variant={connectionStatus === 'success' ? "default" : "secondary"}>
                            {connectionStatus === 'success' ? "연결됨" : "연결 안됨"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              redisConnectionStatus === 'success' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-sm font-medium">Redis</span>
                          </div>
                          <Badge variant={redisConnectionStatus === 'success' ? "default" : "secondary"}>
                            {redisConnectionStatus === 'success' ? "연결됨" : "연결 안됨"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              apiConfig.customApiEnabled ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-sm font-medium">커스텀 API</span>
                          </div>
                          <Badge variant={apiConfig.customApiEnabled ? "default" : "secondary"}>
                            {apiConfig.customApiEnabled ? "연결됨" : "연결 안됨"}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-sm font-medium">IndexedDB</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="default">연결됨</Badge>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={loadDatabaseInfo}
                              disabled={isLoadingDbInfo}
                            >
                              {isLoadingDbInfo ? '로딩...' : '정보'}
                            </Button>
                          </div>
                        </div>

                        {dbInfo && (
                          <div className="p-3 rounded-lg bg-blue-600 text-white">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium">IndexedDB 정보</h4>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={handleCleanupOldData}
                                className="text-xs"
                              >
                                🧹 14일 정리
                              </Button>
                            </div>
                            <div className="text-xs space-y-1">
                              <div>데이터베이스: {dbInfo.name}</div>
                              <div>버전: {dbInfo.version}</div>
                              <div>저장소: {dbInfo.objectStores.join(', ')}</div>
                              <div>총 데이터: {dbInfo.size}개</div>
                              <div>보존 기간: {dbInfo.retentionDays}일</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* 세부카테고리 마이그레이션 */}
                  <div className="col-span-1">
                    <Card className="p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Database className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-foreground">세부카테고리 마이그레이션</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">마이그레이션 상태</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={checkMigration}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              새로고침
                            </Button>
                          </div>
                          {migrationStatus ? (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center space-x-2">
                                {migrationStatus.hasDynamicCategories ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                    <span className="text-green-600">동적 카테고리 활성화됨</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 text-red-500" />
                                    <span className="text-red-600">하드코딩된 카테고리 사용 중</span>
                                  </>
                                )}
                              </div>
                              {migrationStatus.savedCategories && (
                                <div>저장된 카테고리: {Object.keys(migrationStatus.savedCategories).length}개</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">상태 확인 중...</div>
                          )}
                        </div>

                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <div className="text-sm text-blue-800 mb-2">
                            <strong>마이그레이션이 필요한 경우:</strong>
                          </div>
                          <ul className="text-xs text-blue-700 space-y-1">
                            <li>• 기존 하드코딩된 세부카테고리를 동적으로 변경하고 싶을 때</li>
                            <li>• 카테고리 관리 페이지에서 세부카테고리를 수정했을 때</li>
                            <li>• 모든 페이지에서 새로운 카테고리가 반영되지 않을 때</li>
                          </ul>
                        </div>

                        <Button 
                          onClick={handleMigration}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          disabled={migrationStatus?.hasDynamicCategories}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          {migrationStatus?.hasDynamicCategories ? '마이그레이션 완료' : '세부카테고리 마이그레이션 실행'}
                        </Button>
                      </div>
                    </Card>
                  </div>
           
       </div>
    </div>
  );
};

export default System;
