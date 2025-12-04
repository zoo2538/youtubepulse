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
  HardDrive,
  TrendingUp
} from "lucide-react";
import DataCollectionManager from "@/components/DataCollectionManager";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { dataMigrationService } from "@/lib/data-migration-service";
import { loadCollectionConfig, EXPANDED_KEYWORDS } from "@/lib/data-collection-config";
import { API_BASE_URL } from "@/lib/config";
import { getKoreanDateString, getKoreanDateTimeString } from "@/lib/utils";
import { CacheCleanup } from "@/lib/cache-cleanup";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { getApiKeyStatuses, resetApiKeyUsage } from "@/lib/youtube-api-key-manager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_YOUTUBE_API_KEYS = 3;

interface ApiConfig {
  youtubeApiKeys: string[];
  activeYoutubeApiKeyIndex: number;
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
  const defaultApiUrl = API_BASE_URL || 'https://api.youthbepulse.com';
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    // localStorage에서 저장된 설정 불러오기
    const savedApiKeysRaw = localStorage.getItem('youtubeApiKeys');
    let savedApiKeys: string[] = [];
    if (savedApiKeysRaw) {
      try {
        const parsed = JSON.parse(savedApiKeysRaw);
        if (Array.isArray(parsed)) {
          savedApiKeys = parsed.filter(key => typeof key === 'string').slice(0, MAX_YOUTUBE_API_KEYS);
        }
      } catch (error) {
        console.warn('YouTube API 키 목록 파싱 실패, 기본값 사용:', error);
      }
    }

    const legacyApiKey = localStorage.getItem('youtubeApiKey') || '';
    if (legacyApiKey && !savedApiKeys.length) {
      savedApiKeys = [legacyApiKey];
    }

    if (!savedApiKeys.length) {
      savedApiKeys = [''];
    }

    const savedActiveIndexRaw = localStorage.getItem('activeYoutubeApiKeyIndex');
    let savedActiveIndex = savedActiveIndexRaw ? parseInt(savedActiveIndexRaw, 10) : 0;
    if (Number.isNaN(savedActiveIndex) || savedActiveIndex < 0 || savedActiveIndex >= savedApiKeys.length) {
      savedActiveIndex = 0;
    }

    const savedCustomApiUrl = localStorage.getItem('customApiUrl') || defaultApiUrl;
    const savedCustomApiEnabled = localStorage.getItem('customApiEnabled') === 'true';
    const savedCustomApiKey = localStorage.getItem('customApiKey') || '';
    const savedYoutubeApiEnabled = localStorage.getItem('youtubeApiEnabled') === 'true';
    
    // 기본값: 커스텀 API 비활성화 (Railway 서버 문제로 인해)
    const defaultCustomApiEnabled = savedCustomApiEnabled !== null ? savedCustomApiEnabled : false;
    
    // YouTube API 키가 있으면 자동으로 활성화
    const youtubeApiEnabled = savedApiKeys.some(key => key) ? true : savedYoutubeApiEnabled;
    
    const primaryApiKey = savedApiKeys.find(key => key)?.substring(0, 10) || null;
    console.log('🔧 설정 로드:', {
      youtubeApiKeys: savedApiKeys.map((key, index) => ({
        index,
        status: key ? '설정됨' : '미설정'
      })),
      primaryYoutubeApiKey: primaryApiKey ? `${primaryApiKey}...` : '미설정',
      youtubeApiEnabled: youtubeApiEnabled,
      customApiUrl: savedCustomApiUrl,
      customApiEnabled: defaultCustomApiEnabled,
      customApiKey: savedCustomApiKey ? '설정됨' : '미설정'
    });

    console.log('🔍 localStorage 직접 확인:', {
      youtubeApiKeys: localStorage.getItem('youtubeApiKeys'),
      legacyYoutubeApiKey: localStorage.getItem('youtubeApiKey'),
      youtubeApiEnabled: localStorage.getItem('youtubeApiEnabled'),
      customApiKey: localStorage.getItem('customApiKey'),
      customApiUrl: localStorage.getItem('customApiUrl'),
      customApiEnabled: localStorage.getItem('customApiEnabled')
    });
    
    return {
      youtubeApiKeys: savedApiKeys,
      activeYoutubeApiKeyIndex: savedActiveIndex,
      youtubeApiEnabled: youtubeApiEnabled,
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

  const activeYoutubeApiKey =
    apiConfig.youtubeApiKeys[apiConfig.activeYoutubeApiKeyIndex] || '';
  const hasAnyYoutubeApiKey = apiConfig.youtubeApiKeys.some(key => key.trim().length > 0);


  // 캐시 정리 상태
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheCleanupResult, setCacheCleanupResult] = useState<{
    serviceWorker: boolean;
    cache: boolean;
    localStorage: boolean;
  } | null>(null);

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // API 키 입력 다이얼로그
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  
  // API 키 할당량 상태
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ReturnType<typeof getApiKeyStatuses>>([]);
  


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

