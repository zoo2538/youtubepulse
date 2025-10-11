import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Settings, 
  Database, 
  Filter,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  LogOut,
  Play,
  Users,
  Trash2,
  Download,
  Upload,
  Pause,
  SaveAll,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Archive,
  FileDown,
  BarChart3
  } from "lucide-react";
import { postgresqlService } from "@/lib/postgresql-service";
import { redisService } from "@/lib/redis-service";
import { hybridService } from "@/lib/hybrid-service";
import { categories, subCategories } from "@/lib/subcategories";
import { useAuth } from "@/contexts/AuthContext";
import { loadAndMergeDays, mergeByDay, type DayRow, type MergeResult } from "@/lib/day-merge-service";
import { performFullSync, checkSyncNeeded, type SyncResult } from "@/lib/sync-service";
import { dedupeComprehensive, dedupeByVideoDay, dedupeByDate, type VideoItem } from "@/lib/dedupe-utils";
import { getKoreanDateString, getKoreanDateStringWithOffset } from "@/lib/utils";
import { dateRolloverService } from "@/lib/date-rollover-service";
import { autoCollectionScheduler } from "@/lib/auto-collection-scheduler";
import { offlineResilienceService } from "@/lib/offline-resilience-service";
import { startDataCollection } from "@/lib/youtube-api-service";
import { compressByDate, type CompressionResult } from "@/lib/local-compression";
import { hybridSyncService } from "@/lib/hybrid-sync-service";
import { indexedDBService } from "@/lib/indexeddb-service";
import { apiService } from "@/lib/api-service";
import { fetchAndHydrate } from "@/lib/fetch-and-hydrate";
import { showToast } from "@/lib/toast-util";

// localStorage 관련 함수들 제거 - IndexedDB만 사용

// localStorage 관련 함수들 제거됨 - IndexedDB만 사용

// 카테고리 및 세부카테고리는 subcategories.ts에서 import

// 데이터 타입 정의
interface UnclassifiedData {
  id: number;
  channelId: string;
  channelName: string;
  description: string;
  videoId: string;
  videoTitle: string;
  videoDescription: string;
  viewCount: number;
  uploadDate: string;
  collectionDate?: string;
  dayKeyLocal?: string; // KST 기준 일자 키
  category: string;
  subCategory: string;
  status: 'unclassified' | 'classified' | 'pending';
  updatedAt?: string;
  collectionType?: 'auto' | 'manual'; // 수집 타입 구분
}

// 일별 분류 진행률 데이터 타입
interface DailyProgressData {
  date: string; // YYYY-MM-DD
  autoCollected: number; // 자동수집 총 개수
  autoClassified: number; // 자동수집 중 분류된 개수
  manualCollected: number; // 수동수집 총 개수
  manualClassified: number; // 수동수집 중 분류된 개수
  totalCollected: number; // 전체 수집 개수
  totalClassified: number; // 전체 분류된 개수
  autoProgress: number; // 자동수집 분류율 (%)
  manualProgress: number; // 수동수집 분류율 (%)
  totalProgress: number; // 전체 분류율 (%)
}

interface DataManagementConfig {
  retentionDays: number;
  autoCleanup: boolean;
}

// 테스트 데이터 생성 함수 제거됨 - 실제 데이터만 사용

