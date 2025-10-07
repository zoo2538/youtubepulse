import React, { useState, useEffect } from "react";
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
  Play,
  Users,
  Trash2,
  HardDrive
} from "lucide-react";
import DataCollectionManager from "@/components/DataCollectionManager";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { dataMigrationService } from "@/lib/data-migration-service";
import { autoClassificationService } from "@/lib/auto-classification-service";
import { loadCollectionConfig, EXPANDED_KEYWORDS } from "@/lib/data-collection-config";
import { getKoreanDateString, getKoreanDateTimeString } from "@/lib/utils";
import { CacheCleanup } from "@/lib/cache-cleanup";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface ApiConfig {
  youtubeApiKey: string;
  youtubeApiEnabled: boolean;
  customApiUrl: string;
  customApiEnabled: boolean;
  customApiKey: string;
}

// PostgreSQL과 Redis 설정 인터페이스 제거 - 서버에서 자동 관리

interface SystemConfig {
  dataRefreshInterval: number;
  maxRetryAttempts: number;
  enableAutoSync: boolean;
  enableNotifications: boolean;
}

const System = () => {
  const { userRole, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    // localStorage에서 저장된 설정 불러오기
    const savedApiKey = localStorage.getItem('youtubeApiKey') || '';
    const savedCustomApiUrl = localStorage.getItem('customApiUrl') || 'https://api.youthbepulse.com';
    const savedCustomApiEnabled = localStorage.getItem('customApiEnabled') === 'true';
    const savedCustomApiKey = localStorage.getItem('customApiKey') || '';
    
    // 기본값: 커스텀 API 비활성화 (Railway 서버 문제로 인해)
    const defaultCustomApiEnabled = savedCustomApiEnabled !== null ? savedCustomApiEnabled : false;
    
    console.log('🔧 설정 로드:', {
      youtubeApiKey: savedApiKey ? '설정됨' : '미설정',
      customApiUrl: savedCustomApiUrl,
      customApiEnabled: defaultCustomApiEnabled,
      customApiKey: savedCustomApiKey ? '설정됨' : '미설정'
    });
    
    return {
      youtubeApiKey: savedApiKey,
      youtubeApiEnabled: !!savedApiKey,
      customApiUrl: savedCustomApiUrl,
      customApiEnabled: defaultCustomApiEnabled,
      customApiKey: savedCustomApiKey
    };
  });

  // PostgreSQL과 Redis 설정 제거 - Railway와 서버에서 자동 관리

  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    dataRefreshInterval: 300,
    maxRetryAttempts: 3,
    enableAutoSync: true,
    enableNotifications: true
  });

  // 데이터 마이그레이션 상태
  const [migrationStatus, setMigrationStatus] = useState<{
    indexeddbData: {
      channels: number;
      videos: number;
      classificationData: number;
    };
    canMigrate: boolean;
  }>({
    indexeddbData: { channels: 0, videos: 0, classificationData: 0 },
    canMigrate: false
  });

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
    migratedData: {
      channels: number;
      videos: number;
      classificationData: number;
    };
  } | null>(null);

  // 캐시 정리 상태
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheCleanupResult, setCacheCleanupResult] = useState<{
    serviceWorker: boolean;
    cache: boolean;
    localStorage: boolean;
  } | null>(null);


  const [dbInfo, setDbInfo] = useState<any>(null);
  const [isLoadingDbInfo, setIsLoadingDbInfo] = useState(false);

  // 관리자 권한 체크 (임시 비활성화 - 디버깅용)
  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail');
    const storedRole = localStorage.getItem('userRole');
    
    console.log('🔍 System 페이지 권한 체크 (상세):', { 
      isLoggedIn, 
      userRole, 
      userEmail,
      storedRole,
      localStorage_userEmail: localStorage.getItem('userEmail'),
      localStorage_userRole: localStorage.getItem('userRole')
    });
    
    // 로그인만 확인하고 모든 사용자 허용
    if (!isLoggedIn) {
      console.log('❌ 로그인되지 않음 - 로그인 페이지로 리다이렉트');
      navigate('/login');
      return;
    }
    
    console.log('✅ 로그인 확인됨 - System 페이지 접근 허용 (모든 로그인 사용자 허용)');
    
    // 원래 코드 (주석 처리)
    // if (userRole !== 'admin') {
    //   console.log('❌ 관리자 권한 없음 - 대시보드로 리다이렉트');
    //   console.log('현재 userRole:', userRole);
    //   console.log('localStorage userRole:', storedRole);
    //   
    //   // 관리자 이메일이면 강제로 통과 (임시)
    //   if (userEmail === 'ju9511503@gmail.com' || storedRole === 'admin') {
    //     console.log('✅ 관리자 이메일 확인됨 - 강제 통과');
    //     return;
    //   }
    //   
    //   navigate('/dashboard');
    // } else {
    //   console.log('✅ 관리자 권한 확인 완료 - System 페이지 접근 허용');
    // }
  }, [isLoggedIn, userRole, navigate]);

  // 페이지 로드 시 IndexedDB 정보 로드
  React.useEffect(() => {
    loadDatabaseInfo();
    loadMigrationStatus();
    
    // 커스텀 API가 처음 사용되는 경우 기본값으로 설정
    if (localStorage.getItem('customApiEnabled') === null) {
      localStorage.setItem('customApiEnabled', 'false'); // Railway 서버 문제로 비활성화
      localStorage.setItem('customApiUrl', 'https://api.youthbepulse.com');
      console.log('🔧 커스텀 API 기본값 설정 완료 (Railway 서버 문제로 비활성화)');
    }
  }, []);

  // API 설정 자동 저장
  useEffect(() => {
    const saveApiConfig = () => {
      try {
        localStorage.setItem('youtubeApiKey', apiConfig.youtubeApiKey || '');
        localStorage.setItem('customApiUrl', apiConfig.customApiUrl || '');
        localStorage.setItem('customApiEnabled', apiConfig.customApiEnabled.toString());
        localStorage.setItem('customApiKey', apiConfig.customApiKey || '');
        localStorage.setItem('youtubeApiEnabled', apiConfig.youtubeApiEnabled.toString());
        localStorage.setItem('systemConfig', JSON.stringify(systemConfig));
      } catch (error) {
        console.error('설정 자동 저장 오류:', error);
      }
    };

    // 설정이 변경될 때마다 자동 저장 (500ms 지연으로 과도한 저장 방지)
    const timeoutId = setTimeout(saveApiConfig, 500);
    
    return () => clearTimeout(timeoutId);
  }, [apiConfig, systemConfig]);

  // 마이그레이션 상태 로드
  const loadMigrationStatus = async () => {
    try {
      const status = await dataMigrationService.getMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('마이그레이션 상태 로드 실패:', error);
    }
  };

  // 데이터 동기화 실행
  const handleDataSync = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    
    try {
      const result = await dataMigrationService.migrateAllDataToPostgreSQL();
      setMigrationResult(result);
      
      if (result.success) {
        // 성공 시 상태 업데이트
        await loadMigrationStatus();
      }
    } catch (error) {
      setMigrationResult({
        success: false,
        message: `동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        migratedData: { channels: 0, videos: 0, classificationData: 0 }
      });
    } finally {
      setIsMigrating(false);
    }
  };



  const [apiConnectionStatus, setApiConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiTestMessage, setApiTestMessage] = useState('');
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

  // 캐시 정리 핸들러
  const handleCacheCleanup = async () => {
    if (window.confirm('브라우저 캐시와 서비스워커를 정리하시겠습니까?\n\n이 작업은 페이지 새로고침을 유발할 수 있습니다.')) {
      setIsClearingCache(true);
      setCacheCleanupResult(null);
      
      try {
        const result = await CacheCleanup.fullCleanup();
        setCacheCleanupResult(result);
        
        if (result.serviceWorker || result.cache) {
          alert('캐시 정리가 완료되었습니다!\n\n페이지를 새로고침하여 변경사항을 적용하세요.');
        } else {
          alert('정리할 캐시가 없습니다.');
        }
      } catch (error) {
        console.error('캐시 정리 오류:', error);
        alert('캐시 정리 중 오류가 발생했습니다.');
      } finally {
        setIsClearingCache(false);
      }
    }
  };

  // 강력한 새로고침 핸들러
  const handleHardRefresh = () => {
    if (window.confirm('강력한 새로고침을 실행하시겠습니까?\n\n모든 캐시가 무효화되고 페이지가 새로고침됩니다.')) {
      CacheCleanup.hardRefresh();
    }
  };



  // PostgreSQL과 Redis 연결 테스트 함수 제거 - 서버에서 자동 관리

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

  const testApiConnection = async () => {
    setApiConnectionStatus('testing');
    setApiTestMessage('API 서버를 테스트하고 있습니다...');

    try {
      if (!apiConfig.customApiUrl) {
        throw new Error('API 서버 URL이 설정되지 않았습니다.');
      }

      // API 서버 연결 테스트
      const response = await fetch(`${apiConfig.customApiUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API 서버 연결 실패: ${response.status}`);
      }

      const data = await response.json();
      setApiConnectionStatus('success');
      setApiTestMessage(`API 서버 연결 성공! 서버 상태: ${data.status || 'OK'}`);
    } catch (error) {
      setApiConnectionStatus('error');
      setApiTestMessage(error instanceof Error ? error.message : '알 수 없는 오류');
    }
  };


  const exportConfig = () => {
    const config = { apiConfig, systemConfig };
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

      // 자동 수집 중인지 확인
      if (window.autoCollectionInProgress) {
        alert('⚠️ 자동 수집이 진행 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      // 수동 수집 시작 플래그 설정
      window.manualCollectionInProgress = true;

      const collectionConfig = loadCollectionConfig();
      const maxVideos = 10000;
      let requestCount = 0;
      
      console.log('=== 🔥 혼합 데이터 수집 시작 ===');
      console.log('수집 방식: YouTube 트렌드 + 키워드 기반');
      console.log('조회수 필터: 제거됨 (조회수 상위만 선택)');
      console.log('=====================================');

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 1단계: YouTube 공식 트렌드 수집 (상위 200개)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('📺 1단계: YouTube 공식 트렌드 영상 수집 중...');
      let trendingVideos: any[] = [];
      
      try {
        // 상위 200개 수집 (50개씩 4페이지)
        let nextPageToken = '';
        for (let page = 0; page < 4; page++) {
          const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}&key=${apiConfig.youtubeApiKey}`;
          const trendingResponse = await fetch(trendingUrl);
          
          if (trendingResponse.ok) {
            const trendingData = await trendingResponse.json();
            requestCount++;
            
            if (trendingData.items) {
              trendingVideos = [...trendingVideos, ...trendingData.items];
              console.log(`✅ 트렌드 영상 ${(page + 1) * 50}개 수집 중... (현재: ${trendingVideos.length}개)`);
              
              nextPageToken = trendingData.nextPageToken;
              if (!nextPageToken) break; // 더 이상 페이지 없음
            }
          } else {
            console.warn('⚠️ 트렌드 영상 수집 실패, 키워드 수집만 진행');
            break;
          }
          
          // API 요청 간 지연
          if (page < 3) await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`✅ 트렌드 영상 총 ${trendingVideos.length}개 수집 완료`);
        
        // 한글 필터링 적용 (한국어 영상만)
        if (collectionConfig.koreanOnly) {
          const beforeFilter = trendingVideos.length;
          trendingVideos = trendingVideos.filter(video => {
            const title = video.snippet?.title || '';
            const channelName = video.snippet?.channelTitle || '';
            const hasKorean = /[가-힣]/.test(title) || /[가-힣]/.test(channelName);
            return hasKorean;
          });
          console.log(`🇰🇷 한글 필터링: ${beforeFilter}개 → ${trendingVideos.length}개 (${beforeFilter - trendingVideos.length}개 제거)`);
        }
      } catch (error) {
        console.error('❌ 트렌드 영상 수집 오류:', error);
        console.log('⚠️ 키워드 수집만 진행합니다.');
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 2단계: 키워드 기반 영상 수집
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('🔍 2단계: 키워드 기반 영상 수집 중...');
      const keywords = collectionConfig.keywords || EXPANDED_KEYWORDS;
      let keywordVideos: any[] = [];
      let totalCollected = 0;
      
      for (const keyword of keywords) {
        if (keywordVideos.length >= maxVideos) {
          console.log(`최대 수집 수(${maxVideos}) 도달`);
          break;
        }
        
        try {
          console.log(`키워드 "${keyword}" 수집 시작...`);
          
          // 키워드로 검색 (조회수 순 상위 50개)
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&regionCode=KR&order=viewCount&key=${apiConfig.youtubeApiKey}`;
        
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
          
          // 조회수 필터링 제거 - 모든 결과 추가
          const videos = videosData.items || [];
          keywordVideos = [...keywordVideos, ...videos];
          totalCollected += videos.length;
          
          console.log(`키워드 "${keyword}" 수집: ${videos.length}개 영상 추가 (총 ${keywordVideos.length}개)`);
          
          // 요청 간 지연
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`키워드 "${keyword}" 수집 오류:`, error);
          continue;
        }
      }
      
      console.log(`✅ 키워드 수집 완료: 총 ${keywordVideos.length}개 영상`);
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 3단계: 트렌드 + 키워드 영상 합치기
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('🔄 3단계: 트렌드 + 키워드 영상 합치기 및 중복 제거...');
      
      const allVideos = [...trendingVideos, ...keywordVideos];
      
      // 중복 제거 로직 제거 - 모든 영상을 독립적으로 처리
      const uniqueVideos = allVideos;
      
      console.log(`🔄 모든 영상 유지: ${allVideos.length}개 영상 (중복 제거 없음, 각 영상 독립 처리)`);
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 4단계: 조회수 순 정렬
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      uniqueVideos.sort((a, b) => {
        const viewsA = parseInt(a.statistics?.viewCount || '0');
        const viewsB = parseInt(b.statistics?.viewCount || '0');
        return viewsB - viewsA; // 내림차순 (높은 조회수가 앞으로)
      });
      
      console.log(`📊 조회수 정렬 완료 (최고: ${parseInt(uniqueVideos[0]?.statistics?.viewCount || '0').toLocaleString()}회, 최저: ${parseInt(uniqueVideos[uniqueVideos.length - 1]?.statistics?.viewCount || '0').toLocaleString()}회)`);
      
      // 혼합 수집 통계 출력
      console.log('=== 🔥 혼합 수집 통계 ===');
      console.log(`트렌드 영상: ${trendingVideos.length}개`);
      console.log(`키워드 영상: ${keywordVideos.length}개 (${keywords.length}개 키워드)`);
      console.log(`전체 수집: ${allVideos.length}개`);
      console.log(`최종 영상: ${uniqueVideos.length}개`);
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

      // 3. 최근 분류된 데이터에서 카테고리 정보 가져오기 (최근 14일간)
      let existingClassifiedData: any[] = [];
      try {
        const allData = await hybridService.loadUnclassifiedData();
        
        // 최근 14일간의 분류된 데이터만 필터링
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const fourteenDaysAgoString = fourteenDaysAgo.toISOString().split('T')[0];
        
        existingClassifiedData = allData.filter((item: any) => {
          const isClassified = item.status === 'classified';
          const isRecent = item.collectionDate >= fourteenDaysAgoString;
          return isClassified && isRecent;
        });
        
        console.log(`📊 분류 데이터 참조 범위: 최근 14일 (${fourteenDaysAgoString} 이후)`);
        console.log(`📊 전체 분류 데이터: ${allData.filter(item => item.status === 'classified').length}개`);
        console.log(`📊 최근 14일 분류 데이터: ${existingClassifiedData.length}개`);
      } catch (error) {
        console.log('기존 분류 데이터 로드 실패, 새로 시작합니다.');
        existingClassifiedData = [];
      }
      
      const classifiedChannelMap = new Map();
      
      // 채널별로 가장 최근 분류 정보만 사용 (같은 채널의 최신 분류 우선)
      const channelLatestClassification = new Map();
      existingClassifiedData.forEach((item: any) => {
        if (!channelLatestClassification.has(item.channelId) || 
            item.collectionDate > channelLatestClassification.get(item.channelId).collectionDate) {
          channelLatestClassification.set(item.channelId, {
            category: item.category,
            subCategory: item.subCategory,
            collectionDate: item.collectionDate,
            channelName: item.channelName
          });
        }
      });
      
      // 최종 분류 맵 구성
      channelLatestClassification.forEach((classification, channelId) => {
        classifiedChannelMap.set(channelId, {
          category: classification.category,
          subCategory: classification.subCategory
        });
      });
      
      console.log(`📊 분류 참조 채널: ${classifiedChannelMap.size}개`);
      console.log(`📊 분류 참조 기간: 최근 14일간의 최신 분류 정보만 사용`);
      console.log(`🤖 자동 분류 시스템 활성화: 키워드 기반 자동 분류 적용`);
      
      // 5. 기존 데이터 먼저 로드 (날짜 유지를 위해)
      // utils 함수들은 이미 정적 import됨
      const today = getKoreanDateString(); // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD 형식)
      console.log('🔥 데이터 수집 날짜 (한국시간):', today);
      console.log('🔥 현재 시간 (한국시간):', new Date(getKoreanDateTimeString()).toLocaleString('ko-KR'));
      console.log('🔥 수집된 영상 개수:', uniqueVideos.length);
      
      // 기존 데이터 먼저 로드하여 videoId별 기존 날짜 매핑
      const existingDataForDateCheck = await hybridService.loadUnclassifiedData();
      const existingVideoDateMap = new Map();
      existingDataForDateCheck.forEach((item: any) => {
        // 각 videoId의 가장 오래된 collectionDate 저장 (최초 수집일)
        if (!existingVideoDateMap.has(item.videoId)) {
          existingVideoDateMap.set(item.videoId, item.collectionDate);
        } else {
          const existingDate = existingVideoDateMap.get(item.videoId);
          if (item.collectionDate < existingDate) {
            existingVideoDateMap.set(item.videoId, item.collectionDate);
          }
        }
      });
      console.log(`📊 기존 영상 날짜 매핑: ${existingVideoDateMap.size}개 영상의 최초 수집일 확인`);
      
      // 자동 분류 서비스는 이미 정적 import됨
      // 동적 import 실패 시 IndexedDB-only 플로우로 fallback
      
      const newData = uniqueVideos.map((video: any, index: number) => {
        const channel = allChannels.find((ch: any) => ch.id === video.snippet.channelId);
        const existingClassification = classifiedChannelMap.get(video.snippet.channelId);
        
        // 오늘 수집된 모든 영상은 오늘 날짜로 설정 (기존 날짜 유지하지 않음)
        const collectionDate = today;
        
        // 자동 분류 실행
        const autoClassification = autoClassificationService.classifyVideo(
          video.snippet.title,
          video.snippet.description,
          video.snippet.channelTitle
        );
        
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
          collectionDate: collectionDate, // 🔥 오늘 수집된 모든 영상은 오늘 날짜로 설정
          thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || '',
          category: existingClassification?.category || autoClassification.category,
          collectionType: 'manual', // 수동 수집으로 명시
          collectionTimestamp: new Date().toISOString(), // 수집 시간 기록
          collectionSource: 'system_page', // 수집 소스 기록
          subCategory: existingClassification?.subCategory || autoClassification.subCategory,
          status: existingClassification ? "classified" as const : 
                  (autoClassification.confidence > 0.3 ? "classified" as const : "unclassified" as const),
          autoClassified: !existingClassification && autoClassification.confidence > 0.3,
          classificationConfidence: autoClassification.confidence,
          matchedKeywords: autoClassification.matchedKeywords
        };
      });

      // 5. 기존 데이터와 새 데이터를 합쳐서 저장 (누적 저장)
      try {
        // 기존 데이터 로드 (하이브리드)
        const existingData = await hybridService.loadUnclassifiedData();
        
        // 일별 데이터 보존을 위한 중복 제거 로직
        // Key: videoId + collectionDate (같은 영상이라도 날짜가 다르면 별도 보존)
        const videoDateMap = new Map();
        
        // 1단계: 기존 데이터를 먼저 추가 (분류된 데이터 우선)
        existingData.forEach(item => {
          const key = `${item.videoId}_${item.collectionDate}`;
          videoDateMap.set(key, item);
        });
        
        // 2단계: 새 데이터 추가 (오늘 날짜의 영상만 처리, 다른 날짜는 절대 건드리지 않음)
        newData.forEach(item => {
          const key = `${item.videoId}_${item.collectionDate}`;
          
          if (!videoDateMap.has(key)) {
            // 새로운 영상이면 바로 추가
            videoDateMap.set(key, item);
          } else {
            // 같은 날짜의 같은 영상이면 조회수 높은 것만 유지 (오늘 날짜만)
            const existing = videoDateMap.get(key);
            
            // 오늘 날짜의 영상만 처리 (다른 날짜는 절대 건드리지 않음)
            if (item.collectionDate === today) {
              // 조회수 비교: 더 높은 조회수 우선
              if (item.viewCount > existing.viewCount) {
                console.log(`📊 오늘 영상 교체 (조회수 높음): ${item.videoTitle} - ${existing.viewCount?.toLocaleString()} → ${item.viewCount?.toLocaleString()}`);
                videoDateMap.set(key, item);
              } else if (item.viewCount === existing.viewCount) {
                // 조회수가 같으면 분류 상태 우선 (classified > unclassified)
                if (existing.status === 'unclassified' && item.status === 'classified') {
                  console.log(`📊 오늘 영상 교체 (분류됨): ${item.videoTitle} - ${existing.status} → ${item.status}`);
                  videoDateMap.set(key, item);
                }
                // 같은 상태면 기존 데이터 유지
              }
              // 조회수가 낮으면 기존 데이터 유지
            } else {
              // 다른 날짜의 영상은 절대 건드리지 않음 (이미 지난 날짜의 데이터 보존)
              console.log(`📊 다른 날짜 영상 보존: ${item.videoTitle} (${item.collectionDate}) - 이미 지난 날짜, 건드리지 않음`);
            }
          }
        });
        
        const finalData = Array.from(videoDateMap.values());
        
        // 고유한 ID 보장 (강화된 버전)
        const dataWithUniqueIds = finalData.map((item, index) => {
          // ID가 없거나 유효하지 않은 경우 새로운 고유 ID 생성
          if (!item.id || typeof item.id !== 'string') {
            item.id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
          }
          
          // videoId 기반으로도 고유성을 보장
          const videoIdPrefix = item.videoId ? item.videoId.substring(0, 8) : 'unknown';
          const uniqueId = `${videoIdPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          
          return {
            ...item,
            id: item.id || uniqueId
          };
        });
        
        // 최종 중복 ID 검사 및 제거
        const uniqueIdMap = new Map();
        const finalUniqueData = dataWithUniqueIds.filter(item => {
          if (uniqueIdMap.has(item.id)) {
            console.warn(`중복 ID 발견, 제거됨: ${item.id}`);
            return false;
          }
          uniqueIdMap.set(item.id, true);
          return true;
        });
        
        console.log(`📊 일별 데이터 처리 완료:`);
        console.log(`   - 기존 데이터: ${existingData.length}개`);
        console.log(`   - 새 수집 데이터: ${newData.length}개`);
        console.log(`   - 최종 저장 데이터: ${finalUniqueData.length}개`);
        console.log(`   - 일별 데이터 보존: ${finalUniqueData.length - existingData.length}개 추가`);
        console.log(`   - 같은 날짜 중복 업데이트: ${newData.length - (finalUniqueData.length - existingData.length)}개`);
        console.log(`   - 중복 ID 제거: ${dataWithUniqueIds.length - finalUniqueData.length}개`);
        
        // 하이브리드 저장 (IndexedDB + PostgreSQL)
        await hybridService.saveUnclassifiedData(finalUniqueData);
      } catch (error) {
        console.error('IndexedDB 저장 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
      }

      const newChannels = newData.filter(item => !classifiedChannelMap.has(item.channelId)).length;
      const autoClassified = newData.filter(item => classifiedChannelMap.has(item.channelId)).length;

      // 자동 분류 통계
      const autoClassifiedByAI = newData.filter(item => item.autoClassified).length;
      const manualClassified = newData.filter(item => classifiedChannelMap.has(item.channelId)).length;
      const unclassified = newData.filter(item => !item.autoClassified && !classifiedChannelMap.has(item.channelId)).length;
      
      console.log(`🤖 자동 분류 결과:`);
      console.log(`   - AI 자동 분류: ${autoClassifiedByAI}개`);
      console.log(`   - 기존 분류 적용: ${manualClassified}개`);
      console.log(`   - 미분류: ${unclassified}개`);

      // 혼합 수집 통계를 알림 메시지에 포함
      const totalApiRequests = requestCount;
      const estimatedUnits = totalApiRequests * 100;
      const avgViews = uniqueVideos.length > 0 ? 
        Math.round(uniqueVideos.reduce((sum, v) => sum + parseInt(v.statistics?.viewCount || '0'), 0) / uniqueVideos.length) : 0;
      
      alert(`🔥 혼합 데이터 수집이 완료되었습니다!\n\n` +
            `📺 YouTube 트렌드: ${trendingVideos.length}개\n` +
            `🔍 키워드 수집: ${keywordVideos.length}개 (${keywords.length}개 키워드)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📊 전체 수집: ${allVideos.length}개\n` +
            `✅ 중복 제거 후: ${uniqueVideos.length}개\n` +
            `📈 조회수 정렬: 상위부터 저장됨\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎬 총 채널: ${newData.length}개\n` +
            `🆕 새 채널: ${newChannels}개 (분류 필요)\n` +
            `♻️ 기존 분류 적용: ${manualClassified}개\n` +
            `🤖 AI 자동 분류: ${autoClassifiedByAI}개\n` +
            `❓ 미분류: ${unclassified}개\n` +
            `📊 평균 조회수: ${avgViews.toLocaleString()}회\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔧 API 요청: ${totalApiRequests}번\n` +
            `💰 할당량: 약 ${estimatedUnits} units\n\n` +
            `자동 분류된 영상은 이미 분류 완료 상태입니다.\n` +
            `미분류 영상만 수동 분류하면 됩니다.`);
      
      // 수동 수집 완료 플래그 해제
      window.manualCollectionInProgress = false;
    } catch (error) {
      console.error('데이터 수집 오류:', error);
      alert('데이터 수집 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : error));
      
      // 오류 발생 시에도 플래그 해제
      window.manualCollectionInProgress = false;
    }
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          if (config.apiConfig) setApiConfig(config.apiConfig);
          if (config.systemConfig) setSystemConfig(config.systemConfig);
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
              <Link to="/user-management">
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Users className="w-4 h-4 mr-2" />
                  회원관리
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  국내
                </Button>
              </Link>
              <Link to="/data">
                <Button 
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  📊 데이터
                </Button>
              </Link>
              <Button 
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                시스템
              </Button>
              <Link to="/subcategory-settings">
                <Button 
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  세부카테고리
                </Button>
              </Link>
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
                저장 기준: IndexedDB + PostgreSQL (하이브리드) · 수집: 트렌드 + 키워드 혼합 · 정렬: 조회수 상위
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
              <Link to="/data-classification">
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  데이터 분류 관리
                </Button>
              </Link>
            </div>
          </div>

                                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* API 설정 */}
                    <Card className="p-6">
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
                              <div className="flex space-x-2">
                                <Input
                                  id="custom-api-url"
                                  placeholder="https://api.youthbepulse.com"
                                  value={apiConfig.customApiUrl}
                                  onChange={(e) => 
                                    setApiConfig(prev => ({ ...prev, customApiUrl: e.target.value }))
                                  }
                                  className="flex-1"
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={testApiConnection}
                                  disabled={!apiConfig.customApiUrl || apiConnectionStatus === 'testing'}
                                >
                                  <TestTube className="w-4 h-4 mr-1" />
                                  {apiConnectionStatus === 'testing' ? '테스트 중...' : '테스트'}
                                </Button>
                              </div>
                              
                              {/* API 서버 테스트 결과 */}
                              {apiConnectionStatus !== 'idle' && (
                                <div className={`p-2 rounded-lg text-sm ${
                                  apiConnectionStatus === 'success' 
                                    ? 'bg-green-50 border border-green-200 text-green-800' 
                                    : 'bg-red-50 border border-red-200 text-red-800'
                                }`}>
                                  {apiTestMessage}
                                </div>
                              )}
                              
                              <Label htmlFor="custom-api-key">API 키 (선택사항)</Label>
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

                    {/* 시스템 설정 - 간소화 */}
                    <Card className="p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Settings className="w-5 h-5 text-purple-600" />
                        <h2 className="text-xl font-semibold text-foreground">시스템 설정</h2>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 핵심 기능</h4>
                          <p className="text-xs text-blue-700">
                            • 자동 수집 시 키워드 기반 분류 적용<br/>
                            • 14일간 분류 이력 우선 적용<br/>
                            • 하이브리드 저장 (IndexedDB + PostgreSQL)
                          </p>
                          </div>
                      </div>
                    </Card>

                    {/* 데이터 수집 설정 */}
                    <Card className="p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Filter className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-semibold text-foreground">데이터 수집 설정</h2>
                      </div>
                      
                      <div className="space-y-4">
                        {/* 혼합 수집 방식 안내 */}
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg">
                          <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center">
                            <Filter className="w-4 h-4 mr-2" />
                            🔥 혼합 수집 방식
                          </h4>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-white p-2 rounded border border-blue-200">
                              <p className="text-xs text-blue-600 font-medium">📺 트렌드 영상</p>
                              <p className="text-sm font-bold text-blue-900">상위 200개</p>
                              <p className="text-xs text-muted-foreground">YouTube 공식 (한글만)</p>
                          </div>
                            <div className="bg-white p-2 rounded border border-blue-200">
                              <p className="text-xs text-blue-600 font-medium">🔍 키워드 영상</p>
                              <p className="text-sm font-bold text-blue-900">{EXPANDED_KEYWORDS.length}개 × 50개</p>
                              <p className="text-xs text-muted-foreground">조회수 상위</p>
                          </div>
                        </div>

                          {/* 수집 설정 상세 정보 */}
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <h4 className="font-medium text-sm mb-2 text-green-800">수집 설정 상세</h4>
                            <div className="space-y-1 text-xs text-green-700">
                              <div className="flex justify-between">
                                <span>트렌드 수집량:</span>
                                <span className="font-medium">200개 (50개씩 4페이지)</span>
                          </div>
                              <div className="flex justify-between">
                                <span>키워드 수집량:</span>
                                <span className="font-medium">{EXPANDED_KEYWORDS.length * 50}개 ({EXPANDED_KEYWORDS.length}개 키워드 × 50개)</span>
                          </div>
                              <div className="flex justify-between">
                                <span>예상 총 수집량:</span>
                                <span className="font-medium text-green-600">{200 + (EXPANDED_KEYWORDS.length * 50)}개</span>
                        </div>
                              <div className="flex justify-between">
                                <span>중복 제거:</span>
                                <span className="font-medium text-green-600">조회수 높은 것 유지</span>
                          </div>
                      </div>
                      </div>
                      
                          <div className="text-xs text-blue-700 space-y-1 bg-blue-100/50 p-2 rounded">
                            <p>✓ 조회수 높은 순 자동 정렬</p>
                            <p>✓ 중복 시 조회수 높은 것 유지</p>
                            <p>✓ 예상 수집: <strong>약 {Math.floor((200 + (EXPANDED_KEYWORDS.length * 50)) * 0.6).toLocaleString()}~{Math.floor((200 + (EXPANDED_KEYWORDS.length * 50)) * 0.7).toLocaleString()}개</strong> (중복 제거 후)</p>
                        </div>
                        </div>

                        {/* 언어 필터 설정 */}
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium text-yellow-900">🇰🇷 한국어 영상만 수집</Label>
                          <Switch
                            checked={(() => {
                              try {
                                const config = loadCollectionConfig();
                                return config.koreanOnly ?? true;
                              } catch {
                                return true;
                              }
                            })()}
                            onCheckedChange={(checked) => {
                              const config = loadCollectionConfig();
                              config.koreanOnly = checked;
                              localStorage.setItem('youtubepulse_collection_config', JSON.stringify(config));
                            }}
                          />
                        </div>
                          <Select
                            value={(() => {
                              try {
                                const config = loadCollectionConfig();
                                return config.languageFilterLevel || 'moderate';
                              } catch {
                                return 'moderate';
                              }
                            })()}
                            onValueChange={(value: 'strict' | 'moderate' | 'loose') => {
                              const config = loadCollectionConfig();
                              config.languageFilterLevel = value;
                              localStorage.setItem('youtubepulse_collection_config', JSON.stringify(config));
                            }}
                          >
                            <SelectTrigger className="text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="strict">엄격 (제목+설명 모두 한국어)</SelectItem>
                              <SelectItem value="moderate">보통 (제목 또는 채널명 한국어)</SelectItem>
                              <SelectItem value="loose">느슨 (하나라도 한국어 포함)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>

                    {/* 데이터 수집 키워드 목록 */}
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Filter className="w-5 h-5 text-purple-600" />
                          <h2 className="text-xl font-semibold text-foreground">데이터 수집 키워드</h2>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                          총 {EXPANDED_KEYWORDS.length}개
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-sm text-purple-900 mb-2">
                            💡 현재 설정된 키워드 목록입니다. 각 키워드당 50개씩 수집됩니다.
                          </p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {EXPANDED_KEYWORDS.map((keyword, index) => (
                              <Badge 
                                key={index} 
                                variant="outline" 
                                className="bg-white text-purple-700 border-purple-300"
                              >
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="text-xs text-purple-700 bg-purple-100/50 p-2 rounded">
                          <p>✓ 키워드별 조회수 상위 50개 수집</p>
                          <p>✓ 전체 키워드 수집량: {EXPANDED_KEYWORDS.length} × 50 = {EXPANDED_KEYWORDS.length * 50}개</p>
                          <p>✓ 중복 제거 후 최종 수집량: 약 {Math.floor((EXPANDED_KEYWORDS.length * 50) * 0.6).toLocaleString()}~{Math.floor((EXPANDED_KEYWORDS.length * 50) * 0.7).toLocaleString()}개</p>
                        </div>
                      </div>
                    </Card>

                    {/* 연동 상태 */}
                    <Card className="p-6">
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
                              apiConfig.customApiEnabled ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-sm font-medium">커스텀 API</span>
                          </div>
                          <Badge variant={apiConfig.customApiEnabled ? "default" : "secondary"}>
                            {apiConfig.customApiEnabled ? "연결됨" : "연결 안됨"}
                          </Badge>
                        </div>

                        {/* API 상태 상세 정보 */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-sm mb-2 text-blue-800">API 설정 상세</h4>
                          <div className="space-y-1 text-xs text-blue-700">
                            <div className="flex justify-between">
                              <span>YouTube API 키:</span>
                              <span className={apiConfig.youtubeApiKey ? "text-green-600 font-medium" : "text-red-600"}>
                                {apiConfig.youtubeApiKey ? "설정됨" : "미설정"}
                              </span>
                          </div>
                            <div className="flex justify-between">
                              <span>커스텀 API URL:</span>
                              <span className="text-blue-600 font-mono text-xs">{apiConfig.customApiUrl}</span>
                        </div>
                            <div className="flex justify-between">
                              <span>커스텀 API 키:</span>
                              <span className={apiConfig.customApiKey ? "text-green-600 font-medium" : "text-red-600"}>
                                {apiConfig.customApiKey ? "설정됨" : "미설정"}
                              </span>
                          </div>
                          </div>
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

                        <div className="p-3 rounded-lg bg-blue-600 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">IndexedDB 정보</h4>
                          </div>
                          <div className="text-xs space-y-1">
                            <div><strong>데이터베이스:</strong> {dbInfo?.name || 'YouTubePulseDB'}</div>
                            <div><strong>버전:</strong> {dbInfo?.version || '2'}</div>
                            <div><strong>저장소:</strong> {dbInfo?.objectStores?.join(', ') || 'categories, channels, classifiedByDate, classifiedData, dailyProgress, dailySummary, subCategories, systemConfig, unclassifiedData, videos'}</div>
                            <div><strong>총 데이터:</strong> {dbInfo?.size || 0}개</div>
                            <div><strong>보존 기간:</strong> 14일 (자동 정리)</div>
                            <div><strong>용량:</strong> 브라우저별 제한 (일반적으로 수GB)</div>
                            <div><strong>상태:</strong> <span className="text-green-300">정상 운영</span></div>
                          </div>
                          
                          {/* 통합 데이터 통계 */}
                          <div className="mt-3 p-2 bg-blue-500/20 rounded border border-blue-400/30">
                            <h5 className="text-xs font-medium mb-1 text-blue-100">📊 데이터 현황</h5>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-blue-200">채널:</span>
                                <span className="ml-1 font-medium">{migrationStatus?.indexeddbData?.channels || 0}개</span>
                              </div>
                              <div>
                                <span className="text-blue-200">영상:</span>
                                <span className="ml-1 font-medium">{migrationStatus?.indexeddbData?.videos || 0}개</span>
                              </div>
                              <div>
                                <span className="text-blue-200">분류됨:</span>
                                <span className="ml-1 font-medium">{migrationStatus?.indexeddbData?.classifiedData || 0}개</span>
                              </div>
                              <div>
                                <span className="text-blue-200">미분류:</span>
                                <span className="ml-1 font-medium">{migrationStatus?.indexeddbData?.unclassifiedData || 0}개</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 데이터 동기화 섹션 */}
                        <div className="p-3 rounded-lg bg-green-600 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">데이터 동기화</h4>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleDataSync}
                              disabled={isMigrating || !migrationStatus.canMigrate}
                              className="text-xs"
                            >
                              {isMigrating ? '동기화 중...' : '🔄 동기화'}
                            </Button>
                          </div>
                          <div className="text-xs space-y-1">
                            <div><strong>IndexedDB 데이터:</strong></div>
                            <div className="ml-2">• 채널: {migrationStatus.indexeddbData.channels}개</div>
                            <div className="ml-2">• 영상: {migrationStatus.indexeddbData.videos}개</div>
                            <div className="ml-2">• 분류 데이터: {migrationStatus.indexeddbData.classificationData}개</div>
                            <div><strong>상태:</strong> {migrationStatus.canMigrate ? 
                              <span className="text-yellow-300">동기화 가능</span> : 
                              <span className="text-gray-300">동기화할 데이터 없음</span>
                            }</div>
                          </div>
                          
                          {/* 동기화 상세 정보 */}
                          <div className="mt-3 p-2 bg-green-500/20 rounded border border-green-400/30">
                            <h5 className="text-xs font-medium mb-1 text-green-100">동기화 상세</h5>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-green-200">총 데이터:</span>
                                <span className="font-medium">{(migrationStatus.indexeddbData.channels || 0) + (migrationStatus.indexeddbData.videos || 0) + (migrationStatus.indexeddbData.classificationData || 0)}개</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-200">동기화 대상:</span>
                                <span className="font-medium text-green-300">PostgreSQL</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-green-200">마지막 동기화:</span>
                                <span className="font-medium text-green-300">수동 실행</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 동기화 결과 표시 */}
                          {migrationResult && (
                            <div className={`mt-2 p-2 rounded text-xs ${
                              migrationResult.success ? 'bg-green-700' : 'bg-red-700'
                            }`}>
                              <div className="font-medium">
                                {migrationResult.success ? '✅ 동기화 완료' : '❌ 동기화 실패'}
                              </div>
                              <div>{migrationResult.message}</div>
                              {migrationResult.success && (
                                <div className="mt-1">
                                  • 채널: {migrationResult.migratedData.channels}개
                                  • 영상: {migrationResult.migratedData.videos}개
                                  • 분류: {migrationResult.migratedData.classificationData}개
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </Card>
                  </div>
       </div>
    </div>
  );
};

export default System;