  // API 키 할당량 상태 업데이트
  React.useEffect(() => {
    const updateApiKeyStatuses = () => {
      const statuses = getApiKeyStatuses();
      setApiKeyStatuses(statuses);
    };
    
    updateApiKeyStatuses();
    const interval = setInterval(updateApiKeyStatuses, 5000); // 5초마다 업데이트
    
    return () => clearInterval(interval);
  }, [apiConfig.youtubeApiKeys, apiConfig.activeYoutubeApiKeyIndex]);

  
  // 페이지 로드 시 설정 로드
  React.useEffect(() => {
    // 커스텀 API가 처음 사용되는 경우 기본값으로 설정
    if (localStorage.getItem('customApiEnabled') === null) {
      localStorage.setItem('customApiEnabled', 'false'); // Railway 서버 문제로 비활성화
      localStorage.setItem('customApiUrl', defaultApiUrl);
      console.log('🔧 커스텀 API 기본값 설정 완료 (Railway 서버 문제로 비활성화)');
    }
  }, [defaultApiUrl]);

  // API 설정 자동 저장 제거 - 저장하지 않음

  // 마이그레이션 상태 로드



  const [apiConnectionStatus, setApiConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiTestMessage, setApiTestMessage] = useState('');
  const [youtubeApiStatus, setYoutubeApiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [youtubeApiMessage, setYoutubeApiMessage] = useState('');
  const [lastTestedYoutubeKeyIndex, setLastTestedYoutubeKeyIndex] = useState<number | null>(null);

  function ensureAtLeastOneYoutubeKey(keys: string[]): string[] {
    if (keys.length === 0) return [''];
    return keys;
  }

  // IndexedDB 복원 로직 제거 - localStorage만 사용

  const handleAddYoutubeApiKeyField = () => {
    if (apiConfig.youtubeApiKeys.length >= MAX_YOUTUBE_API_KEYS) {
      alert(`YouTube API 키는 최대 ${MAX_YOUTUBE_API_KEYS}개까지 등록할 수 있습니다.`);
      return;
    }

    setApiConfig(prev => {
      return {
        ...prev,
        youtubeApiKeys: [...prev.youtubeApiKeys, '']
      };
    });
  };

  const handleRemoveYoutubeApiKey = (index: number) => {
    setApiConfig(prev => {
      let keys = [...prev.youtubeApiKeys];
      if (keys.length === 1) {
        keys = [''];
        return {
          ...prev,
          youtubeApiKeys: keys,
          activeYoutubeApiKeyIndex: 0
        };
      }

      keys.splice(index, 1);
      keys = ensureAtLeastOneYoutubeKey(keys);

      let activeIndex = prev.activeYoutubeApiKeyIndex;
      if (activeIndex === index) {
        activeIndex = 0;
      } else if (activeIndex > index) {
        activeIndex = activeIndex - 1;
      }

      return {
        ...prev,
        youtubeApiKeys: keys,
        activeYoutubeApiKeyIndex: activeIndex
      };
    });

    if (lastTestedYoutubeKeyIndex !== null) {
      if (lastTestedYoutubeKeyIndex === index) {
        setYoutubeApiStatus('idle');
        setYoutubeApiMessage('');
        setLastTestedYoutubeKeyIndex(null);
      } else if (lastTestedYoutubeKeyIndex > index) {
        setLastTestedYoutubeKeyIndex(lastTestedYoutubeKeyIndex - 1);
      }
    }
  };

  const handleSetActiveYoutubeApiKey = (index: number) => {
    setApiConfig(prev => {
      return {
        ...prev,
        activeYoutubeApiKeyIndex: index
      };
    });
  };

  const handleUpdateYoutubeApiKey = (index: number, value: string) => {
    setApiConfig(prev => {
      const keys = [...prev.youtubeApiKeys];
      if (index >= keys.length) {
        return prev;
      }
      keys[index] = value;
      const updatedConfig = {
        ...prev,
        youtubeApiKeys: ensureAtLeastOneYoutubeKey(keys)
      };
      
      // 저장하지 않음
      return updatedConfig;
    });

    if (lastTestedYoutubeKeyIndex === index) {
      setYoutubeApiStatus('idle');
      setYoutubeApiMessage('');
      setLastTestedYoutubeKeyIndex(null);
    }
  };

  const handleCleanupOldData = async () => {
    if (window.confirm('14일이 지난 오래된 데이터를 정리하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      try {
        const deletedCount = await indexedDBService.cleanupOldData(14);
        alert(`데이터 정리가 완료되었습니다!\n\n삭제된 데이터: ${deletedCount}개`);
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

  const testYouTubeAPI = async (index?: number) => {
    const keyIndex = index ?? apiConfig.activeYoutubeApiKeyIndex;
    const targetKey = apiConfig.youtubeApiKeys[keyIndex]?.trim();

    if (!targetKey) {
      setLastTestedYoutubeKeyIndex(keyIndex);
      setYoutubeApiStatus('error');
      setYoutubeApiMessage(`API 키 ${keyIndex + 1}번이 비어 있습니다.`);
      return;
    }

    setLastTestedYoutubeKeyIndex(keyIndex);
    setYoutubeApiStatus('testing');
    setYoutubeApiMessage(`YouTube API 키 ${keyIndex + 1}번을 테스트하고 있습니다...`);
    
    try {
      // YouTube API 테스트 (간단한 검색 요청)
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${targetKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API 키가 유효하지 않습니다.');
      }
      
      setYoutubeApiStatus('success');
      setYoutubeApiMessage(`YouTube API 키 ${keyIndex + 1}번 연결이 성공했습니다!`);
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


  // API 키 저장 핸들러
  const handleSaveApiKey = () => {
    if (!tempApiKey.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }

    const trimmedKey = tempApiKey.trim();
    let replacedOldest = false;

    setApiConfig(prev => {
      let nextKeys = [...prev.youtubeApiKeys];
      let nextActiveIndex = prev.activeYoutubeApiKeyIndex;

      const existingIndex = nextKeys.findIndex(key => key === trimmedKey);
      if (existingIndex >= 0) {
        nextActiveIndex = existingIndex;
        nextKeys[existingIndex] = trimmedKey;
      } else {
        const emptyIndex = nextKeys.findIndex(key => !key.trim());
        if (emptyIndex >= 0) {
          nextKeys[emptyIndex] = trimmedKey;
          nextActiveIndex = emptyIndex;
        } else if (nextKeys.length < MAX_YOUTUBE_API_KEYS) {
          nextKeys = [...nextKeys, trimmedKey];
          nextActiveIndex = nextKeys.length - 1;
        } else {
          nextKeys = [...nextKeys.slice(1), trimmedKey];
          nextActiveIndex = nextKeys.length - 1;
          replacedOldest = true;
        }
      }

      const updated = {
        ...prev,
        youtubeApiKeys: ensureAtLeastOneYoutubeKey(nextKeys),
        activeYoutubeApiKeyIndex: nextActiveIndex,
        youtubeApiEnabled: true
      };
      
      // 저장하지 않음
      return updated;
    });

    if (replacedOldest) {
      alert(`YouTube API 키는 최대 ${MAX_YOUTUBE_API_KEYS}개까지만 저장됩니다.\n가장 오래된 키를 교체하고 새 키를 추가했습니다.`);
    }

    console.log('✅ API 키 저장 완료:', tempApiKey.trim().substring(0, 10) + '...');
    
    // 다이얼로그 닫기
    setShowApiKeyDialog(false);
    setTempApiKey('');
    
    // 저장 상태 표시
    setSaveStatus('success');
    setSaveMessage('API 키가 저장되었습니다. 이제 데이터 수집을 시작합니다.');
    
    // 3초 후 메시지 제거
    setTimeout(() => {
      setSaveStatus('idle');
      setSaveMessage('');
    }, 3000);

    // 데이터 수집 시작
    setTimeout(() => {
      startDataCollectionProcess();
    }, 500);
  };

  const handleStartDataCollection = async () => {
    const trimmedKeys = apiConfig.youtubeApiKeys.map(key => key.trim());
    const hasValidKey = trimmedKeys.some(key => key.length > 0);

    if (!hasValidKey) {
      setTempApiKey('');
      setShowApiKeyDialog(true);
      return;
    }

    const activeKeyTrimmed = trimmedKeys[apiConfig.activeYoutubeApiKeyIndex];
    if (!activeKeyTrimmed) {
      const fallbackIndex = trimmedKeys.findIndex(key => key.length > 0);
      if (fallbackIndex >= 0) {
        setApiConfig(prev => ({
          ...prev,
          activeYoutubeApiKeyIndex: fallbackIndex,
          youtubeApiEnabled: true
        }));
      }
    }

    await startDataCollectionProcess();
  };

  const startDataCollectionProcess = async () => {
    try {
      const rawKeys = apiConfig.youtubeApiKeys;
      const trimmedKeys = rawKeys.map(key => key.trim());
      const totalKeySlots = trimmedKeys.length;

      if (!trimmedKeys.some(key => key.length > 0)) {
        alert('YouTube API 키가 필요합니다.');
        return;
      }

      let currentKeyIndex = apiConfig.activeYoutubeApiKeyIndex;
      if (!trimmedKeys[currentKeyIndex]) {
        const nextValidIndex = trimmedKeys.findIndex(key => key.length > 0);
        if (nextValidIndex === -1) {
          alert('사용 가능한 YouTube API 키가 없습니다. 시스템 페이지에서 키를 등록해 주세요.');
          return;
        }
        currentKeyIndex = nextValidIndex;
        setApiConfig(prev => ({
          ...prev,
          activeYoutubeApiKeyIndex: nextValidIndex,
          youtubeApiEnabled: true
        }));
      }

      let currentYoutubeApiKey = trimmedKeys[currentKeyIndex];

      const quotaReasonKeywords = [
        'quotaexceeded',
        'dailylimitexceeded',
        'ratelimitexceeded',
        'userratelimitexceeded',
        'keyinvalid',
        'quota'
      ];

      const isQuotaExceededError = (status: number, data: any) => {
        if (status === 403 || status === 429) {
          const errors = data?.error?.errors;
          if (Array.isArray(errors)) {
            if (
              errors.some((err: any) =>
                quotaReasonKeywords.some(keyword =>
                  (err?.reason || '').toString().toLowerCase().includes(keyword.toLowerCase())
                )
              )
            ) {
              return true;
            }
          }

          const message = (data?.error?.message || '').toString().toLowerCase();
          if (quotaReasonKeywords.some(keyword => message.includes(keyword.toLowerCase()))) {
            return true;
          }
        }
        return false;
      };

      const trySwitchYoutubeApiKey = (phase: string, detail: string) => {
        if (totalKeySlots <= 1) {
          return false;
        }

        for (let step = 1; step < totalKeySlots; step++) {
          const nextIndex = (currentKeyIndex + step) % totalKeySlots;
          const candidate = trimmedKeys[nextIndex];
          if (candidate) {
            currentKeyIndex = nextIndex;
            currentYoutubeApiKey = candidate;
            setApiConfig(prev => ({
              ...prev,
              activeYoutubeApiKeyIndex: nextIndex,
              youtubeApiEnabled: true
            }));
            console.warn(
              `⚠️ ${phase}: YouTube API 키(${currentKeyIndex + 1}번)로 전환합니다. 사유: ${detail}`
            );
            return true;
          }
        }
        return false;
      };

      const fetchWithYoutubeKey = async (
        urlBuilder: (apiKey: string) => string,
        phase: string
      ): Promise<any> => {
        let attempts = 0;

        while (attempts < totalKeySlots) {
          if (!currentYoutubeApiKey) {
            const switched = trySwitchYoutubeApiKey(phase, '현재 키가 비어 있습니다');
            if (!switched) {
              break;
            }
            attempts++;
            continue;
          }

          const url = urlBuilder(currentYoutubeApiKey);

          try {
            const response = await fetch(url);
            const rawText = await response.text();
            let data: any = null;

            if (rawText) {
              try {
                data = JSON.parse(rawText);
              } catch {
                data = null;
              }
            }

            if (!response.ok || data?.error) {
              const reasonMessage =
                data?.error?.message ||
                data?.error?.errors?.[0]?.message ||
                `${response.status} ${response.statusText}` ||
                '알 수 없는 오류';

              if (isQuotaExceededError(response.status, data)) {
                const switched = trySwitchYoutubeApiKey(phase, reasonMessage);
                if (!switched) {
                  throw new Error(
                    `YouTube API 키 할당량이 모두 소진되었습니다. (${reasonMessage})`
                  );
                }
                attempts++;
                continue;
              }

              throw new Error(`${phase} 요청 실패: ${reasonMessage}`);
            }

            return data ?? {};
          } catch (error) {
            if (error instanceof Error && error.message.includes('할당량이 모두 소진')) {
              throw error;
            }

            const switched = trySwitchYoutubeApiKey(
              phase,
              error instanceof Error ? error.message : '네트워크 오류'
            );
            if (!switched) {
              throw error instanceof Error
                ? error
                : new Error(`${phase} 요청 중 오류가 발생했습니다.`);
            }
            attempts++;
          }
        }

        throw new Error('사용 가능한 YouTube API 키가 없습니다. 새로운 키를 등록해 주세요.');
      };

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
        // 상위 200개 수집 (50개씩 4페이지) - YouTube API 실제 제공량
        let nextPageToken = '';
        for (let page = 0; page < 4; page++) {
          const trendingData = await fetchWithYoutubeKey(
            apiKey =>
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&maxResults=50${
                nextPageToken ? `&pageToken=${nextPageToken}` : ''
              }&key=${apiKey}`,
            `트렌드 영상 수집 (페이지 ${page + 1})`
          );

          requestCount++;

          if (trendingData?.items) {
            trendingVideos = [...trendingVideos, ...trendingData.items];
            console.log(
              `✅ 트렌드 영상 ${(page + 1) * 50}개 수집 중... (현재: ${trendingVideos.length}개)`
            );

            nextPageToken = trendingData.nextPageToken;
            console.log(
              `📄 페이지 ${page + 1}: nextPageToken = ${
                nextPageToken ? '있음' : '없음 (더 이상 페이지 없음)'
              }`
            );
            if (!nextPageToken) break;
          } else {
            console.warn('⚠️ 트렌드 영상 수집 실패, 키워드 수집만 진행');
            break;
          }

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
          const searchData = await fetchWithYoutubeKey(
            apiKey =>
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
                keyword
              )}&type=video&maxResults=50&regionCode=KR&order=viewCount&key=${apiKey}`,
            `키워드 "${keyword}" 검색`
          );

          requestCount++;

          if (!searchData.items || searchData.items.length === 0) {
            console.log(`키워드 "${keyword}" 검색 결과 없음`);
            continue;
          }

          const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

          const videosData = await fetchWithYoutubeKey(
            apiKey =>
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`,
            `키워드 "${keyword}" 영상 상세`
          );

          requestCount++;

          const videos = videosData.items || [];
          const videosWithKeyword = videos.map(item => ({
            ...item,
            searchKeyword: keyword  // 어떤 키워드로 수집되었는지 기록
          }));
          keywordVideos = [...keywordVideos, ...videosWithKeyword];
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
        const channelsData = await fetchWithYoutubeKey(
          apiKey =>
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batchChannelIds.join(
              ','
            )}&key=${apiKey}`,
          '채널 정보 수집'
        );

        requestCount++;
        
        allChannels = [...allChannels, ...channelsData.items];
        
        // 진행 상황 표시
        console.log(`채널 정보 수집: ${allChannels.length}/${channelIds.length} 채널 완료`);
        
        // API 할당량을 고려하여 잠시 대기 (지연 시간 증가)
        if (i + 50 < channelIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 100ms → 500ms로 증가
        }
      }

      // 3. 최근 분류된 데이터에서 카테고리 정보 가져오기 (최근 14일간)
      let existingClassifiedData: any[] = [];
      // 14일 기준 날짜 계산 (한국 시간 기준)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenDaysAgoString = fourteenDaysAgo.toISOString().split('T')[0];
      
      try {
        // API_BASE_URL이 없으면 IndexedDB 데이터만 사용
        if (!API_BASE_URL) {
          console.log('⚠️ API_BASE_URL 미설정 - IndexedDB 데이터만 사용합니다.');
          const savedCategories = await indexedDBService.loadCategories();
          if (savedCategories && Object.keys(savedCategories).length > 0) {
            setDynamicSubCategories(savedCategories);
          }
          setIsLoading(false);
          return;
        }
        
        // IndexedDB 전용 모드에서는 서버 조회 스킵
        if (API_BASE_URL) {
          const serverResponse = await fetch(`${API_BASE_URL}/api/unclassified`);
          if (serverResponse.ok) {
            const serverResult = await serverResponse.json();
            if (serverResult.success && serverResult.data) {
              const allServerData = serverResult.data;
              
              existingClassifiedData = allServerData.filter((item: any) => {
                const isClassified = item.status === 'classified';
                const itemDate = item.dayKeyLocal || item.day_key_local || item.collectionDate || item.collection_date;
                const isRecent = itemDate && itemDate >= fourteenDaysAgoString;
                return isClassified && isRecent;
              });
              
              console.log(`📊 서버에서 분류 데이터 로드 성공`);
              console.log(`📊 분류 데이터 참조 범위: 최근 14일 (${fourteenDaysAgoString} 이후)`);
              console.log(`📊 최근 14일 분류 데이터: ${existingClassifiedData.length}개`);
            }
          } else {
            console.warn('서버 조회 실패, IndexedDB에서 로드 시도');
            throw new Error('Server fetch failed');
          }
        } else {
          console.warn('⚠️ API_BASE_URL 미설정 - IndexedDB 데이터로 대체합니다.');
        }
      } catch (error) {
        // IndexedDB에서 로드 (서버 실패 또는 미설정 시)
        console.log('📊 IndexedDB에서 분류 데이터 로드...');
        try {
          const allData = await hybridService.loadUnclassifiedData();
          
          existingClassifiedData = allData.filter((item: any) => {
            const isClassified = item.status === 'classified';
            const isRecent = item.collectionDate >= fourteenDaysAgoString;
            return isClassified && isRecent;
          });
          
          console.log(`📊 IndexedDB에서 분류 데이터 로드: ${existingClassifiedData.length}개`);
          console.log(`📊 분류 데이터 참조 범위: 최근 14일 (${fourteenDaysAgoString} 이후)`);
        } catch (idbError) {
          console.log('기존 분류 데이터 로드 실패, 새로 시작합니다.');
          existingClassifiedData = [];
        }
      }
      
      // 비디오 ID 기준 분류 맵 (우선순위 1)
      const classifiedVideoMap = new Map();
      // 채널 ID 기준 분류 맵 (우선순위 2)
      const classifiedChannelMap = new Map();
      
      // 비디오별로 가장 최근 분류 정보만 사용
      const videoLatestClassification = new Map();
      // 채널별로 가장 최근 분류 정보만 사용 (비디오 ID가 없을 때 사용)
      const channelLatestClassification = new Map();
      
      existingClassifiedData.forEach((item: any) => {
        // 비디오 ID 기준 분류 (우선순위 1)
        if (item.videoId) {
          if (!videoLatestClassification.has(item.videoId) || 
              item.collectionDate > videoLatestClassification.get(item.videoId).collectionDate) {
            videoLatestClassification.set(item.videoId, {
              category: item.category,
              subCategory: item.subCategory,
              collectionDate: item.collectionDate,
              videoTitle: item.videoTitle
            });
          }
        }
        
        // 채널 ID 기준 분류 (우선순위 2)
        if (item.channelId) {
          if (!channelLatestClassification.has(item.channelId) || 
              item.collectionDate > channelLatestClassification.get(item.channelId).collectionDate) {
            channelLatestClassification.set(item.channelId, {
              category: item.category,
              subCategory: item.subCategory,
              collectionDate: item.collectionDate,
              channelName: item.channelName
            });
          }
        }
      });
      
      // 최종 분류 맵 구성
      videoLatestClassification.forEach((classification, videoId) => {
        classifiedVideoMap.set(videoId, {
          category: classification.category,
          subCategory: classification.subCategory
        });
      });
      
      channelLatestClassification.forEach((classification, channelId) => {
        classifiedChannelMap.set(channelId, {
          category: classification.category,
          subCategory: classification.subCategory
        });
      });
      
      console.log(`📊 분류 참조 비디오: ${classifiedVideoMap.size}개 (우선순위 1)`);
      console.log(`📊 분류 참조 채널: ${classifiedChannelMap.size}개 (우선순위 2)`);
      console.log(`📊 분류 참조 기간: 최근 14일간의 최신 분류 정보만 사용`);
      console.log(`📊 기존 분류 시스템: 비디오 ID 우선 → 채널 ID 보조`);
      
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
      
      // 기존 분류 시스템만 사용 (AI 자동분류 제거됨)
      
      const newData = uniqueVideos.map((video: any, index: number) => {
        const channel = allChannels.find((ch: any) => ch.id === video.snippet.channelId);
        
        // 비디오 ID 기준 분류 우선 확인 (우선순위 1)
        let existingClassification = classifiedVideoMap.get(video.id);
        // 비디오 ID 분류가 없으면 채널 ID 기준 확인 (우선순위 2)
        if (!existingClassification) {
          existingClassification = classifiedChannelMap.get(video.snippet.channelId);
        }
        
        // 오늘 수집된 모든 영상은 오늘 날짜로 설정 (기존 날짜 유지하지 않음)
        const collectionDate = today;
        
        // 키워드 정보 확인
        let sourceKeyword = 'trending';
        let sourceType = 'trending';
        if (video.searchKeyword) {
          // 키워드 수집에서 온 영상
          sourceKeyword = video.searchKeyword;
          sourceType = 'keyword';
        }
        
        // 기존 분류 시스템만 사용
        // - 비디오 ID 기준 우선: 14일 데이터에 있으면 그 분류 사용 (classified)
        // - 채널 ID 기준 보조: 비디오 ID가 없으면 채널 ID 기준 분류 사용
        // - 둘 다 없으면: 수동 분류 대기 (unclassified)
        
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
          category: existingClassification?.category || '', // 비디오 ID 우선 → 채널 ID 보조, 없으면 빈값
          collectionType: 'manual', // 수동 수집으로 명시
          collectionTimestamp: getKoreanDateTimeString(), // 수집 시간 기록 (한국 시간)
          collectionSource: 'system_page', // 수집 소스 기록
          keyword: sourceKeyword, // 키워드 정보 추가
          source: sourceType, // 수집 소스 추가 (trending or keyword)
          subCategory: existingClassification?.subCategory || '', // 비디오 ID 우선 → 채널 ID 보조, 없으면 빈값
          status: existingClassification ? "classified" as const : "unclassified" as const, // 분류 데이터 없으면 무조건 unclassified
          autoClassified: !!existingClassification // 기존 분류 데이터로 분류된 경우만 true
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
        
        // IndexedDB 저장 (로컬 전용)
        await hybridService.saveUnclassifiedData(finalUniqueData);
      } catch (error) {
        console.error('IndexedDB 저장 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
      }

      const newChannels = newData.filter(item => !classifiedChannelMap.has(item.channelId)).length;
      const autoClassified = newData.filter(item => classifiedChannelMap.has(item.channelId)).length;

      // 분류 통계
      const classifiedByHistory = newData.filter(item => item.autoClassified).length;
      const unclassified = newData.filter(item => !item.autoClassified).length;
      
      console.log(`📊 분류 결과:`);
      console.log(`   - 기존 분류 적용: ${classifiedByHistory}개`);
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
            `♻️ 기존 분류 적용: ${classifiedByHistory}개\n` +
            `❓ 미분류: ${unclassified}개\n` +
            `📊 평균 조회수: ${avgViews.toLocaleString()}회\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔧 API 요청: ${totalApiRequests}번\n` +
            `💰 할당량: 약 ${estimatedUnits} units\n\n` +
            `기존 분류가 적용된 영상은 이미 분류 완료 상태입니다.\n` +
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
      {/* API 키 입력 다이얼로그 */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-blue-600" />
              <span>YouTube API 키 설정</span>
            </DialogTitle>
            <DialogDescription>
              데이터 수집을 위해 YouTube API 키를 입력해주세요.
              입력된 API 키는 자동으로 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-input">API 키</Label>
              <Input
                id="api-key-input"
                type="text"
                placeholder="YouTube Data API v3 키를 입력하세요"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveApiKey();
                  }
                }}
                className="font-mono"
                autoFocus
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-800 mb-2">💡 API 키 발급 방법:</h4>
              <ol className="text-xs text-blue-700 space-y-1">
                <li>1. <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">Google Cloud Console</a>에 로그인</li>
                <li>2. 새 프로젝트 생성 또는 기존 프로젝트 선택</li>
                <li>3. <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">YouTube Data API v3</a> 활성화</li>
                <li>4. <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">사용자 인증 정보</a>에서 API 키 생성</li>
                <li>5. 생성된 API 키를 위에 입력</li>
              </ol>
            </div>

            {saveStatus !== 'idle' && (
              <div className={`p-3 rounded-lg text-sm ${
                saveStatus === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {saveStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                  {saveStatus === 'error' && <XCircle className="w-4 h-4" />}
                  <span>{saveMessage}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApiKeyDialog(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleSaveApiKey}
              disabled={!tempApiKey.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              저장하고 수집 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="flex items-center space-x-2 flex-wrap">
              <Link to="/user-management">
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  <span className="text-sm font-medium">회원관리</span>
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                >
                  <span className="text-sm font-medium">국내</span>
                </Button>
              </Link>
              <Link to="/trend">
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                >
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  <span className="text-sm font-medium">트렌드</span>
                </Button>
              </Link>
              <Link to="/data">
                <Button 
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white whitespace-nowrap"
                >
                  <span className="text-sm font-medium">📊 데이터</span>
                </Button>
              </Link>
              <Button 
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                <span className="text-sm font-medium">시스템</span>
              </Button>
              <Link to="/subcategory-settings">
                <Button 
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700 text-white whitespace-nowrap"
                >
                  <Filter className="w-4 h-4 mr-1.5" />
                  <span className="text-sm font-medium">세부카테고리</span>
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
                저장 기준: IndexedDB (로컬 전용) · 수집: 트렌드 + 키워드 혼합 · 정렬: 조회수 상위
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
                            <Label className="text-sm font-medium">YouTube Data API 활성화</Label>
                            <Switch
                              checked={apiConfig.youtubeApiEnabled}
                              onCheckedChange={(checked) =>
                                setApiConfig(prev => ({
                                  ...prev,
                                  youtubeApiEnabled: checked,
                                  youtubeApiKeys: checked
                                    ? ensureAtLeastOneYoutubeKey(prev.youtubeApiKeys)
                                    : prev.youtubeApiKeys
                                }))
                              }
                            />
                          </div>
                          {/* API 키 입력 필드는 항상 표시 */}
                          <div className="space-y-3 border-t pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-sm font-medium text-blue-700">📝 YouTube API 키</Label>
                            </div>
                              {apiConfig.youtubeApiKeys.map((key, index) => {
                                const isActive = apiConfig.activeYoutubeApiKeyIndex === index;
                                const isTesting = youtubeApiStatus === 'testing' && lastTestedYoutubeKeyIndex === index;
                                const showStatus = lastTestedYoutubeKeyIndex === index && youtubeApiStatus !== 'idle';
                                const keyStatus = apiKeyStatuses.find(s => s.index === index);
                                const usagePercent = keyStatus?.usagePercent || 0;
                                const remainingQuota = keyStatus?.remainingQuota || 0;
                                const isExhausted = keyStatus?.isExhausted || false;
                                
                                return (
                                  <div key={index} className="border border-muted rounded-lg p-3 space-y-2 bg-muted/30">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center space-x-2">
                                          <Badge variant={isActive ? 'default' : 'outline'}>
                                            {isActive ? '사용 중' : '대기'}
                                          </Badge>
                                          {isExhausted && (
                                            <Badge variant="destructive" className="text-xs">
                                              할당량 소진
                                            </Badge>
                                          )}
                                          <span className="text-sm font-semibold text-foreground">
                                            API 키 {index + 1}
                                          </span>
                                        </div>
                                        <code className="block text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded break-all">
                                          {key ? (key.length > 12
                                            ? `${key.substring(0, 8)}${'*'.repeat(key.length - 12)}${key.substring(key.length - 4)}`
                                            : '****'
                                          ) : '(미입력)'}
                                        </code>
                                        {keyStatus && key && (
                                          <div className="mt-2 space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className="text-muted-foreground">할당량 사용률</span>
                                              <span className={`font-semibold ${
                                                usagePercent >= 95 ? 'text-red-600' :
                                                usagePercent >= 80 ? 'text-orange-600' :
                                                'text-green-600'
                                              }`}>
                                                {usagePercent.toFixed(1)}%
                                              </span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2">
                                              <div
                                                className={`h-2 rounded-full transition-all ${
                                                  usagePercent >= 95 ? 'bg-red-600' :
                                                  usagePercent >= 80 ? 'bg-orange-600' :
                                                  'bg-green-600'
                                                }`}
                                                style={{ width: `${Math.min(100, usagePercent)}%` }}
                                              />
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                              <span>사용: {keyStatus.usedQuota.toLocaleString()} / {keyStatus.dailyQuota.toLocaleString()}</span>
                                              <span>남은 할당량: {remainingQuota.toLocaleString()}</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          variant={isActive ? 'secondary' : 'outline'}
                                          size="sm"
                                          onClick={() => handleSetActiveYoutubeApiKey(index)}
                                          disabled={!key.trim() || isActive || isExhausted}
                                        >
                                          {isActive ? '현재 사용 중' : '이 키 사용'}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (window.confirm(`API 키 ${index + 1}번의 할당량 사용량을 초기화하시겠습니까?`)) {
                                              resetApiKeyUsage(index);
                                              const statuses = getApiKeyStatuses();
                                              setApiKeyStatuses(statuses);
                                            }
                                          }}
                                          title="할당량 초기화"
                                          className="text-xs"
                                        >
                                          초기화
                                        </Button>
                                        {apiConfig.youtubeApiKeys.length > 1 && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveYoutubeApiKey(index)}
                                            title="API 키 삭제"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex space-x-2">
                                      <Input
                                        id={`youtube-api-key-${index}`}
                                        type="password"
                                        autoComplete="off"
                                        placeholder="YouTube Data API 키를 입력하세요"
                                        value={key}
                                        onChange={(e) => handleUpdateYoutubeApiKey(index, e.target.value)}
                                        className="flex-1 font-mono text-sm"
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => testYouTubeAPI(index)}
                                        disabled={!key.trim() || youtubeApiStatus === 'testing'}
                                      >
                                        <TestTube className={`w-4 h-4 mr-1 ${isTesting ? 'animate-spin' : ''}`} />
                                        {isTesting ? '테스트 중...' : '테스트'}
                                      </Button>
                                    </div>

                                    {showStatus && (
                                      <div
                                        className={`p-2 rounded-lg text-sm ${
                                          youtubeApiStatus === 'success'
                                            ? 'bg-green-50 border border-green-200 text-green-800'
                                            : youtubeApiStatus === 'error'
                                            ? 'bg-red-50 border border-red-200 text-red-800'
                                            : 'bg-blue-50 border border-blue-200 text-blue-800'
                                        }`}
                                      >
                                        <div className="flex items-center space-x-2">
                                          {youtubeApiStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                                          {youtubeApiStatus === 'error' && <XCircle className="w-4 h-4" />}
                                          {youtubeApiStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                          <span>{youtubeApiMessage}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {apiConfig.youtubeApiKeys.length < MAX_YOUTUBE_API_KEYS && (
                                <Button variant="outline" size="sm" onClick={handleAddYoutubeApiKeyField}>
                                  <span className="font-medium text-sm">+ API 키 추가</span>
                                </Button>
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
                        </div>

                        {/* 커스텀 API - IndexedDB 전용 모드에서는 비활성화 */}
                        {(() => {
                          const isIndexedDBOnly = !API_BASE_URL;
                          if (isIndexedDBOnly) {
                            return (
                              <div className="space-y-3">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Database className="w-5 h-5 text-blue-600" />
                                    <Label className="text-sm font-medium text-blue-900">IndexedDB 전용 모드</Label>
                                  </div>
                                  <p className="text-xs text-blue-700">
                                    현재 IndexedDB 전용 모드로 실행 중입니다.<br/>
                                    서버 API 연결이 필요하지 않습니다.<br/>
                                    모든 데이터는 로컬 IndexedDB에 저장됩니다.
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return (
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
                              <div className="text-xs text-muted-foreground">
                                현재 API URL: <span className="font-mono text-blue-600">{API_BASE_URL || '미설정'}</span>
                              </div>
                              {apiConfig.customApiEnabled && (
                                <div className="space-y-2">
                                  <Label htmlFor="custom-api-url">API URL</Label>
                                  <div className="flex space-x-2">
                                    <Input
                                      id="custom-api-url"
                                      placeholder={defaultApiUrl}
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
                                    autoComplete="off"
                                    placeholder="API 키를 입력하세요"
                                    value={apiConfig.customApiKey}
                                    onChange={(e) => 
                                      setApiConfig(prev => ({ ...prev, customApiKey: e.target.value }))
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                            • 기존 분류 이력 기반 자동 분류 적용<br/>
                            • 최근 14일간 분류 이력 우선 적용<br/>
                            • IndexedDB 저장 (로컬 전용)<br/>
                            • API 키 자동 보존 (삭제 방지)
                          </p>
                        </div>
                        
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <h4 className="text-sm font-medium text-purple-900 mb-2">📊 데이터 수집</h4>
                          <p className="text-xs text-purple-700">
                            • 트렌드 영상: 상위 200개 (YouTube 공식)<br/>
                            • 키워드 영상: {EXPANDED_KEYWORDS.length}개 키워드 × 50개<br/>
                            • 자동 수집: 매일 09:00 KST (서버 cron)<br/>
                            • 수동 수집: 시스템 페이지에서 즉시 실행
                          </p>
                        </div>
                        
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <h4 className="text-sm font-medium text-green-900 mb-2">🔐 보안 및 저장</h4>
                          <p className="text-xs text-green-700">
                            • API 키: localStorage + IndexedDB 이중 저장<br/>
                            • API 키 마스킹 표시 (보안 강화)<br/>
                            • 실제 키 우선 보존 (빈 키로 덮어쓰기 방지)<br/>
                            • 데이터: IndexedDB 로컬 저장 (서버 동기화 옵션)
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
                      
                      {(() => {
                        const isIndexedDBOnly = !API_BASE_URL;
                        if (isIndexedDBOnly) {
                          return (
                            <div className="space-y-3">
                              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center space-x-2 mb-2">
                                  <Database className="w-5 h-5 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-900">IndexedDB 전용 모드</span>
                                </div>
                                <p className="text-xs text-blue-700 mb-3">
                                  현재 IndexedDB 전용 모드로 실행 중입니다.<br/>
                                  서버 API 연결이 필요하지 않습니다.
                                </p>
                                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm font-medium">IndexedDB</span>
                                  </div>
                                  <Badge variant="default">연결됨</Badge>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
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
                                  <span className={hasAnyYoutubeApiKey ? "text-green-600 font-medium" : "text-red-600"}>
                                    {hasAnyYoutubeApiKey ? `설정됨 (${apiConfig.youtubeApiKeys.filter(key => key.trim()).length}개)` : "미설정"}
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
                          </div>
                        );
                      })()}
                    </Card>

                  </div>
       </div>
    </div>
  );
};

export default System;