const DataClassification = () => {
  const navigate = useNavigate();
  const { logout, userEmail, userRole } = useAuth();
  const [unclassifiedData, setUnclassifiedData] = useState<UnclassifiedData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoCollectedStats, setAutoCollectedStats] = useState<{[date: string]: {total: number; classified: number; progress: number}}>({});
  // 하드코딩된 세부카테고리 사용 (수정 불가)
  const dynamicSubCategories = subCategories;
  const isAdmin = userRole === 'admin'; // 관리자 권한 확인

  const handleLogout = () => {
    logout(); // AuthContext의 logout이 이미 navigate를 처리함
  };

  // 카테고리는 하드코딩된 값 사용 (subcategories.ts에서 import)
  React.useEffect(() => {
    console.log('📊 하드코딩된 카테고리 사용:', subCategories);
  }, []);

  // 자동수집 데이터 로드 함수
  const loadAutoCollectedData = async () => {
    try {
      console.log('🤖 자동수집 데이터 로드 시작...');
      
      // API에서 자동수집 데이터 조회
      const response = await fetch('https://api.youthbepulse.com/api/auto-collected');
      console.log('🤖 자동수집 API 응답 상태:', response.status, response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('🤖 자동수집 API 응답 데이터:', {
          success: result.success,
          dataLength: result.data?.length,
          dataType: typeof result.data,
          isArray: Array.isArray(result.data)
        });
        
        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          // 서버에서 이미 중복 제거된 실제 데이터 반환됨
          const autoCollectedData = result.data;
          
          console.log(`🤖 자동수집 데이터 로드 (실제 저장 데이터): ${autoCollectedData.length}개`);

          // 자동수집 데이터 통계 계산
          const autoStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
          autoCollectedData.forEach((item: any) => {
            let date = item.dayKeyLocal || item.day_key_local || item.collectionDate || item.collection_date || item.uploadDate || item.upload_date;
            // ISO 타임스탬프 형식이면 날짜만 추출 (YYYY-MM-DD)
            if (date && typeof date === 'string' && date.includes('T')) {
              date = date.split('T')[0];
            }
            if (date) {
              if (!autoStats[date]) {
                autoStats[date] = { total: 0, classified: 0, progress: 0 };
              }
              autoStats[date].total++;
              if (item.status === 'classified') {
                autoStats[date].classified++;
              }
            }
          });
          
          // 진행률 계산
          Object.keys(autoStats).forEach(date => {
            const stats = autoStats[date];
            stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
          });
          
          setAutoCollectedStats(autoStats);
          console.log('🤖 자동수집 통계:', autoStats);
        } else {
          console.log('🤖 자동수집 API 응답 실패 또는 데이터 없음:', {
            success: result?.success,
            hasData: !!result?.data,
            dataLength: result?.data?.length || 0,
            dataType: typeof result?.data
          });
          // 기존 통계 유지 (빈 객체로 덮어쓰지 않음)
          console.log('🤖 기존 자동수집 통계 유지:', autoCollectedStats);
        }
      } else {
        console.log('🤖 자동수집 API 호출 실패:', response.status, response.statusText);
        // 기존 통계 유지 (빈 객체로 덮어쓰지 않음)
        console.log('🤖 기존 자동수집 통계 유지:', autoCollectedStats);
        }
      } catch (error) {
      console.error('🤖 자동수집 데이터 로드 실패:', error);
      setAutoCollectedStats({});
    }
  };

  // 데이터 로딩 상태 관리
  const [dataLoaded, setDataLoaded] = React.useState(false);

  // 하이브리드 데이터 로드 (서버 + 로컬 병합) - 한 번만 실행
  React.useEffect(() => {
    if (dataLoaded) return; // 이미 로드된 경우 중복 실행 방지
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 하이브리드 데이터 로드 시작...');
        
        // 1. 서버와 로컬 데이터 병합
        const mergeResult = await loadAndMergeDays('overwrite');
        console.log('📊 병합 결과:', mergeResult.stats);
        
        if (mergeResult.conflicts.length > 0) {
          console.log('⚠️ 데이터 충돌 발견:', mergeResult.conflicts);
        }
        
        // 2. 병합된 데이터를 기반으로 통계 계산
        const mergedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
        
        mergeResult.mergedDays.forEach(dayRow => {
          mergedDateStats[dayRow.dayKey] = {
            total: dayRow.total,
            classified: dayRow.done,
            progress: dayRow.total > 0 ? Math.round((dayRow.done / dayRow.total) * 100) : 0
          };
        });
        
        setDateStats(mergedDateStats);
        console.log('📊 병합된 dateStats:', mergedDateStats);
        
        // 3. 자동수집 데이터 로드
        await loadAutoCollectedData();
        
        // 4. IndexedDB 확인 (수집 시 자동 저장되므로 비어있을 때만 서버 다운로드)
        let savedData = await hybridService.loadUnclassifiedData();
        
        // 4-1. IndexedDB가 비어있으면 서버에서 초기 다운로드 (첫 방문 또는 캐시 삭제 후)
        if (!savedData || savedData.length === 0) {
          console.log('📭 IndexedDB 비어있음 - 서버에서 초기 데이터 다운로드');
          
          const serverResponse = await fetch('https://api.youthbepulse.com/api/unclassified?days=7');
          if (serverResponse.ok) {
            const serverResult = await serverResponse.json();
            if (serverResult.success && serverResult.data && serverResult.data.length > 0) {
              console.log(`📥 서버에서 최근 7일 데이터 ${serverResult.data.length}개 다운로드`);
              
              // IndexedDB에만 저장 (서버에 재업로드하지 않음)
              await indexedDBService.saveUnclassifiedData(serverResult.data);
              console.log(`💾 IndexedDB에 ${serverResult.data.length}개 데이터 저장 완료`);
              
              // 다시 로드
              savedData = await hybridService.loadUnclassifiedData();
            }
          }
        } else {
          console.log(`✅ IndexedDB에서 데이터 로드: ${savedData.length}개 (수집 시 자동 갱신됨)`);
        }
        
        // 5. 하이브리드 서비스에서 실제 데이터 로드 (일관된 소스 사용)
        if (savedData && savedData.length > 0) {
          // utils 함수들은 이미 정적 import됨
          const today = getKoreanDateString();
          const sanitized: UnclassifiedData[] = savedData.map((it: UnclassifiedData) => {
            const baseItem = it.category === '해외채널'
              ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
              : it;
            
            return {
              ...baseItem,
              collectionDate: baseItem.collectionDate || baseItem.uploadDate || today,
              dayKeyLocal: baseItem.dayKeyLocal || baseItem.collectionDate || baseItem.uploadDate
            };
          });
          
          // 5. 중복 제거 적용 (같은 날짜의 같은 영상만 중복 제거)
          console.log('🔄 중복 제거 전:', sanitized.length, '개 항목');
          const dedupedData = dedupeByVideoDay(sanitized as VideoItem[]);
          console.log('✅ 중복 제거 후:', dedupedData.length, '개 항목');
          console.log('📊 제거된 중복:', sanitized.length - dedupedData.length, '개');
          
          setUnclassifiedData(dedupedData as UnclassifiedData[]);
          console.log('✅ 하이브리드 서비스에서 로드 완료:', dedupedData.length);
          
          // 6. 실제 데이터 기반으로 dateStats 재계산 (중복 제거 반영, 수동수집만)
          const actualDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
          
          dedupedData.forEach((item: UnclassifiedData) => {
            const dayKey = item.dayKeyLocal || item.collectionDate || item.uploadDate;
            if (!dayKey) return;
            
            // 수동수집만 카운트 (dateStats는 수동수집 섹션에서 사용됨)
            const collectionType = item.collectionType || 'manual';
            if (collectionType !== 'manual') return;
            
            const normalizedKey = dayKey.split('T')[0];
            
            if (!actualDateStats[normalizedKey]) {
              actualDateStats[normalizedKey] = { total: 0, classified: 0, progress: 0 };
            }
            
            actualDateStats[normalizedKey].total++;
            if (item.status === 'classified') {
              actualDateStats[normalizedKey].classified++;
            }
          });
          
          // 진행률 계산
          Object.keys(actualDateStats).forEach(date => {
            const stats = actualDateStats[date];
            stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
          });
          
          setDateStats(actualDateStats);
          console.log('📊 실제 데이터 기반 dateStats 재계산 (수동수집만):', actualDateStats);
        } else {
          // 6. IndexedDB에 데이터가 없으면 localStorage에서 마이그레이션 시도
        const channelsData = localStorage.getItem('youtubepulse_channels');
        const videosData = localStorage.getItem('youtubepulse_videos');
        
        if (channelsData && videosData) {
          const channels = JSON.parse(channelsData);
          const videos = JSON.parse(videosData);
          
          // 채널과 비디오 데이터를 결합하여 UnclassifiedData 형태로 변환
          const combinedData: UnclassifiedData[] = [];
          let id = 1;
          
          Object.values(channels).forEach((channel: any) => {
            const channelVideos = videos[channel.id] || [];
            
            channelVideos.forEach((video: any) => {
              combinedData.push({
                id: id++,
                channelId: channel.id,
                channelName: channel.name,
                description: channel.description || "설명 없음",
                videoId: video.id,
                videoTitle: video.title,
                videoDescription: video.description || "설명 없음",
                viewCount: video.viewCount || 0,
                uploadDate: video.uploadDate || getKoreanDateString(),
                category: "",
                subCategory: "",
                status: "unclassified" as const
              });
            });
          });
          
          if (combinedData.length > 0) {
              console.log('🔄 localStorage 데이터를 하이브리드 저장소로 마이그레이션:', combinedData.length, '개');
              await hybridService.saveUnclassifiedData(combinedData);
            setUnclassifiedData(combinedData);
            } else {
              console.log('📊 실제 데이터가 없습니다. 데이터 수집을 먼저 진행해주세요.');
              setUnclassifiedData([]);
            }
          } else {
            console.log('📊 실제 데이터가 없습니다. 데이터 수집을 먼저 진행해주세요.');
            setUnclassifiedData([]);
          }
        }
        
        setDataLoaded(true); // 데이터 로드 완료 표시
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setUnclassifiedData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []); // 의존성 배열을 빈 배열로 변경하여 한 번만 실행

  const [dataManagementConfig, setDataManagementConfig] = useState<DataManagementConfig>({
    retentionDays: 14,
    autoCleanup: true
  });

  // 일별 관리 기능 추가 - URL 파라미터에서 날짜 읽기
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam) return dateParam;
    
    // 기본값은 한국시간 기준 오늘 날짜로 설정
    const now = new Date();
    return now.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateStats, setDateStats] = useState<{ [date: string]: { total: number; classified: number; progress: number } }>({});
  // 카테고리 관리 관련 상태 제거 - 하드코딩 방식 사용

  // 디버그 훅: 백그라운드 동기화 수동 트리거 (개발 모드만)
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__debugTriggerBackgroundSync = async () => {
        console.log('🐛 [Debug] 백그라운드 동기화 수동 트리거');
        const startTime = performance.now();
        
        try {
          const result = await fetchAndHydrate({ scope: 'all' });
          const elapsedMs = Math.round(performance.now() - startTime);
          
          console.log(`🐛 [Debug] 결과 | 성공: ${result.success} | 건수: ${result.count} | 소스: ${result.source} | 소요: ${elapsedMs}ms`);
          
          if (result.success) {
            window.dispatchEvent(new CustomEvent('dataUpdated', {
              detail: { type: 'backgroundSync', timestamp: Date.now(), count: result.count }
            }));
          }
          
          return result;
        } catch (error) {
          console.error('🐛 [Debug] 실패:', error);
          throw error;
        }
      };
      
      console.log('🐛 [Debug] window.__debugTriggerBackgroundSync() 등록됨');
    }
    
    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).__debugTriggerBackgroundSync;
      }
    };
  }, []);

  // 데이터 우선순위 함수 (하이브리드 동기화용)
  const getDataPriority = (item: any): number => {
    // 1. 수동으로 분류된 데이터 (가장 높은 우선순위)
    if (item.collectionType === 'manual' && item.status === 'classified') {
      return 4;
    }
    // 2. 수동으로 수집된 데이터
    if (item.collectionType === 'manual') {
      return 3;
    }
    // 3. 자동 수집된 데이터
    if (item.collectionType === 'auto') {
      return 2;
    }
    // 4. collectionType이 undefined인 자동 수집 데이터
    if (item.collectionType === undefined) {
      return 1;
    }
    // 5. 기타
    return 0;
  };

  // 한국어/영어 판별 함수
  const isKoreanText = (text: string): boolean => {
    const koreanRegex = /[가-힣]/;
    return koreanRegex.test(text);
  };

  // 데이터 업데이트 이벤트 감지
  React.useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      console.log('🔄 데이터 업데이트 이벤트 감지:', event.detail);
      
      // 백업 데이터 보존 플래그 확인 (단, 현재 UI에 데이터가 없으면 강제 로드)
      if (event.detail?.preserveBackupData && unclassifiedData.length > 0) {
        console.log('🔒 백업 데이터 보존 모드 - 데이터 로드 차단 (UI에 데이터 있음)');
        return;
      }
      
      // 현재 UI에 데이터가 없으면 강제로 데이터 로드
      if (unclassifiedData.length === 0) {
        console.log('🔄 UI에 데이터 없음 - 강제 데이터 로드 실행');
      }
      
      // 불필요한 데이터 로드 방지: 이벤트가 없거나 빈 이벤트인 경우 차단
      if (!event.detail || Object.keys(event.detail).length === 0) {
        console.log('🔒 빈 이벤트 감지 - 데이터 로드 차단');
        return;
      }
      
      // 수동/자동 수집 분리 처리에 따른 이벤트 타입 처리
      if (event.detail.type === 'pageFocus') {
        console.log('🔄 페이지 포커스 이벤트 - 데이터 로드 허용');
      } else if (event.detail.type === 'dataUpdated') {
        console.log('🔄 데이터 업데이트 이벤트 - 데이터 로드 허용');
      } else if (event.detail.type === 'backgroundSync') {
        console.log('🔄 백그라운드 동기화 완료 이벤트 - 서버 데이터로 갱신');
      } else if (event.detail.type === 'manualSync') {
        console.log('🔄 수동수집 동기화 완료 이벤트 - 즉시 UI 갱신');
      } else if (event.detail.type === 'autoSync') {
        console.log('🔄 자동수집 동기화 완료 이벤트 - 즉시 UI 갱신');
      } else {
        console.log('🔒 알 수 없는 이벤트 타입 - 데이터 로드 차단:', event.detail.type);
        return;
      }
      
      // 데이터 다시 로드 (일관된 소스 사용)
      const loadData = async () => {
        try {
          console.log('🔄 데이터 분류 관리 페이지 - 데이터 새로고침 시작');
          
          // 백업 복원 중이면 데이터 로드 차단 (데이터 손실 방지)
          if ((window as any).restoreLock || sessionStorage.getItem('restoreInProgress')) {
            console.log('🔒 백업 복원 중이므로 데이터 로드 차단');
            return;
          }
          
          // 1. 서버와 로컬 데이터 병합 (초기 로드와 동일한 로직)
          console.log('🔄 서버와 로컬 데이터 병합 중...');
          const mergeResult = await loadAndMergeDays('overwrite');
          console.log('📊 병합 결과:', mergeResult.stats);
          
          if (mergeResult.conflicts.length > 0) {
            console.log('⚠️ 데이터 충돌 발견:', mergeResult.conflicts);
          }
          
          // 2. 병합된 데이터를 기반으로 통계 계산 - 수동수집만 필터링
          const mergedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
          
          // 🚨 주의: mergeResult.mergedDays는 전체 데이터이므로 사용하지 않음
          // 대신 실제 로드된 데이터에서 수동수집만 재계산
          console.log('📊 병합 완료, 실제 데이터에서 수동수집 통계 재계산 예정');
          
          // 3. 자동수집 데이터 로드
          await loadAutoCollectedData();
          
          // 4. 하이브리드 서비스에서 실제 데이터 로드 (초기 로드와 동일한 로직)
          const savedData = await hybridService.loadUnclassifiedData();
          if (savedData && savedData.length > 0) {
            // utils 함수들은 이미 정적 import됨
            const today = getKoreanDateString();
            const sanitized: UnclassifiedData[] = savedData.map((it: UnclassifiedData) => {
              const baseItem = it.category === '해외채널'
                ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
                : it;
              
              return {
                ...baseItem,
                collectionDate: baseItem.collectionDate || baseItem.uploadDate || today,
                dayKeyLocal: baseItem.dayKeyLocal || baseItem.collectionDate || baseItem.uploadDate
              };
            });
            
            // 중복 제거 적용 (같은 날짜의 같은 영상만 중복 제거)
            console.log('🔄 중복 제거 전:', sanitized.length, '개 항목');
            const dedupedData = dedupeByVideoDay(sanitized as VideoItem[]);
            console.log('✅ 중복 제거 후:', dedupedData.length, '개 항목');
            console.log('📊 제거된 중복:', sanitized.length - dedupedData.length, '개');
            
            setUnclassifiedData(dedupedData as UnclassifiedData[]);
            console.log('✅ 하이브리드 서비스에서 로드 완료:', dedupedData.length);
            
            // 5. 실제 데이터 기반으로 dateStats 재계산 (수동수집만)
            const actualDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
            
            dedupedData.forEach((item: UnclassifiedData) => {
              const dayKey = item.dayKeyLocal || item.collectionDate || item.uploadDate;
              if (!dayKey) return;
              
              // 수동수집만 카운트 (dateStats는 수동수집 섹션에서 사용됨)
              const collectionType = item.collectionType || 'manual';
              if (collectionType !== 'manual') return;
              
              const normalizedKey = dayKey.split('T')[0];
              
              if (!actualDateStats[normalizedKey]) {
                actualDateStats[normalizedKey] = { total: 0, classified: 0, progress: 0 };
              }
              
              actualDateStats[normalizedKey].total++;
              if (item.status === 'classified') {
                actualDateStats[normalizedKey].classified++;
              }
            });
            
            // 진행률 계산
            Object.keys(actualDateStats).forEach(date => {
              const stats = actualDateStats[date];
              stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
            });
            
            setDateStats(actualDateStats);
            console.log('📊 페이지 포커스 - dateStats 재계산 (수동수집만):', actualDateStats);
          } else {
            console.log('📊 저장된 데이터 없음');
            setUnclassifiedData([]);
          }
          
          console.log('✅ 데이터 분류 관리 페이지 - 데이터 새로고침 완료');
        } catch (error) {
          console.error('❌ 데이터 새로고침 실패:', error);
        }
      };
      
      loadData();
    };

    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    // 페이지 포커스 시 데이터 새로고침
    const handlePageFocus = () => {
      // 복원 중이면 동기화 차단
      if ((window as any).restoreLock || sessionStorage.getItem('restoreInProgress')) {
        console.log('🔒 복원 중이므로 포커스 동기화 차단');
        return;
      }
      console.log('🔄 페이지 포커스 감지, 데이터 새로고침');
      handleDataUpdate(new CustomEvent('dataUpdated', { 
        detail: { type: 'pageFocus', timestamp: Date.now() } 
      }));
    };
    
    window.addEventListener('focus', handlePageFocus);
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate as EventListener);
      window.removeEventListener('focus', handlePageFocus);
    };
  }, []);

  // 사용 가능한 날짜 목록 생성 (IndexedDB에서 직접 조회)
  React.useEffect(() => {
    const loadDates = async () => {
      try {
        // utils 함수들은 이미 정적 import됨
        const dates = new Set<string>();
        
        // 오늘 기준 최근 7일 날짜들만 생성 (중복 없이)
        for (let i = 0; i < 7; i++) {
          const date = getKoreanDateStringWithOffset(-i); // i일 전
          dates.add(date);
        }
        
        // 날짜 정렬 (최신순)
        const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
        setAvailableDates(sortedDates);
      } catch (error) {
        console.error('날짜 목록 로드 실패:', error);
        // 오류 시 기본 날짜 목록 생성
        // utils 함수들은 이미 정적 import됨
        const dates = [];
        for (let i = 0; i < 7; i++) {
          const date = getKoreanDateStringWithOffset(-i);
          dates.push(date);
        }
        console.log('📅 날짜 그리드 생성:', dates);
        setAvailableDates(dates);
      }
    };
    
    loadDates();

    // 자정 전환 감지 등록
    const unregisterRollover = dateRolloverService.onRollover((dateKey) => {
      console.log('🔄 자정 전환 감지 - 날짜 그리드 재생성:', dateKey);
      
      // 상태 갱신 → 렌더 타이밍 고정 (동기적 배치 업데이트)
      console.time('rollover-render');
      
      // 날짜 그리드 재계산
      const dates = new Set<string>();
      for (let i = 0; i < 7; i++) {
        const date = getKoreanDateStringWithOffset(-i);
        dates.add(date);
      }
      const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
      
      // 모든 관련 상태를 동시에 업데이트
      setAvailableDates(sortedDates);
      
      console.timeEnd('rollover-render');
      console.log('✅ 날짜 그리드 재생성 완료:', sortedDates);
    });

    // 서비스 초기화 (전역 객체에 등록)
    console.log('🔄 서비스 초기화 중...');
    console.log('dateRolloverService:', dateRolloverService);
    console.log('autoCollectionScheduler:', autoCollectionScheduler);
    console.log('offlineResilienceService:', offlineResilienceService);

    return () => {
      unregisterRollover();
    };
  }, []); // 의존성 배열을 빈 배열로 변경하여 한 번만 실행

  // 분류된 데이터 추출 (기타(미분류)는 제외)
  const classifiedData = unclassifiedData.filter(item => 
    item.status === 'classified' && 
    !(item.category === '기타' && item.subCategory === '기타(미분류)')
  );

  // 일별 분류 진행률 계산 함수
  const calculateDailyProgress = (unclassifiedData: UnclassifiedData[], classifiedData: UnclassifiedData[]): DailyProgressData[] => {
    const progressMap = new Map<string, DailyProgressData>();
    
    // 모든 데이터를 합쳐서 조회수 기준으로 정렬
    const allData = [...unclassifiedData, ...classifiedData];
    const sortedData = allData.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    
    // 같은 날짜의 같은 영상 중복 제거 (조회수 높은 것 우선)
    const videoMap = new Map<string, any>();
    
    sortedData.forEach(item => {
      const dayKey = item.dayKeyLocal || 
                    (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : null) ||
                    (item.uploadDate ? new Date(item.uploadDate).toISOString().split('T')[0] : null);
      
      if (!dayKey) return;
      
      const normalizedDate = item.dayKeyLocal ? item.dayKeyLocal.replace(/-$/, '') : dayKey.split('T')[0];
      const videoKey = `${normalizedDate}_${item.videoId}`;
      
      // 같은 날짜의 같은 영상이면 조회수가 높은 것만 저장
      if (!videoMap.has(videoKey)) {
        videoMap.set(videoKey, item);
      }
    });
    
    // 중복 제거된 데이터로 진행률 계산
    const deduplicatedData = Array.from(videoMap.values());
    
    deduplicatedData.forEach(item => {
      const dayKey = item.dayKeyLocal || 
                    (item.collectionDate ? new Date(item.collectionDate).toISOString().split('T')[0] : null) ||
                    (item.uploadDate ? new Date(item.uploadDate).toISOString().split('T')[0] : null);
      
      if (!dayKey) return;
      
      if (!progressMap.has(dayKey)) {
        progressMap.set(dayKey, {
          date: dayKey,
          autoCollected: 0,
          autoClassified: 0,
          manualCollected: 0,
          manualClassified: 0,
          totalCollected: 0,
          totalClassified: 0,
          autoProgress: 0,
          manualProgress: 0,
          totalProgress: 0
        });
      }
      
      const progress = progressMap.get(dayKey)!;
      // 기타(미분류)는 분류 완료가 아님
      const isClassified = item.status === 'classified' && 
                          !(item.category === '기타' && item.subCategory === '기타(미분류)');
      const collectionType = item.collectionType || 'manual'; // 기본값은 manual (기존 데이터 호환)
      
      // 수집 타입별 카운트
      if (collectionType === 'auto') {
        progress.autoCollected++;
        if (isClassified) progress.autoClassified++;
      } else {
        progress.manualCollected++;
        if (isClassified) progress.manualClassified++;
      }
      
      // 전체 카운트
      progress.totalCollected++;
      if (isClassified) progress.totalClassified++;
    });
    
    // 진행률 계산
    progressMap.forEach(progress => {
      progress.autoProgress = progress.autoCollected > 0 ? 
        Math.round((progress.autoClassified / progress.autoCollected) * 100) : 0;
      progress.manualProgress = progress.manualCollected > 0 ? 
        Math.round((progress.manualClassified / progress.manualCollected) * 100) : 0;
      progress.totalProgress = progress.totalCollected > 0 ? 
        Math.round((progress.totalClassified / progress.totalCollected) * 100) : 0;
    });
    
    // 날짜별로 정렬 (최신 날짜가 먼저)
    return Array.from(progressMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date: string, collectionType?: 'manual' | 'auto' | 'total') => {
    console.log('📅 날짜 클릭됨:', date, '수집타입:', collectionType);
    const url = collectionType 
      ? `/date-classification-detail?date=${date}&type=${collectionType}`
      : `/date-classification-detail?date=${date}`;
    console.log('🔗 이동할 URL:', url);
    navigate(url);
  };

  // 데이터 새로고침 함수
  const refreshData = async () => {
    console.log('🔄 데이터 새로고침 시작...');
    setDataLoaded(false); // 데이터 로드 상태 초기화
    setDateStats({});
    setAutoCollectedStats({});
    setUnclassifiedData([]);
    
    // 강제로 데이터 다시 로드
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('🔄 하이브리드 데이터 로드 시작...');
        
        // 1. 서버와 로컬 데이터 병합
        const mergeResult = await loadAndMergeDays('overwrite');
        console.log('📊 병합 결과:', mergeResult.stats);
        
        if (mergeResult.conflicts.length > 0) {
          console.log('⚠️ 데이터 충돌 발견:', mergeResult.conflicts);
        }
        
        // 2. 병합된 데이터를 기반으로 통계 계산
        const mergedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
        
        mergeResult.mergedDays.forEach(dayRow => {
          mergedDateStats[dayRow.dayKey] = {
            total: dayRow.total,
            classified: dayRow.done,
            progress: dayRow.total > 0 ? Math.round((dayRow.done / dayRow.total) * 100) : 0
          };
        });
        
        setDateStats(mergedDateStats);
        console.log('📊 병합된 dateStats:', mergedDateStats);
        
        // 3. 자동수집 데이터 로드
        await loadAutoCollectedData();
        
        setDataLoaded(true);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    await loadData();
  };


  // 카테고리 관리 함수들 제거 (하드코딩 방식 사용)
  // 세부카테고리는 subcategories.ts에서 직접 수정해야 함

  // 데이터 관리 핸들러들
  const handleRetentionChange = (days: number) => {
    setDataManagementConfig(prev => ({ ...prev, retentionDays: days }));
  };

  const handleAutoCleanupToggle = () => {
    setDataManagementConfig(prev => ({ ...prev, autoCleanup: !prev.autoCleanup }));
  };

  const handleCleanupOldData = async () => {
          const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dataManagementConfig.retentionDays);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    const filteredData = unclassifiedData.filter(item => {
      const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      return itemDate >= cutoffString;
    });
    
    setUnclassifiedData(filteredData);
    await hybridService.updateUnclassifiedData(filteredData);
    
    alert(`✅ ${dataManagementConfig.retentionDays}일 이전 데이터가 정리되었습니다.`);
  };

  const handleAutoCleanup = async () => {
    if (!dataManagementConfig.autoCleanup) return;
    
    await handleCleanupOldData();
    alert('✅ 자동 정리가 완료되었습니다.');
  };

  // 부트스트랩 동기화 핸들러 (사용 안 함 - 삭제됨)
  // const handleBootstrapSync = async () => { ... };

  // 서버 데이터 다운로드 핸들러 (서버 → IndexedDB 단방향)
  const handleHybridSync = async () => {
    try {
      console.log('📥 서버 데이터 다운로드 시작...');
      setIsLoading(true);
      
      // 1. 서버에서 전체 데이터 다운로드
      console.log('📥 서버에서 최신 데이터 다운로드 중...');
      const syncResult = await hybridSyncService.performFullSync();
      console.log('✅ 다운로드 결과:', syncResult);
      
      // 2. 데이터 새로고침
      const loadData = async () => {
        try {
          const savedData = await hybridService.loadUnclassifiedData();
          if (savedData && savedData.length > 0) {
            // utils 함수들은 이미 정적 import됨
            const today = getKoreanDateString();
            
            const sanitized: UnclassifiedData[] = savedData.map((it: UnclassifiedData) => {
              const baseItem = it.category === '해외채널'
                ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
                : it;
              
              return {
                ...baseItem,
                collectionDate: baseItem.collectionDate || baseItem.uploadDate || today,
                dayKeyLocal: baseItem.dayKeyLocal || baseItem.collectionDate || baseItem.uploadDate
              };
            });
            
            // 중복 제거
            const dedupedData = dedupeByVideoDay(sanitized as VideoItem[]);
            setUnclassifiedData(dedupedData as UnclassifiedData[]);
            
            // 날짜별 통계 업데이트 (수동수집만)
            const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
            dedupedData.forEach((item: UnclassifiedData) => {
              const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
              const collectionType = item.collectionType || 'manual';
              if (collectionType !== 'manual') return;
              
              if (date) {
                if (!newDateStats[date]) {
                  newDateStats[date] = { total: 0, classified: 0, progress: 0 };
                }
                newDateStats[date].total++;
                if (item.status === 'classified') {
                  newDateStats[date].classified++;
                }
              }
            });
            
            Object.keys(newDateStats).forEach(date => {
              const stats = newDateStats[date];
              stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
            });
            
            setDateStats(newDateStats);
            console.log('📊 서버 다운로드 후 dateStats 재계산 (수동수집만):', newDateStats);
          }
        } catch (error) {
          console.error('❌ 데이터 새로고침 실패:', error);
        }
      };
      
      await loadData();
      
      // 3. 결과 표시
      alert(`📥 서버 데이터 다운로드 완료!\n\n다운로드: ${syncResult.downloaded}개\n로컬 IndexedDB가 서버 데이터로 업데이트되었습니다.`);
      
    } catch (error) {
      console.error('❌ 서버 다운로드 실패:', error);
      alert('❌ 다운로드 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsLoading(false);
    }
  };

  // 자동수집 시작
  const handleAutoCollection = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 자동수집 시작...');
      
      // System 페이지의 데이터 수집 로직을 여기서 실행
      // startDataCollection은 이미 정적 import됨
      
      // 자동수집 실행
      const result = await startDataCollection();
      
      if (result.success) {
        console.log('✅ 자동수집 완료:', result);
        alert(`🎉 자동수집 완료!\n수집된 영상: ${result.collectedVideos}개\n처리된 채널: ${result.processedChannels}개`);
        
        // 데이터 새로고침
        window.location.reload();
      } else {
        console.error('❌ 자동수집 실패:', result.error);
        alert('❌ 자동수집 실패: ' + result.error);
      }
      
    } catch (error) {
      console.error('❌ 자동수집 오류:', error);
      alert('❌ 자동수집 오류: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Feature flag for bulk save progress
  // 진행률 일괄 저장은 하이브리드 방식 (IndexedDB + 서버)
  const BULK_PROGRESS_ENABLED = true;
  
  // 일별 분류 진행률 일괄 저장 (하이브리드: IndexedDB + PostgreSQL)
  const handleBulkSaveProgress = async () => {
    console.log('🔘 진행률 일괄 저장 버튼 클릭됨');
    
    if (!BULK_PROGRESS_ENABLED) {
      console.log('❌ BULK_PROGRESS_ENABLED = false, 비활성화됨');
      alert('⚠️ 진행률 일괄 저장 기능은 데이터 손실 위험이 있어 현재 비활성화되었습니다.\n\n진행률은 자동으로 계산되어 표시됩니다.');
      return;
    }
    
    // 백업 복원 중이면 일괄 저장 차단 (데이터 손실 방지)
    if ((window as any).restoreLock || sessionStorage.getItem('restoreInProgress')) {
      console.log('❌ 백업 복원 중, 일괄 저장 차단');
      alert('⚠️ 백업 복원 중입니다. 복원이 완료된 후 다시 시도해주세요.');
      return;
    }
    
    console.log('✅ 진행률 일괄 저장 실행 가능, 시작합니다...');
    
    try {
      setIsLoading(true);
      console.log('💾 진행률 일괄 저장 시작...');
      
      // 모든 데이터 추출 (분류 여부와 상관없이) - 백업 데이터 포함
      const currentUIData = unclassifiedData; // 현재 UI에 표시된 데이터
      const existingData = await hybridService.loadUnclassifiedData();
      
      // 현재 UI 데이터와 기존 데이터를 모두 포함
      const allData = [...currentUIData];
      
      // 기존 데이터에서 현재 UI에 없는 데이터 추가 (백업 데이터 포함)
      if (existingData && existingData.length > 0) {
        const existingIds = new Set(currentUIData.map(item => item.id));
        const additionalData = existingData.filter(item => !existingIds.has(item.id));
        allData.push(...additionalData);
      }
      
      // 7일간 모든 날짜 생성 (한국 시간 기준)
      // utils 함수들은 이미 정적 import됨
      const today = getKoreanDateString();
      const sevenDays = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        sevenDays.push(date.toISOString().split('T')[0]);
      }
      
      console.log('📊 일괄저장 - 7일간 날짜들:', sevenDays);
      console.log('📊 일괄저장 - 현재 UI 데이터:', currentUIData.length);
      console.log('📊 일괄저장 - 기존 데이터:', existingData?.length || 0);
      console.log('📊 일괄저장 - 전체 데이터 (백업 포함):', allData.length);
      console.log('📊 일괄저장 - 전체 데이터 날짜 분포:', 
        allData.reduce((acc, item) => {
          const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      // 7일간 모든 날짜에 대해 전체 데이터 생성 (없는 날은 빈 배열)
      const allClassifiedData = [];
      sevenDays.forEach(date => {
        const dateData = allData.filter(item => {
          const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          return itemDate === date;
        });
        allClassifiedData.push(...dateData);
      });

      // 백업 데이터를 포함한 전체 데이터 저장
      const mergedData = [...allData];
      
      console.log('📊 병합 기준 데이터:', {
        currentUI: currentUIData.length,
        existing: existingData?.length || 0,
        merged: mergedData.length
      });
      
      // 안전한 전체 데이터 저장 (기존 데이터 보존)
      if (allData.length > 0) {
        console.log('📊 전체 데이터 개수:', allData.length, '개');
        
        // 분류 데이터 덮어쓰기 (웹에서 변경된 분류 정보 우선)
        allClassifiedData.forEach(dataItem => {
          const existingIndex = mergedData.findIndex(item => item.id === dataItem.id);
          if (existingIndex >= 0) {
            // 웹에서 변경된 분류 정보로 덮어쓰기 (분류 정보 우선)
            mergedData[existingIndex] = { 
              ...mergedData[existingIndex], 
              ...dataItem,
              // 분류 관련 필드는 웹에서 변경된 값으로 강제 덮어쓰기
              category: dataItem.category,
              subCategory: dataItem.subCategory,
              status: dataItem.status,
              // 분류 시간 기록
              classifiedAt: dataItem.classifiedAt || new Date().toISOString()
            };
            console.log(`🔄 데이터 덮어쓰기: ${dataItem.id} - 카테고리: ${dataItem.category}, 상태: ${dataItem.status}`);
          } else {
            // 새로운 데이터 추가
            mergedData.push(dataItem);
          }
        });
        
        // 하이브리드 저장 (IndexedDB + 서버 모두 전체 데이터 저장)
        try {
          // 1. IndexedDB에는 전체 데이터 저장
          await indexedDBService.saveUnclassifiedData(mergedData);
          console.log('✅ IndexedDB: 전체 데이터 저장 완료 (로컬 캐시)');
          
          // 2. 서버에도 전체 데이터 저장 (7일간 모든 데이터 - DELETE + INSERT 방식)
          console.log(`📊 서버 전체 데이터 교체 저장: ${mergedData.length}개 (7일간)`);
          
          if (mergedData.length > 0) {
            try {
              // 날짜 범위 교체 API 사용 (DELETE + INSERT)
              console.log(`🔄 서버 7일 데이터 교체 시작: ${sevenDays.join(', ')}`);
              const replaceResponse = await fetch('https://api.youthbepulse.com/api/replace-date-range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dates: sevenDays,
                  data: mergedData
                })
              });
              
              if (replaceResponse.ok) {
                const replaceResult = await replaceResponse.json();
                console.log(`✅ 서버: 7일 데이터 교체 완료 (삭제: ${replaceResult.deleted}개 날짜, 삽입: ${replaceResult.inserted}개 항목)`);
              } else {
                throw new Error(`서버 교체 실패: ${replaceResponse.status}`);
              }
            } catch (error) {
              // 실패하면 500개씩 배치로 재시도
              console.warn(`⚠️ 전체 저장 실패, 500개씩 배치로 재시도...`, error);
              
              const BATCH_SIZE = 500;
              const totalBatches = Math.ceil(mergedData.length / BATCH_SIZE);
              
              console.log(`📦 배치 업로드 시작: ${mergedData.length}개 → ${totalBatches}개 배치 (500개씩)`);
              
              for (let i = 0; i < mergedData.length; i += BATCH_SIZE) {
                const batch = mergedData.slice(i, i + BATCH_SIZE);
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                
                console.log(`📦 배치 ${batchNum}/${totalBatches} 전송 중... (${batch.length}개)`);
                
                try {
                  await apiService.saveUnclassifiedData(batch);
                  console.log(`✅ 배치 ${batchNum}/${totalBatches} 전송 완료`);
                } catch (batchError) {
                  console.error(`❌ 배치 ${batchNum} 전송 실패:`, batchError);
                }
                
                // 배치 간 1초 지연 (서버 부하 방지)
                if (i + BATCH_SIZE < mergedData.length) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              console.log(`✅ 서버: 전체 데이터 배치 저장 완료 (${totalBatches}개 배치)`);
            }
          }
          
          // 3. 분류된 데이터 전체 저장 (7일간 모든 분류 데이터)
          const classifiedItems = mergedData.filter(item => item.status === 'classified');
          
          console.log(`📊 서버 전체 분류 데이터 저장: ${classifiedItems.length}개 (7일간)`);
          
          if (classifiedItems.length > 0) {
            try {
              // 1차 시도: 전체 데이터 한 번에 전송
              console.log(`📤 전체 분류 데이터 한 번에 전송 시도: ${classifiedItems.length}개`);
              await apiService.saveClassifiedData(classifiedItems);
              console.log(`✅ 서버: 전체 분류 데이터 한 번에 저장 완료`);
            } catch (error) {
              // 실패하면 500개씩 배치로 재시도
              console.warn(`⚠️ 분류 데이터 전체 저장 실패, 500개씩 배치로 재시도...`, error);
              
              const BATCH_SIZE = 500;
              const totalBatches = Math.ceil(classifiedItems.length / BATCH_SIZE);
              
              console.log(`📦 분류 데이터 배치 업로드 시작: ${classifiedItems.length}개 → ${totalBatches}개 배치 (500개씩)`);
              
              for (let i = 0; i < classifiedItems.length; i += BATCH_SIZE) {
                const batch = classifiedItems.slice(i, i + BATCH_SIZE);
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                
                console.log(`📦 분류 배치 ${batchNum}/${totalBatches} 전송 중... (${batch.length}개)`);
                
                try {
                  await apiService.saveClassifiedData(batch);
                  console.log(`✅ 분류 배치 ${batchNum}/${totalBatches} 전송 완료`);
                } catch (batchError) {
                  console.error(`❌ 분류 배치 ${batchNum} 전송 실패:`, batchError);
                }
                
                // 배치 간 1초 지연
                if (i + BATCH_SIZE < classifiedItems.length) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              console.log(`✅ 서버: 전체 분류 데이터 배치 저장 완료 (${totalBatches}개 배치)`);
            }
            
            // 수동수집과 자동수집 분리 처리
            const autoCollectedCount = classifiedItems.filter(item => 
              item.collectionType === 'auto' || item.collectionType === undefined
            ).length;
            const manualCollectedCount = classifiedItems.filter(item => 
              item.collectionType === 'manual'
            ).length;

            console.log(`📊 데이터 분류: 수동수집 ${manualCollectedCount}개, 자동수집 ${autoCollectedCount}개`);

            // 1. 수동수집: 즉시 서버 재조회 (사용자 행위에 의한 즉시 반영 필요)
            if (manualCollectedCount > 0) {
              console.log('🔄 [수동수집] 즉시 서버 재조회 시작...');
              try {
                const serverData = await hybridService.getClassifiedData();
                console.log(`📊 [수동수집] 서버 재조회 결과: ${serverData.length}개 데이터`);
                
                // IndexedDB 덮어쓰기 (서버 데이터 기준)
                if (serverData.length > 0) {
                  await indexedDBService.saveClassifiedData(serverData);
                  console.log('✅ [수동수집] IndexedDB 덮어쓰기 완료 (서버 데이터 기준)');
                  
                  // 즉시 UI 갱신
                  window.dispatchEvent(new CustomEvent('dataUpdated', {
                    detail: { type: 'manualSync', timestamp: Date.now(), count: serverData.length }
                  }));
                }
                
                showToast(`수동수집 데이터 저장 완료! (${manualCollectedCount.toLocaleString()}개)`, {
                  type: 'success',
                  duration: 3000
                });
              } catch (reloadError) {
                console.warn('⚠️ [수동수집] 서버 재조회 실패 (저장은 완료됨):', reloadError);
                
                // 수동수집 실패 시 5분 후 재시도
                showToast('수동수집 저장 완료! 서버 동기화는 5분 후 자동으로 재시도됩니다.', {
                  type: 'info',
                  duration: 4000
                });
                
                setTimeout(async () => {
                  const startTime = performance.now();
                  console.log('🔄 [수동수집-Retry] 백그라운드 재조회 재시도 시작 (5분 경과)');
                  
                  try {
                    const result = await fetchAndHydrate({ scope: 'classified' });
                    const elapsedMs = Math.round(performance.now() - startTime);
                    
                    if (result.success) {
                      console.log(`✅ [수동수집-Retry] 성공 | 건수: ${result.count.toLocaleString()} | 소요: ${elapsedMs}ms | 소스: ${result.source}`);
                      showToast('수동수집 백그라운드 동기화 완료!', { type: 'success' });
                      
                      window.dispatchEvent(new CustomEvent('dataUpdated', {
                        detail: { type: 'backgroundSync', timestamp: Date.now(), count: result.count }
                      }));
                    } else {
                      console.warn(`⚠️ [수동수집-Retry] 재시도 실패 | 소스: ${result.source} | 소요: ${elapsedMs}ms`);
                    }
                  } catch (retryError) {
                    const elapsedMs = Math.round(performance.now() - startTime);
                    console.error(`❌ [수동수집-Retry] 최종 실패 | 소요: ${elapsedMs}ms | 오류:`, retryError);
                  }
                }, 5 * 60 * 1000); // 5분 후
              }
            }

            // 2. 자동수집: 조건부 백그라운드 동기화
            if (autoCollectedCount > 0) {
              if (autoCollectedCount < 10000) {
                // 소량 자동수집: 즉시 재조회
                console.log('🔄 [자동수집-소량] 즉시 서버 재조회 시작...');
                try {
                  const serverData = await hybridService.getClassifiedData();
                  console.log(`📊 [자동수집-소량] 서버 재조회 결과: ${serverData.length}개 데이터`);
                  
                  if (serverData.length > 0) {
                    await indexedDBService.saveClassifiedData(serverData);
                    console.log('✅ [자동수집-소량] IndexedDB 덮어쓰기 완료 (서버 데이터 기준)');
                    
                    // 즉시 UI 갱신
                    window.dispatchEvent(new CustomEvent('dataUpdated', {
                      detail: { type: 'autoSync', timestamp: Date.now(), count: serverData.length }
                    }));
                  }
                  
                  showToast(`자동수집 데이터 저장 완료! (${autoCollectedCount.toLocaleString()}개)`, {
                    type: 'success',
                    duration: 3000
                  });
                } catch (reloadError) {
                  console.warn('⚠️ [자동수집-소량] 서버 재조회 실패 (저장은 완료됨):', reloadError);
                  
                  showToast('자동수집 저장 완료! 서버 동기화는 5분 후 자동으로 재시도됩니다.', {
                    type: 'info',
                    duration: 4000
                  });
                  
                  // 5분 후 재시도
                  setTimeout(async () => {
                    const startTime = performance.now();
                    console.log('🔄 [자동수집-소량-Retry] 백그라운드 재조회 재시도 시작 (5분 경과)');
                    
                    try {
                      const result = await fetchAndHydrate({ scope: 'classified' });
                      const elapsedMs = Math.round(performance.now() - startTime);
                      
                      if (result.success) {
                        console.log(`✅ [자동수집-소량-Retry] 성공 | 건수: ${result.count.toLocaleString()} | 소요: ${elapsedMs}ms | 소스: ${result.source}`);
                        showToast('자동수집 백그라운드 동기화 완료!', { type: 'success' });
                        
                        window.dispatchEvent(new CustomEvent('dataUpdated', {
                          detail: { type: 'backgroundSync', timestamp: Date.now(), count: result.count }
                        }));
                      } else {
                        console.warn(`⚠️ [자동수집-소량-Retry] 재시도 실패 | 소스: ${result.source} | 소요: ${elapsedMs}ms`);
                      }
                    } catch (retryError) {
                      const elapsedMs = Math.round(performance.now() - startTime);
                      console.error(`❌ [자동수집-소량-Retry] 최종 실패 | 소요: ${elapsedMs}ms | 오류:`, retryError);
                    }
                  }, 5 * 60 * 1000); // 5분 후
                }
              } else {
                // 대용량 자동수집: 백그라운드 동기화 예약
                console.log('📊 [자동수집-대용량] 백그라운드 동기화 예약');
                
                // 로컬 완료 상태로 즉시 반영
                showToast(`자동수집 저장 완료! (${autoCollectedCount.toLocaleString()}개) 백그라운드 동기화는 10분 후 자동 실행됩니다.`, {
                  type: 'success',
                  duration: 5000
                });
                
                // 10분 후 백그라운드 동기화
                setTimeout(async () => {
                  const startTime = performance.now();
                  console.log('🔄 [자동수집-대용량] 백그라운드 동기화 시작 (10분 경과)');
                  
                  try {
                    const result = await fetchAndHydrate({ scope: 'classified' });
                    const elapsedMs = Math.round(performance.now() - startTime);
                    
                    if (result.success) {
                      console.log(`✅ [자동수집-대용량] 성공 | 건수: ${result.count.toLocaleString()} | 소요: ${elapsedMs}ms | 소스: ${result.source}`);
                      showToast(`자동수집 대용량 백그라운드 동기화 완료! (${result.count.toLocaleString()}개)`, { type: 'success' });
                      
                      // 데이터 업데이트 이벤트 발생
                      window.dispatchEvent(new CustomEvent('dataUpdated', {
                        detail: { type: 'backgroundSync', timestamp: Date.now(), count: result.count }
                      }));
                    } else {
                      console.warn(`⚠️ [자동수집-대용량] 실패 | 소스: ${result.source} | 소요: ${elapsedMs}ms`);
                    }
                  } catch (bgError) {
                    const elapsedMs = Math.round(performance.now() - startTime);
                    console.error(`❌ [자동수집-대용량] 최종 실패 | 소요: ${elapsedMs}ms | 오류:`, bgError);
                  }
                }, 10 * 60 * 1000); // 10분 후
              }
            }
          }
        } catch (saveError) {
          console.error('❌ 데이터 저장 실패:', saveError);
          throw new Error(`데이터 저장 실패: ${saveError instanceof Error ? saveError.message : '알 수 없는 오류'}`);
        }
      } else {
        console.log('⚠️ 저장할 데이터가 없습니다.');
      }
      
      // 진행률 데이터 생성 (7일간 모든 날짜) - 전체 데이터 사용
      const progressData = sevenDays.map(date => {
        // 전체 데이터에서 해당 날짜 데이터 필터링
        const dateData = allData.filter(item => {
          const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          return itemDate === date;
        });
        
        const total = dateData.length;
        const classified = dateData.filter(item => item.status === 'classified').length;
        const progress = total > 0 ? (classified / total) * 100 : 0;
        
        return {
          date,
          total,
          classified,
          unclassified: total - classified,
          progress: Math.round(progress),
          timestamp: new Date().toISOString()
        };
      });

      // 하이브리드 저장 - 진행률 데이터
      try {
        await hybridService.saveDailyProgress(progressData);
        console.log('✅ 하이브리드: 진행률 데이터 저장 완료 (IndexedDB + 서버)');
      } catch (progressError) {
        console.error('❌ 진행률 데이터 저장 실패:', progressError);
        throw new Error(`진행률 데이터 저장 실패: ${progressError instanceof Error ? progressError.message : '알 수 없는 오류'}`);
      }

      // dailySummary 생성 및 저장 (대시보드용)
      try {
        console.log('📊 dailySummary 생성 시작...');
        
        // 각 날짜별로 dailySummary 생성
        for (const progressItem of progressData) {
          const date = progressItem.date;
          console.log(`📊 ${date} 날짜 dailySummary 생성 중...`);
          
          // 해당 날짜의 분류된 데이터 로드
          const dateData = mergedData.filter(item => {
            const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
            return itemDate && itemDate.split('T')[0] === date;
          });
          
          console.log(`📊 ${date} 날짜 데이터: ${dateData.length}개`);
          
          // dailySummary 생성
          const dailySummary = {
            date: date,
            categories: {} as Record<string, any>
          };
          
          // 모든 카테고리 초기화
          const allCategories = [...new Set(dateData.map(item => item.category).filter(Boolean))];
          allCategories.forEach(category => {
            dailySummary.categories[category] = {
              totalViews: 0,
              count: 0,
              channelCount: 0,
              channels: new Set()
            };
          });
          
          // 카테고리별 통계 계산
          dateData.forEach(item => {
            if (!item.category) return;
            
            if (!dailySummary.categories[item.category]) {
              dailySummary.categories[item.category] = {
                totalViews: 0,
                count: 0,
                channelCount: 0,
                channels: new Set()
              };
            }
            
            dailySummary.categories[item.category].totalViews += item.viewCount || 0;
            dailySummary.categories[item.category].count += 1;
            dailySummary.categories[item.category].channels.add(item.channelName);
          });
          
          // Set을 배열로 변환
          Object.keys(dailySummary.categories).forEach(category => {
            dailySummary.categories[category].channels = Array.from(dailySummary.categories[category].channels);
            dailySummary.categories[category].channelCount = dailySummary.categories[category].channels.length;
          });
          
          // dailySummary 저장
          await indexedDBService.saveDailySummary(date, dailySummary);
          console.log(`✅ ${date} 날짜 dailySummary 저장 완료:`, Object.keys(dailySummary.categories).length, '개 카테고리');
        }
        
        console.log('✅ 모든 날짜 dailySummary 생성 및 저장 완료');
      } catch (dailySummaryError) {
        console.error('❌ dailySummary 생성 실패:', dailySummaryError);
        // dailySummary 실패는 진행을 중단하지 않음 (폴백으로 classifiedData 사용 가능)
      }
      
      // 로컬 상태 업데이트 (백업 데이터 보존)
      if (mergedData.length > 0) {
        // 현재 UI 데이터를 병합된 데이터로 업데이트
        setUnclassifiedData(mergedData as UnclassifiedData[]);
        
        // 통계 재계산
        const updatedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
        mergedData.forEach(item => {
          const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          if (date) {
            if (!updatedDateStats[date]) {
              updatedDateStats[date] = { total: 0, classified: 0, progress: 0 };
            }
            updatedDateStats[date].total++;
            if (item.status === 'classified') {
              updatedDateStats[date].classified++;
            }
          }
        });
        
        // 진행률 계산
        Object.keys(updatedDateStats).forEach(date => {
          const stats = updatedDateStats[date];
          stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
        });
        
        setDateStats(updatedDateStats);
        console.log('📊 로컬 상태 업데이트 완료:', updatedDateStats);
      }
      
      console.log('✅ 진행률 일괄 저장 완료 (IndexedDB + 서버), 백업 데이터 보존하며 로컬 상태 업데이트');
      
      // 다른 페이지들에 데이터 업데이트 알림
      window.dispatchEvent(new CustomEvent('dataUpdated', { 
        detail: { type: 'bulkSaveProgress', timestamp: Date.now() } 
      }));
      window.dispatchEvent(new CustomEvent('dashboardDateChanged', { 
        detail: { selectedDate: today } 
      }));
      
      alert(`✅ 7일간의 분류 진행률과 ${allData.length.toLocaleString()}개의 데이터가 저장되었습니다.\n\n📊 IndexedDB + PostgreSQL 서버에 모두 저장되었습니다.\n\n🔄 모든 페이지가 자동으로 업데이트됩니다.`);
    } catch (error) {
      console.error('진행률 저장 실패:', error);
      console.error('오류 상세:', error);
      
      // 구체적인 오류 메시지 표시
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`❌ 진행률 저장에 실패했습니다.\n\n오류: ${errorMessage}\n\n콘솔을 확인하여 자세한 정보를 확인하세요.`);
    } finally {
      setIsLoading(false);
    }
  };

  // 일자별 백업 다운로드
  const handleDownloadBackup = async (date: string) => {
    try {
      const dateData = unclassifiedData.filter(item => {
        const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
        return itemDate === date;
      });

      if (dateData.length === 0) {
        alert('해당 날짜에 데이터가 없습니다.');
        return;
      }

      const backupData = {
        date,
        totalCount: dateData.length,
        classifiedCount: dateData.filter(item => item.status === 'classified').length,
        unclassifiedCount: dateData.filter(item => item.status === 'unclassified').length,
        data: dateData,
        backupTimestamp: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtubepulse_backup_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ ${date} 날짜 데이터 백업이 완료되었습니다.`);
    } catch (error) {
      console.error('백업 다운로드 실패:', error);
      alert('❌ 백업 다운로드에 실패했습니다.');
    }
  };

  // 전체 백업 다운로드 (하이브리드 방식 개선)
  const handleDownloadAllBackup = async () => {
    try {
      // 하이브리드 백업 형식으로 개선
      const allBackupData = {
        // 메타데이터
        exportDate: new Date().toISOString(),
        version: '2.0', // 하이브리드 버전
        backupType: 'hybrid',
        
        // 통계 정보 (중복 제거 적용)
        summary: (() => {
          // 같은 날짜의 같은 영상 중복 제거 (조회수 높은 것 우선)
          const videoMap = new Map<string, any>();
          const sortedData = [...unclassifiedData].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
          
          sortedData.forEach(item => {
            const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
            if (!date) return;
            
            const normalizedDate = item.dayKeyLocal ? item.dayKeyLocal.replace(/-$/, '') : date.split('T')[0];
            const videoKey = `${normalizedDate}_${item.videoId}`;
            
            if (!videoMap.has(videoKey)) {
              videoMap.set(videoKey, item);
            }
          });
          
          const deduplicatedData = Array.from(videoMap.values());
          
          return {
            totalVideos: deduplicatedData.length,
            classifiedVideos: deduplicatedData.filter(item => item.status === 'classified').length,
            unclassifiedVideos: deduplicatedData.filter(item => item.status === 'unclassified').length,
            manualCollected: deduplicatedData.filter(item => item.collectionType === 'manual').length,
            autoCollected: deduplicatedData.filter(item => item.collectionType === 'auto' || item.collectionType === undefined).length
          };
        })(),
        
        // 일별 데이터 (하이브리드 구조, 중복 제거 적용)
        dailyData: availableDates.slice(0, 7).map(date => {
          const dateData = unclassifiedData.filter(item => {
            const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
            return itemDate === date;
          });
          
          // 같은 날짜의 같은 영상 중복 제거 (조회수 높은 것 우선)
          const videoMap = new Map<string, any>();
          const sortedDateData = [...dateData].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
          
          sortedDateData.forEach(item => {
            const videoKey = `${date}_${item.videoId}`;
            if (!videoMap.has(videoKey)) {
              videoMap.set(videoKey, item);
            }
          });
          
          const deduplicatedDateData = Array.from(videoMap.values());
          
          // 수동수집/자동수집 구분
          const manualData = deduplicatedDateData.filter(item => item.collectionType === 'manual');
          const autoData = deduplicatedDateData.filter(item => item.collectionType === 'auto' || item.collectionType === undefined);
          
          const total = deduplicatedDateData.length;
          const classified = deduplicatedDateData.filter(item => item.status === 'classified').length;
          const progress = total > 0 ? (classified / total) * 100 : 0;
          
          return {
            date,
            total,
            classified,
            unclassified: total - classified,
            progress: Math.round(progress),
            manualCollected: manualData.length,
            manualClassified: manualData.filter(item => item.status === 'classified').length,
            autoCollected: autoData.length,
            autoClassified: autoData.filter(item => item.status === 'classified').length,
            data: dateData // 해당 날짜의 모든 데이터
          };
        }),
        
        // 전체 데이터 (하이브리드 구조)
        allData: unclassifiedData,
        
        // 하이브리드 설정 정보
        hybridConfig: {
          useApiServer: true,
          fallbackToLocal: true,
          syncEnabled: true
        }
      };

      const blob = new Blob([JSON.stringify(allBackupData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtubepulse_full_backup_${getKoreanDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('✅ 전체 데이터 백업이 완료되었습니다.');
    } catch (error) {
      console.error('전체 백업 실패:', error);
      alert('❌ 전체 백업에 실패했습니다.');
    }
  };

  // 하이브리드 중복 제거 기능 (서버 + 로컬 병합)
  const handleRemoveDuplicates = async () => {
    if (!confirm('⚠️ 중복된 데이터를 제거하시겠습니까?\n\n서버와 로컬 데이터를 병합하여:\n- 같은 dayKey의 중복 제거\n- 서버 데이터 우선, 로컬 진행률 보존\n- 일관된 단일 일자 표시')) {
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 하이브리드 중복 제거 시작...');
      
      // 1. 서버와 로컬 데이터 병합
      const mergeResult = await loadAndMergeDays('overwrite');
      console.log('📊 병합 결과:', mergeResult.stats);
      
      // 2. 병합된 데이터를 기반으로 통계 재계산
      const mergedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
      
      mergeResult.mergedDays.forEach(dayRow => {
        mergedDateStats[dayRow.dayKey] = {
          total: dayRow.total,
          classified: dayRow.done,
          progress: dayRow.total > 0 ? Math.round((dayRow.done / dayRow.total) * 100) : 0
        };
      });
      
      setDateStats(mergedDateStats);
      console.log('📊 병합된 dateStats 업데이트:', mergedDateStats);
      
      // 3. 기존 데이터도 업데이트 (하위 호환성)
      const allData = await hybridService.loadUnclassifiedData();
      if (allData && allData.length > 0) {
        // utils 함수들은 이미 정적 import됨
        const today = getKoreanDateString();
        const sanitized: UnclassifiedData[] = allData.map((it: UnclassifiedData) => {
          const baseItem = it.category === '해외채널'
            ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
            : it;
          
          return {
            ...baseItem,
            collectionDate: baseItem.collectionDate || today
          };
        });
        
        setUnclassifiedData(sanitized);
      }
      
      // 4. 충돌 해결 결과 표시
      let conflictMessage = '';
      if (mergeResult.conflicts.length > 0) {
        conflictMessage = `\n⚠️ 해결된 충돌: ${mergeResult.conflicts.length}개`;
        mergeResult.conflicts.forEach(conflict => {
          console.log(`충돌 해결: ${conflict.dayKey} → ${conflict.resolution}`);
        });
      }
      
      alert(`✅ 하이브리드 중복 제거 완료!\n\n` +
            `📊 총 일자: ${mergeResult.mergedDays.length}개\n` +
            `🔄 병합된 일자: ${mergeResult.stats.mergedDays}개\n` +
            `📈 서버 데이터: ${mergeResult.stats.serverDays}개\n` +
            `💾 로컬 데이터: ${mergeResult.stats.localDays}개` +
            conflictMessage);
      
      console.log('✅ 하이브리드 중복 제거 완료 - 일자별 중복 제거됨');
    } catch (error) {
      console.error('하이브리드 중복 제거 실패:', error);
      alert('❌ 하이브리드 중복 제거에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 조회수 기준 삭제 기능
  const handleDeleteByViewCount = async (threshold: number) => {
    const thresholdText = threshold >= 10000 ? `${(threshold / 10000).toFixed(0)}만` : `${threshold}`;
    
    if (!confirm(`⚠️ 조회수 ${thresholdText} 미만 영상을 삭제하시겠습니까?\n\n삭제 후 복구할 수 없습니다!`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      // 전체 데이터 로드
      const allData = await hybridService.loadUnclassifiedData();
      
      // 조회수 필터링
      const filteredData = allData.filter((item: UnclassifiedData) => item.viewCount >= threshold);
      const deletedCount = allData.length - filteredData.length;
      
      if (deletedCount === 0) {
        alert(`조회수 ${thresholdText} 미만 영상이 없습니다.`);
        setIsLoading(false);
        return;
      }
      
      // 전체 교체 저장
      // indexedDBService는 이미 정적 import됨
      await indexedDBService.replaceAllUnclassifiedData(filteredData);
      console.log(`✅ 조회수 ${thresholdText} 미만 ${deletedCount}개 영상 삭제 완료`);
      
      setUnclassifiedData(filteredData);
      
      // 날짜별 통계 재계산
      const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
      filteredData.forEach(item => {
        const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
        if (date) {
          if (!newDateStats[date]) {
            newDateStats[date] = { total: 0, classified: 0, progress: 0 };
          }
          newDateStats[date].total++;
          if (item.status === 'classified') {
            newDateStats[date].classified++;
          }
        }
      });
      
      Object.keys(newDateStats).forEach(date => {
        const stats = newDateStats[date];
        stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
      });
      
      setDateStats(newDateStats);
      
      alert(`✅ 조회수 기준 삭제 완료!\n\n` +
            `🗑️ 삭제된 영상: ${deletedCount}개\n` +
            `✅ 남은 영상: ${filteredData.length}개\n\n` +
            `완료되었습니다.`);
      
      // 페이지 새로고침 대신 상태만 업데이트
      console.log('✅ 조회수 기준 삭제 완료 - 상태 업데이트됨');
    } catch (error) {
      console.error('조회수 기준 삭제 실패:', error);
      alert('❌ 조회수 기준 삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 하이브리드 동기화 기능
  const handleSyncData = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 하이브리드 동기화 시작...');
      
      // 동기화 필요 여부 확인
      const syncCheck = await checkSyncNeeded();
      if (!syncCheck.needed) {
        alert(`✅ 동기화 불필요\n\n이유: ${syncCheck.reason}\n마지막 동기화: ${new Date(syncCheck.lastSync).toLocaleString('ko-KR')}`);
        return;
      }
      
      // 전체 동기화 실행
      const syncResult = await performFullSync('https://api.youthbepulse.com', 'overwrite');
      
      if (!syncResult.success) {
        throw new Error(syncResult.error || '동기화 실패');
      }
      
      // 동기화 결과를 기반으로 통계 재계산
      const syncedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
      
      syncResult.mergedDays.forEach(dayRow => {
        syncedDateStats[dayRow.dayKey] = {
          total: dayRow.total,
          classified: dayRow.done,
          progress: dayRow.total > 0 ? Math.round((dayRow.done / dayRow.total) * 100) : 0
        };
      });
      
      setDateStats(syncedDateStats);
      console.log('📊 동기화된 dateStats:', syncedDateStats);
      
      // 기존 데이터도 업데이트 (하위 호환성)
      const allData = await hybridService.loadUnclassifiedData();
      if (allData && allData.length > 0) {
        // utils 함수들은 이미 정적 import됨
        const today = getKoreanDateString();
        const sanitized: UnclassifiedData[] = allData.map((it: UnclassifiedData) => {
          const baseItem = it.category === '해외채널'
            ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
            : it;
          
          return {
            ...baseItem,
            collectionDate: baseItem.collectionDate || today
          };
        });
        
        setUnclassifiedData(sanitized);
      }
      
      // 동기화 결과 표시
      let conflictMessage = '';
      if (syncResult.conflicts.length > 0) {
        conflictMessage = `\n⚠️ 해결된 충돌: ${syncResult.conflicts.length}개`;
        syncResult.conflicts.forEach(conflict => {
          console.log(`동기화 충돌 해결: ${conflict.dayKey} → ${conflict.resolution}`);
        });
      }
      
      alert(`✅ 하이브리드 동기화 완료!\n\n` +
            `📊 총 일자: ${syncResult.mergedDays.length}개\n` +
            `📤 업로드: ${syncResult.stats.uploaded}개\n` +
            `📥 다운로드: ${syncResult.stats.downloaded}개\n` +
            `🔄 병합: ${syncResult.stats.conflicts}개\n` +
            `⏰ 동기화 시간: ${new Date(syncResult.status.lastSync).toLocaleString('ko-KR')}` +
            conflictMessage);
      
      console.log('✅ 하이브리드 동기화 완료 - 서버 ↔ 로컬 동기화됨');
    } catch (error) {
      console.error('하이브리드 동기화 실패:', error);
      alert('❌ 하이브리드 동기화에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };


  // 일자별 중복 제거 핸들러
  const handleRemoveDuplicatesByDate = async () => {
    try {
      setIsLoading(true);
      console.log('🗑️ 일자별 중복 제거 시작...');
      
      // IndexedDB 열기
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('YouTubePulseDB', 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      
      // 트랜잭션 시작
      const transaction = db.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      // 모든 데이터 가져오기
      const allData = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      
      console.log(`📊 전체 데이터: ${allData.length}개 항목`);
      
      // 일자별로 그룹핑
      const dateGroups = new Map();
      for (const item of allData) {
        const dateKey = item.dayKeyLocal || item.collectionDate || 'unknown';
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }
        dateGroups.get(dateKey).push(item);
      }
      
      console.log(`📅 일자별 그룹: ${dateGroups.size}개`);
      
      let totalRemoved = 0;
      const results = [];
      
      // 각 일자별로 처리
      for (const [dateKey, items] of dateGroups) {
        console.log(`\n📅 처리 중: ${dateKey} (${items.length}개 항목)`);
        
        // 같은 영상 제목으로 그룹핑
        const titleGroups = new Map();
        for (const item of items) {
          const title = item.videoTitle || item.video_title || 'Unknown Title';
          if (!titleGroups.has(title)) {
            titleGroups.set(title, []);
          }
          titleGroups.get(title).push(item);
        }
        
        let dateRemoved = 0;
        const dateResults = [];
        
        // 같은 제목의 영상들 중 조회수가 높은 것만 남기기
        for (const [title, titleItems] of titleGroups) {
          if (titleItems.length > 1) {
            console.log(`  🎬 "${title}" - ${titleItems.length}개 중복 발견`);
            
            // 조회수 기준으로 정렬 (높은 순)
            titleItems.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
            
            // 가장 높은 조회수 항목만 유지
            const keepItem = titleItems[0];
            const removeItems = titleItems.slice(1);
            
            console.log(`    ✅ 유지: ${keepItem.viewCount || 0} 조회수`);
            console.log(`    🗑️ 삭제: ${removeItems.length}개 항목`);
            
            // 삭제할 항목들을 IndexedDB에서 제거
            for (const removeItem of removeItems) {
              await new Promise((resolve, reject) => {
                const request = store.delete(removeItem.id);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
              });
            }
            
            dateRemoved += removeItems.length;
            dateResults.push({
              title,
              kept: 1,
              removed: removeItems.length,
              maxViews: keepItem.viewCount || 0
            });
          }
        }
        
        totalRemoved += dateRemoved;
        results.push({
          date: dateKey,
          totalItems: items.length,
          removed: dateRemoved,
          remaining: items.length - dateRemoved,
          details: dateResults
        });
        
        console.log(`  📊 ${dateKey}: ${dateRemoved}개 제거, ${items.length - dateRemoved}개 유지`);
      }
      
      console.log('\n🎉 일자별 중복 영상 제거 완료!');
      console.log(`📊 총 제거: ${totalRemoved}개 항목`);
      console.log(`📊 남은 항목: ${allData.length - totalRemoved}개 항목`);
      
      // 결과 상세 출력
      let resultMessage = `🎉 일자별 중복 영상 제거 완료!\n\n`;
      resultMessage += `📊 총 제거: ${totalRemoved}개 항목\n`;
      resultMessage += `📊 남은 항목: ${allData.length - totalRemoved}개 항목\n\n`;
      
      resultMessage += `📋 일자별 결과:\n`;
      results.forEach(result => {
        if (result.removed > 0) {
          resultMessage += `  📅 ${result.date}: ${result.removed}개 제거\n`;
          result.details.forEach(detail => {
            resultMessage += `    🎬 "${detail.title}": ${detail.removed}개 제거, ${detail.maxViews} 조회수 유지\n`;
          });
        }
      });
      
      alert(resultMessage);
      
      // 서버(PostgreSQL) 중복 정리도 실행
      try {
        console.log('🔄 서버 중복 정리 시작...');
        const serverResponse = await fetch('https://api.youthbepulse.com/api/cleanup-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (serverResponse.ok) {
          const serverResult = await serverResponse.json();
          console.log('✅ 서버 중복 정리 완료:', serverResult);
          
          // 서버 결과도 알림에 추가
          const serverMessage = `\n🔄 서버 중복 정리 결과:\n`;
          const serverStats = `📊 서버: ${serverResult.stats?.removed || 0}개 제거, ${serverResult.stats?.remaining || 0}개 유지\n`;
          
          alert(resultMessage + serverMessage + serverStats);
        } else {
          console.log('⚠️ 서버 중복 정리 실패 (계속 진행)');
          alert(resultMessage + '\n\n⚠️ 서버 중복 정리는 실패했지만 로컬 정리는 완료되었습니다.');
        }
      } catch (serverError) {
        console.log('⚠️ 서버 중복 정리 오류:', serverError);
        alert(resultMessage + '\n\n⚠️ 서버 중복 정리는 실패했지만 로컬 정리는 완료되었습니다.');
      }
      
      // 데이터 새로고침
      window.location.reload();
      
    } catch (error) {
      console.error('❌ 일자별 중복 제거 실패:', error);
      alert('❌ 일자별 중복 제거에 실패했습니다: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 하이브리드 자동 수집 데이터 가져오기 (서버 + 로컬 병합)
  const handleFetchAutoCollected = async (action: 'download' | 'merge') => {
    try {
      setIsLoading(true);
      console.log('🔄 하이브리드 자동 수집 데이터 처리 시작...');
      
      if (action === 'download') {
        // API에서 자동 수집 데이터 조회
        const response = await fetch('https://api.youthbepulse.com/api/auto-collected');
        const result = await response.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
          alert('자동 수집된 데이터가 없습니다.');
          setIsLoading(false);
          return;
        }
        
        // 가장 최신 자동 수집 데이터 사용
        const latestCollection = result.data[0];
        const autoCollectedData = latestCollection.data;
        const collectedAt = new Date(latestCollection.collectedAt).toLocaleString('ko-KR');
        
        console.log(`📥 자동 수집 데이터: ${autoCollectedData.length}개 (수집 시간: ${collectedAt})`);
        
        // JSON 다운로드
        const blob = new Blob([JSON.stringify(autoCollectedData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auto-collected-${getKoreanDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`✅ 자동 수집 데이터 다운로드 완료!\n\n수집 시간: ${collectedAt}\n데이터: ${autoCollectedData.length}개`);
      } else if (action === 'merge') {
        // 하이브리드 병합 방식으로 자동 수집 데이터 통합
        const mergeResult = await loadAndMergeDays('union'); // union 모드로 수동 + 자동 데이터 합산
        
        console.log('📊 자동 수집 병합 결과:', mergeResult.stats);
        
        // 병합된 데이터를 기반으로 통계 재계산
        const mergedDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
        
        mergeResult.mergedDays.forEach(dayRow => {
          mergedDateStats[dayRow.dayKey] = {
            total: dayRow.total,
            classified: dayRow.done,
            progress: dayRow.total > 0 ? Math.round((dayRow.done / dayRow.total) * 100) : 0
          };
        });
        
        setDateStats(mergedDateStats);
        console.log('📊 자동 수집 병합된 dateStats:', mergedDateStats);
        
        // 기존 데이터도 업데이트 (하위 호환성)
        const allData = await hybridService.loadUnclassifiedData();
        if (allData && allData.length > 0) {
          // utils 함수들은 이미 정적 import됨
          const today = getKoreanDateString();
          const sanitized: UnclassifiedData[] = allData.map((it: UnclassifiedData) => {
            const baseItem = it.category === '해외채널'
              ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
              : it;
            
            return {
              ...baseItem,
              collectionDate: baseItem.collectionDate || today
            };
          });
          
          setUnclassifiedData(sanitized);
        }
        
        // 충돌 해결 결과 표시
        let conflictMessage = '';
        if (mergeResult.conflicts.length > 0) {
          conflictMessage = `\n⚠️ 해결된 충돌: ${mergeResult.conflicts.length}개`;
          mergeResult.conflicts.forEach(conflict => {
            console.log(`자동 수집 충돌 해결: ${conflict.dayKey} → ${conflict.resolution}`);
          });
        }
        
        alert(`✅ 하이브리드 자동 수집 데이터 병합 완료!\n\n` +
              `📊 총 일자: ${mergeResult.mergedDays.length}개\n` +
              `🔄 병합된 일자: ${mergeResult.stats.mergedDays}개\n` +
              `📈 서버 데이터: ${mergeResult.stats.serverDays}개\n` +
              `💾 로컬 데이터: ${mergeResult.stats.localDays}개\n` +
              `🔗 수동 + 자동 데이터 통합 완료` +
              conflictMessage);
        
        console.log('✅ 하이브리드 자동 수집 데이터 병합 완료 - 일자별 통합됨');
      }
    } catch (error) {
      console.error('하이브리드 자동 수집 데이터 처리 실패:', error);
      alert('❌ 하이브리드 자동 수집 데이터 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 백업 복원 - 완전 안전한 패턴
  const handleRestoreBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setIsLoading(true);
          console.log('🔄 백업 복원 시작...');
          
          // 복원 락 설정 (동시 이벤트 차단)
          sessionStorage.setItem('restoreInProgress', 'true');
          (window as any).restoreLock = true; // 전역 락 설정
          
          const text = event.target?.result as string;
          let restoredData;

          // 1. 비동기 준비: JSON 파싱 및 검증
          try {
            restoredData = JSON.parse(text);
            console.log('✅ JSON 파싱 완료');
          } catch (parseError) {
            console.error('❌ JSON 파싱 실패:', parseError);
            alert('❌ 잘못된 JSON 파일입니다.');
            return;
          }

          // 데이터 형식 확인 및 디버깅
          console.log('📊 복원할 데이터 구조:', restoredData);
          console.log('📊 데이터 타입:', typeof restoredData);
          console.log('📊 배열 여부:', Array.isArray(restoredData));
          console.log('📊 data 속성 존재:', restoredData.data ? '있음' : '없음');
          console.log('📊 dailyData 속성 존재:', restoredData.dailyData ? '있음' : '없음');
          
          // 날짜별 내보내기 파일인 경우 dailyData 처리 (최우선 처리)
          if (restoredData.dailyData && Array.isArray(restoredData.dailyData)) {
            console.log('📊 날짜별 내보내기 파일 감지, dailyData 처리 중...');
            console.log('📊 dailyData 내용:', restoredData.dailyData);
            
            // 안전성 검증: 각 항목이 유효한 구조인지 확인
            const validDailyData = restoredData.dailyData.filter((dayData: any) => {
              if (!dayData) {
                console.warn('⚠️ undefined 또는 null 항목 건너뜀');
                return false;
              }
              if (!dayData.data || !Array.isArray(dayData.data)) {
                console.warn('⚠️ data 배열이 없는 항목 건너뜀:', dayData);
                return false;
              }
              return true;
            });
            
            console.log(`📊 유효한 날짜: ${validDailyData.length}/${restoredData.dailyData.length}`);
            
            // 모든 날짜의 데이터를 하나의 배열로 합치기
            const allData = validDailyData.flatMap((dayData: any) => dayData.data || []);
            console.log(`📊 ${validDailyData.length}일간의 데이터를 합쳐서 총 ${allData.length}개 복원`);
            
            if (allData.length > 0) {
              
              const confirmed = confirm(
                `백업 파일에서 ${validDailyData.length}일간의 데이터를 복원하시겠습니까?\n\n` +
                `총 ${allData.length}개의 데이터가 복원됩니다.\n\n` +
                `⚠️ 현재 데이터는 모두 덮어씌워집니다.`
              );
              
              if (confirmed) {
                console.log('🔄 2. 트랜잭션 시작 후 upsert 처리...');
                
                // 2. 단일 트랜잭션으로 안전한 upsert 처리
                try {
                  await hybridService.saveUnclassifiedData(allData);
                  console.log('✅ IndexedDB upsert 완료');
                  
                  // 3. UI 상태 업데이트 (트랜잭션 완료 후)
                setUnclassifiedData(allData);
                  console.log('✅ UI 상태 업데이트 완료');
                } catch (dbError) {
                  console.error('❌ IndexedDB 저장 실패:', dbError);
                  alert('❌ 데이터 저장에 실패했습니다. 다시 시도해주세요.');
                  return;
                }
                
                // dailyData를 classifiedData와 dailyProgress로도 하이브리드 저장 (원본 데이터 사용)
                const classifiedData = allData.filter((item: any) => item.status === 'classified');
                if (classifiedData.length > 0) {
                  await hybridService.saveClassifiedData(classifiedData);
                  console.log(`📊 ${classifiedData.length}개의 분류된 데이터도 저장 완료`);
                }
                
                // dailyProgress 데이터 생성 및 하이브리드 저장 (원본 날짜 기준, 유효한 데이터만)
                const progressData = validDailyData
                  .filter((dayData: any) => dayData.date) // 날짜가 있는 항목만
                  .map((dayData: any) => ({
                    date: dayData.date,
                    total: dayData.total || 0,
                    classified: dayData.classified || 0,
                    unclassified: dayData.unclassified || 0,
                    progress: dayData.progress || 0
                  }));
                await hybridService.saveDailyProgress(progressData);
                console.log(`📊 ${progressData.length}일간의 진행률 데이터 저장 완료`);
                
                // dateStats 상태 강제 업데이트 (원본 데이터 사용)
                const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
                allData.forEach((item: any) => {
                  const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
                  if (date) {
                    if (!newDateStats[date]) {
                      newDateStats[date] = { total: 0, classified: 0, progress: 0 };
                    }
                    newDateStats[date].total++;
                    if (item.status === 'classified') {
                      newDateStats[date].classified++;
                    }
                  }
                });
                
                // 진행률 계산
                Object.keys(newDateStats).forEach(date => {
                  const stats = newDateStats[date];
                  stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
                });
                
                setDateStats(newDateStats);
                console.log('📊 백업 복원 후 dateStats 업데이트:', newDateStats);
                
                // 4. 완료 신호: transaction.oncomplete 후에만 토스트 표시
                console.log('🎉 백업 복원 완료 - transaction.oncomplete 감지');
                alert(`✅ 백업 복원이 완료되었습니다!\n\n` +
                      `📅 ${validDailyData.length}일간의 데이터를 원본 날짜로 복원\n` +
                      `📊 총 ${allData.length}개 데이터 복원\n` +
                      `✅ ${classifiedData.length}개 분류된 데이터 저장\n` +
                      `📈 ${progressData.length}일간 진행률 데이터 저장\n\n` +
                      `📅 백업된 날짜들이 자동으로 표시됩니다.`);
              }
            }
          } else {
            // 일반 백업 파일 처리
            const dataToRestore = restoredData.data || restoredData;
            if (Array.isArray(dataToRestore)) {
              const confirmed = confirm(
                `백업 파일에서 ${dataToRestore.length}개의 데이터를 복원하시겠습니까?\n\n` +
                `⚠️ 현재 데이터는 모두 덮어씌워집니다.`
              );
              
              if (confirmed) {
                await hybridService.saveUnclassifiedData(dataToRestore);
                setUnclassifiedData(dataToRestore);
                
                // dateStats 상태 강제 업데이트
                const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
                dataToRestore.forEach((item: any) => {
                  const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
                  if (date) {
                    if (!newDateStats[date]) {
                      newDateStats[date] = { total: 0, classified: 0, progress: 0 };
                    }
                    newDateStats[date].total++;
                    if (item.status === 'classified') {
                      newDateStats[date].classified++;
                    }
                  }
                });
                
                // 진행률 계산
                Object.keys(newDateStats).forEach(date => {
                  const stats = newDateStats[date];
                  stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
                });
                
                setDateStats(newDateStats);
                console.log('📊 일반 백업 복원 후 dateStats 업데이트:', newDateStats);
                
                alert('✅ 백업 복원이 완료되었습니다.');
              }
            } else {
              console.error('❌ 복원할 수 있는 데이터를 찾을 수 없습니다.');
              alert('❌ 지원하지 않는 백업 파일 형식입니다.\n\n콘솔에서 파일 구조를 확인해주세요.');
            }
          }
        } catch (error) {
          console.error('❌ 백업 복원 실패:', error);
          alert('❌ 백업 복원에 실패했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
          // 복원 락 해제
          sessionStorage.removeItem('restoreInProgress');
          (window as any).restoreLock = false; // 전역 락 해제
          setIsLoading(false);
          console.log('🔄 백업 복원 프로세스 종료');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 날짜별 내보내기 (여러 날짜 선택 가능)
  const handleExportByDates = async () => {
    try {
      // 데이터가 있는 날짜들만 필터링
      const datesWithData = availableDates.slice(0, 7).filter(date => {
        const dateData = unclassifiedData.filter(item => {
          const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          return itemDate === date;
        });
        return dateData.length > 0;
      });

      if (datesWithData.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
      }

      // 각 날짜별로 데이터 구성
      const exportData = datesWithData.map(date => {
        const dateData = unclassifiedData.filter(item => {
          // 1. collectionDate 또는 uploadDate 확인
          const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          if (itemDate === date) return true;
          
          // 2. ID 타임스탬프 확인 (실제 수집 시간)
          if (item.id && typeof item.id === 'string') {
            const idStr = item.id as string;
            const parts = idStr.split('_');
            if (parts.length > 0) {
              const timestamp = parseInt(parts[0]);
              if (!isNaN(timestamp)) {
                const actualDate = new Date(timestamp).toISOString().split('T')[0];
                if (actualDate === date) return true;
              }
            }
          }
          
          return false;
        });
        
        const total = dateData.length;
        const classified = dateData.filter(item => item.status === 'classified').length;
        const progress = total > 0 ? (classified / total) * 100 : 0;
        
        return {
          date,
          total,
          classified,
          unclassified: total - classified,
          progress: Math.round(progress),
          data: dateData
        };
      });

      const backupData = {
        exportDate: new Date().toISOString(),
        exportType: 'dateRange',
        dateRange: {
          from: datesWithData[datesWithData.length - 1], // 가장 오래된 날짜
          to: datesWithData[0] // 가장 최근 날짜
        },
        totalDates: datesWithData.length,
        totalVideos: exportData.reduce((sum, day) => sum + day.total, 0),
        totalClassified: exportData.reduce((sum, day) => sum + day.classified, 0),
        totalUnclassified: exportData.reduce((sum, day) => sum + day.unclassified, 0),
        dailyData: exportData,
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtubepulse_dateRange_${datesWithData[0]}_to_${datesWithData[datesWithData.length - 1]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ ${datesWithData.length}일간의 데이터 내보내기가 완료되었습니다.`);
    } catch (error) {
      console.error('날짜별 내보내기 실패:', error);
      alert('❌ 날짜별 내보내기에 실패했습니다.');
    }
  };

  // 특정 기간 내보내기 (사용자 선택)
  const handleExportCustomRange = async () => {
    const startDate = prompt('시작 날짜를 입력하세요 (YYYY-MM-DD):');
    const endDate = prompt('종료 날짜를 입력하세요 (YYYY-MM-DD):');
    
    if (!startDate || !endDate) {
      alert('시작 날짜와 종료 날짜를 모두 입력해주세요.');
      return;
    }

    try {
      // 날짜 범위 내의 데이터 필터링
      const rangeData = unclassifiedData.filter(item => {
        const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
        return itemDate >= startDate && itemDate <= endDate;
      });

      if (rangeData.length === 0) {
        alert('선택한 기간에 데이터가 없습니다.');
        return;
      }

      // 날짜별로 그룹화
      const groupedData = rangeData.reduce((acc, item) => {
        const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const exportData = Object.entries(groupedData).map(([date, data]) => {
        const total = data.length;
        const classified = data.filter(item => item.status === 'classified').length;
        const progress = total > 0 ? (classified / total) * 100 : 0;
        
        return {
          date,
          total,
          classified,
          unclassified: total - classified,
          progress: Math.round(progress),
          data
        };
      });

      const backupData = {
        exportDate: new Date().toISOString(),
        exportType: 'customRange',
        dateRange: {
          from: startDate,
          to: endDate
        },
        totalDates: exportData.length,
        totalVideos: rangeData.length,
        totalClassified: rangeData.filter(item => item.status === 'classified').length,
        totalUnclassified: rangeData.filter(item => item.status === 'unclassified').length,
        dailyData: exportData,
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtubepulse_customRange_${startDate}_to_${endDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ ${startDate} ~ ${endDate} 기간의 데이터 내보내기가 완료되었습니다.`);
    } catch (error) {
      console.error('커스텀 범위 내보내기 실패:', error);
      alert('❌ 커스텀 범위 내보내기에 실패했습니다.');
    }
  };

  // 선택된 날짜 기준 14일 데이터 필터링
  const getDateRange = (startDate: string) => {
    const dates = [];
    const start = new Date(startDate);
    for (let i = 0; i < 14; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const dateRange = getDateRange(selectedDate);
  const filteredData = unclassifiedData.filter(item => {
    const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
    return itemDate && dateRange.includes(itemDate.split('T')[0]);
  });

  // 통계 계산 (일별 분류 진행률 섹션의 데이터만 합쳐서 계산 - 최근 7일)
  const totalVideos = availableDates.slice(0, 7).reduce((sum, date) => {
    const stats = dateStats[date] || { total: 0, classified: 0, progress: 0 };
    return sum + stats.total;
  }, 0);
  
  const classifiedVideos = availableDates.slice(0, 7).reduce((sum, date) => {
    const stats = dateStats[date] || { total: 0, classified: 0, progress: 0 };
    return sum + stats.classified;
  }, 0);
  
  const unclassifiedVideos = totalVideos - classifiedVideos;
  const pendingVideos = 0; // 일별 진행률에서는 pending 상태를 별도로 관리하지 않음
  const classificationProgress = totalVideos > 0 ? (classifiedVideos / totalVideos) * 100 : 0;

  // 카테고리별 통계 (선택된 날짜 기준 7일 데이터만)
  const categoryStats = filteredData.reduce((acc, item) => {
    if (item.status === 'classified' && item.category) {
      if (!acc[item.category]) {
        acc[item.category] = { count: 0, totalViews: 0 };
      }
      acc[item.category].count += 1;
      acc[item.category].totalViews += item.viewCount || 0;
    }
    return acc;
  }, {} as Record<string, { count: number; totalViews: number }>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">데이터를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 네비게이션 */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Database className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">YouTubePulse</h1>
              </div>
              </div>
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/user-management')}>
                  <Users className="w-4 h-4 mr-2" />
                  회원관리
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <Eye className="w-4 h-4 mr-2" />
                  국내
                </Button>
              <Button variant="outline" onClick={() => navigate('/system')}>
                  <Settings className="w-4 h-4 mr-2" />
                  시스템
                </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">데이터 분류 관리</h1>
            <p className="text-muted-foreground mt-2">YouTube 영상 데이터를 카테고리별로 분류하고 관리합니다.</p>
            <p className="text-xs text-muted-foreground mt-1">
              💡 세부카테고리는 <code className="bg-muted px-1 rounded">src/lib/subcategories.ts</code> 파일에서 수정할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              기간: {dateRange[6]} ~ {dateRange[0]} (7일간)
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">전체 영상</p>
                <p className="text-2xl font-bold text-foreground">{totalVideos.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">7일간</p>
              </div>
              <Database className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">분류 완료</p>
                <p className="text-2xl font-bold text-green-600">{classifiedVideos.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">7일간</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">미분류</p>
                <p className="text-2xl font-bold text-red-600">{unclassifiedVideos.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">7일간</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">분류 진행률</p>
                <p className="text-2xl font-bold text-primary">{Math.round(classificationProgress)}%</p>
                <p className="text-xs text-muted-foreground">7일간</p>
              </div>
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-sm">{Math.round(classificationProgress)}%</span>
              </div>
            </div>
          </Card>
        </div>

        {/* 카테고리 관리 섹션 제거 - 하드코딩 방식 사용 */}
        {/* 세부카테고리는 src/lib/subcategories.ts 파일에서 직접 수정 */}

        {/* 일별 분류 진행률 */}
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-semibold text-foreground">일별 분류 진행</h2>
              </div>
            <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                size="sm" 
                onClick={handleBulkSaveProgress}
                disabled={!BULK_PROGRESS_ENABLED}
                className="flex items-center space-x-1 opacity-50"
                title={BULK_PROGRESS_ENABLED ? "진행률 일괄 저장" : "데이터 손실 위험으로 비활성화됨"}
              >
                <SaveAll className="w-4 h-4" />
                <span>진행률 일괄 저장</span>
                    </Button>
                  
                          <Button
                variant="outline" 
                            size="sm"
                onClick={handleRestoreBackup}
                className="flex items-center space-x-1"
                          >
                <Upload className="w-4 h-4" />
                <span>백업 복원하기</span>
                          </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleHybridSync}
                className="flex items-center space-x-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                title="서버에서 최신 데이터 다운로드하여 IndexedDB 동기화"
              >
                <RefreshCw className="w-4 h-4" />
                <span>서버 데이터 다운로드</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRemoveDuplicatesByDate}
                className="flex items-center space-x-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                title="같은 날짜에서 같은 영상 제목 중 조회수 높은 것만 유지하고 나머지 삭제"
              >
                <Trash2 className="w-4 h-4" />
                <span>일자별 중복 제거</span>
              </Button>
              
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center space-x-1 border-red-500 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                    <span>조회수 필터</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDeleteByViewCount(50000)}>
                    <XCircle className="w-4 h-4 mr-2 text-red-500" />
                    조회수 5만 미만 삭제
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDeleteByViewCount(100000)}>
                    <XCircle className="w-4 h-4 mr-2 text-red-500" />
                    조회수 10만 미만 삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center space-x-1">
                    <Download className="w-4 h-4" />
                    <span>데이터 내보내기</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportByDates}>
                    <Calendar className="w-4 h-4 mr-2" />
                    날짜별 내보내기 (최근 7일)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCustomRange}>
                    <Filter className="w-4 h-4 mr-2" />
                    기간 선택 내보내기
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadAllBackup}>
                    <Archive className="w-4 h-4 mr-2" />
                    전체 백업
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* 3행 × 7열 그리드 */}
          <div className="space-y-4">
            {/* 수동수집 행 */}
            <div>
              <h3 className="text-sm font-medium text-white mb-2">수동수집</h3>
              <div className="grid grid-cols-7 gap-3">
            {availableDates.slice(0, 7).map(date => {
                  // 수동수집 데이터 (실제 데이터 기반)
              const stats = dateStats[date] || { total: 0, classified: 0, progress: 0 };
              const total = stats.total;
              const classified = stats.classified;
              const progress = stats.progress;
              const hasData = total > 0;
              
              return (
                <div 
                      key={`manual-${date}`}
                  className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 active:scale-95"
                  onClick={() => handleDateClick(date, 'manual')}
                  title={`${date} 수동수집 데이터 분류하기 - 클릭하여 상세 페이지로 이동`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm text-blue-600 hover:text-blue-800">
                      {new Date(date).toLocaleDateString('ko-KR', { 
                        month: 'short', 
                        day: 'numeric',
                        weekday: 'short'
                      })}
                    </h3>
                        {hasData ? (
                          <Badge variant={progress === 100 ? 'default' : progress > 50 ? 'secondary' : 'destructive'} className="text-xs">
                            {Math.round(progress)}%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            데이터 없음
                          </Badge>
                        )}
                      </div>
                      
                      {hasData ? (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                progress === 100 ? 'bg-green-500' : 
                                progress > 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {classified}/{total} 완료
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">
                          수집된 데이터 없음
                        </div>
                      )}
                      
                      <div className="text-xs text-blue-500 font-medium text-center mt-2">
                        클릭하여 분류하기
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 자동수집 행 */}
            <div>
              <h3 className="text-sm font-medium text-white mb-2">자동수집</h3>
              <div className="grid grid-cols-7 gap-3">
                {availableDates.slice(0, 7).map(date => {
                  // 자동수집 데이터 (실제 자동수집된 데이터)
                  const autoStats = autoCollectedStats[date] || { total: 0, classified: 0, progress: 0 };
                  const total = autoStats.total; // 실제 자동수집 데이터
                  const classified = autoStats.classified; // 실제 자동수집 분류 데이터
                  const progress = autoStats.progress; // 실제 자동수집 진행률
                  const hasData = total > 0;
                  
                  return (
                    <div 
                      key={`auto-${date}`}
                      className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-green-50 hover:border-green-300 transition-all duration-200 active:scale-95"
                      onClick={() => handleDateClick(date, 'auto')}
                      title={`${date} 자동수집 데이터 - 클릭하여 상세 페이지로 이동`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm text-green-600 hover:text-green-800">
                          {new Date(date).toLocaleDateString('ko-KR', { 
                            month: 'short', 
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </h3>
                      {hasData ? (
                        <Badge variant={progress === 100 ? 'default' : progress > 50 ? 'secondary' : 'destructive'} className="text-xs">
                          {Math.round(progress)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          데이터 없음
                        </Badge>
                      )}
                    </div>
                      
                      {hasData ? (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                progress === 100 ? 'bg-green-500' : 
                                progress > 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
          </div>
                          <div className="text-xs text-muted-foreground">
                            {classified}/{total} 완료
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400">
                          수집된 데이터 없음
                        </div>
                      )}
                      
                      <div className="text-xs text-green-500 font-medium text-center mt-2">
                        클릭하여 분류하기
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 합계 행 */}
            <div>
              <h3 className="text-sm font-medium text-white mb-2">합계</h3>
              <div className="grid grid-cols-7 gap-3">
                {availableDates.slice(0, 7).map(date => {
                  // 합계 데이터 (수동수집 + 자동수집)
                  const manualStats = dateStats[date] || { total: 0, classified: 0, progress: 0 };
                  const autoStats = autoCollectedStats[date] || { total: 0, classified: 0, progress: 0 };
                  
                  const total = manualStats.total + autoStats.total; // 수동 + 자동
                  const classified = manualStats.classified + autoStats.classified; // 수동 + 자동
                  const progress = total > 0 ? Math.round((classified / total) * 100) : 0; // 합계 진행률
                  const hasData = total > 0;
                  
                  return (
                    <div 
                      key={`total-${date}`}
                      className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 active:scale-95"
                      onClick={() => handleDateClick(date, 'total')}
                      title={`${date} 합계 데이터 (수동+자동) - 클릭하여 상세 페이지로 이동`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm text-purple-600 hover:text-purple-800">
                          {new Date(date).toLocaleDateString('ko-KR', { 
                            month: 'short', 
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </h3>
                        {hasData ? (
                          <Badge variant={progress === 100 ? 'default' : progress > 50 ? 'secondary' : 'destructive'} className="text-xs">
                            {Math.round(progress)}%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            데이터 없음
                          </Badge>
                        )}
                      </div>
                      
                  {hasData ? (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : 
                            progress > 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                        </div>
                      <div className="text-xs text-muted-foreground">
                        {classified}/{total} 완료
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">
                      수집된 데이터 없음
                    </div>
                  )}
                  
                      <div className="text-xs text-purple-500 font-medium text-center mt-2">
                    클릭하여 분류하기
                  </div>
                    </div>
              );
            })}
              </div>
            </div>
                    </div>
                  </Card>


        {/* 14일 데이터 관리 */}
        <Card className="p-6 mt-6">
          <div className="flex items-center space-x-2 mb-4">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-foreground">14일 데이터 관리</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 데이터 보관 설정 */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">데이터 보관 설정</h3>
              <div className="space-y-3">
              <div>
                  <Label htmlFor="retention">보관 기간 (일)</Label>
                  <Select value={dataManagementConfig.retentionDays.toString()} onValueChange={(value) => handleRetentionChange(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3일</SelectItem>
                      <SelectItem value="7">7일</SelectItem>
                      <SelectItem value="14">14일</SelectItem>
                      <SelectItem value="30">30일</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
                             <div className="flex items-center space-x-2">
                 <input
                   type="checkbox"
                    id="autoCleanup"
                   checked={dataManagementConfig.autoCleanup}
                    onChange={handleAutoCleanupToggle}
                   className="rounded"
                 />
                  <Label htmlFor="autoCleanup">자동 정리 활성화</Label>
               </div>
               </div>
            </div>

            {/* 현재 데이터 정보 */}
             <div className="space-y-4">
               <h3 className="font-medium text-foreground">현재 데이터 정보</h3>
              <div className="space-y-2 text-sm">
                       <div className="flex justify-between">
                  <span className="text-muted-foreground">전체 영상:</span>
                  <span className="font-medium">{totalVideos.toLocaleString()}개</span>
                       </div>
                       <div className="flex justify-between">
                  <span className="text-muted-foreground">분류 완료:</span>
                  <span className="font-medium text-green-600">{classifiedVideos.toLocaleString()}개</span>
                       </div>
                       <div className="flex justify-between">
                  <span className="text-muted-foreground">미분류:</span>
                  <span className="font-medium text-red-600">{unclassifiedVideos.toLocaleString()}개</span>
                       </div>
                       <div className="flex justify-between">
                  <span className="text-muted-foreground">진행률:</span>
                  <span className="font-medium text-primary">{Math.round(classificationProgress)}%</span>
                       </div>
                     </div>
             </div>

                         {/* 데이터 관리 액션 */}
             <div className="space-y-4">
              <h3 className="font-medium text-foreground">데이터 관리 액션</h3>
               <div className="space-y-2">
                 <Button 
                   variant="outline" 
                   onClick={handleCleanupOldData}
                   className="w-full"
                 >
                   <Trash2 className="w-4 h-4 mr-2" />
                   오래된 데이터 정리
                 </Button>
                 <Button 
                   variant="secondary" 
                   onClick={handleAutoCleanup}
                   className="w-full"
                   disabled={!dataManagementConfig.autoCleanup}
                 >
                   <RefreshCw className="w-4 h-4 mr-2" />
                   자동 정리 실행
                 </Button>
                 <div className="text-xs text-muted-foreground space-y-1">
                   <p>{dataManagementConfig.autoCleanup && "• 자동 정리가 활성화되어 있습니다"}</p>
                   <p>• {dataManagementConfig.retentionDays}일 이전 데이터는 자동으로 정리됩니다</p>
                 </div>
               </div>
              </div>
          </div>
        </Card>


        {/* 모달들 제거 - 하드코딩 방식에서는 불필요 */}

              </div>

    </div>
  );
};

export default DataClassification;