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
import { compressLocalIndexedDB, compressByDate, type CompressionResult } from "@/lib/local-compression";
import { hybridSyncService } from "@/lib/hybrid-sync-service";
import { indexedDBService } from "@/lib/indexeddb-service";

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
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          // 가장 최신 자동수집 데이터 사용
          const latestCollection = result.data[0];
          const autoCollectedData = latestCollection.data;
          
          // 자동수집 데이터 통계 계산
          const autoStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
          autoCollectedData.forEach((item: any) => {
            const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
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
          console.log('🤖 자동수집 데이터 없음');
          setAutoCollectedStats({});
        }
      } else {
        console.log('🤖 자동수집 API 호출 실패');
        setAutoCollectedStats({});
      }
    } catch (error) {
      console.error('🤖 자동수집 데이터 로드 실패:', error);
      setAutoCollectedStats({});
    }
  };

  // 하이브리드 데이터 로드 (서버 + 로컬 병합)
  React.useEffect(() => {
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
        
        // 3. 기존 방식으로도 데이터 로드 (하위 호환성)
        const savedData = await hybridService.loadUnclassifiedData();
        if (savedData && savedData.length > 0) {
          const { getKoreanDateString } = await import('@/lib/utils');
          const today = getKoreanDateString();
          const sanitized: UnclassifiedData[] = savedData.map((it: UnclassifiedData) => {
            const baseItem = it.category === '해외채널'
              ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
              : it;
            
            return {
              ...baseItem,
              collectionDate: baseItem.collectionDate || today
            };
          });
          
          // 4. 중복 제거 적용
          console.log('🔄 중복 제거 전:', sanitized.length, '개 항목');
          const dedupedData = dedupeComprehensive(sanitized as VideoItem[]);
          console.log('✅ 중복 제거 후:', dedupedData.length, '개 항목');
          console.log('📊 제거된 중복:', sanitized.length - dedupedData.length, '개');
          
          setUnclassifiedData(dedupedData as UnclassifiedData[]);
          console.log('✅ IndexedDB에서 로드:', savedData.length, '개');
        } else {
          // 2. IndexedDB에 데이터가 없으면 localStorage에서 마이그레이션 시도
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
                uploadDate: video.uploadDate || new Date().toISOString().split('T')[0],
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
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        // 오류 발생 시 빈 배열로 설정
        setUnclassifiedData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const [dataManagementConfig, setDataManagementConfig] = useState<DataManagementConfig>({
    retentionDays: 14,
    autoCleanup: true
  });

  // 일별 관리 기능 추가 - URL 파라미터에서 날짜 읽기
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam) return dateParam;
    
    // 기본값은 오늘 날짜로 설정하고, useEffect에서 한국 시간으로 업데이트
    return new Date().toISOString().split('T')[0];
  });
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateStats, setDateStats] = useState<{ [date: string]: { total: number; classified: number; progress: number } }>({});
  // 카테고리 관리 관련 상태 제거 - 하드코딩 방식 사용

  // 한국어/영어 판별 함수
  const isKoreanText = (text: string): boolean => {
    const koreanRegex = /[가-힣]/;
    return koreanRegex.test(text);
  };

  // 데이터 업데이트 이벤트 감지
  React.useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      console.log('🔄 데이터 업데이트 이벤트 감지:', event.detail);
      
      // 데이터 다시 로드 (페이지 새로고침 대신 데이터만 새로고침)
      const loadData = async () => {
        try {
          setIsLoading(true);
          console.log('🔄 데이터 분류 관리 페이지 - 데이터 새로고침 시작');
          
          // 1. 하이브리드 서비스에서 전체 unclassifiedData 로드 (통계용) - 강제 새로고침
          console.log('🔄 하이브리드 서비스에서 최신 데이터 강제 로드 중...');
          const savedData = await hybridService.loadUnclassifiedData();
          console.log(`📊 로드된 데이터 개수: ${savedData?.length || 0}개`);
          
          // 2. 사용 가능한 날짜 목록 새로고침
          const dates = await hybridService.getAvailableDates();
          console.log('🔄 사용 가능한 날짜 새로고침:', dates);
          setAvailableDates(dates);
          
          // 3. 날짜별 통계 계산
          const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
          savedData?.forEach(item => {
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
          console.log('📊 날짜별 통계 업데이트:', newDateStats);
          
          if (savedData && savedData.length > 0) {
            const { getKoreanDateString } = await import('@/lib/utils');
            const today = getKoreanDateString(); // 한국 시간 기준 오늘 날짜
            // 해외채널 카테고리 제거/정리 및 collectionDate 추가
            const sanitized: UnclassifiedData[] = savedData.map((it: UnclassifiedData) => {
              const baseItem = it.category === '해외채널'
                ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
                : it;
              
              // collectionDate가 없는 경우 오늘 날짜로 설정
              return {
                ...baseItem,
                collectionDate: baseItem.collectionDate || baseItem.uploadDate || today
              };
            });
            
            setUnclassifiedData(sanitized);
            console.log(`✅ 데이터 분류 관리 페이지 - ${sanitized.length}개 데이터 업데이트 완료`);
            
            // 사용 가능한 날짜 목록도 새로고침 - 정확히 7일만 생성
            const { getKoreanDateStringWithOffset } = await import('@/lib/utils');
            const dates = [];
            
            // 오늘 기준 최근 7일 날짜들만 생성 (중복 없이)
            for (let i = 0; i < 7; i++) {
              const date = getKoreanDateStringWithOffset(-i); // i일 전
              dates.push(date);
            }
            
            // 날짜 정렬 (최신순)
            const sortedDates = dates.sort((a, b) => b.localeCompare(a));
            setAvailableDates(sortedDates);
            console.log(`📅 사용 가능한 날짜 목록 업데이트: ${sortedDates.length}개`);
            
          } else {
            console.log('📊 실제 데이터가 없습니다. 데이터 수집을 먼저 진행해주세요.');
            setUnclassifiedData([]);
          }
        } catch (error) {
          console.error('데이터 로드 실패:', error);
          setUnclassifiedData([]);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadData();
    };

    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    // 페이지 포커스 시 데이터 새로고침
    const handlePageFocus = () => {
      // 복원 중이면 동기화 차단
      if (window.restoreLock || sessionStorage.getItem('restoreInProgress')) {
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
        const { getKoreanDateString, getKoreanDateStringWithOffset } = await import('@/lib/utils');
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
        const { getKoreanDateStringWithOffset } = await import('@/lib/utils');
        const dates = [];
        for (let i = 0; i < 7; i++) {
          dates.push(getKoreanDateStringWithOffset(-i));
        }
        setAvailableDates(dates);
      }
    };
    
    loadDates();
  }, [unclassifiedData]);

  // 분류된 데이터 추출
  const classifiedData = unclassifiedData.filter(item => item.status === 'classified');

  // 일별 분류 진행률 계산 함수
  const calculateDailyProgress = (unclassifiedData: UnclassifiedData[], classifiedData: UnclassifiedData[]): DailyProgressData[] => {
    const progressMap = new Map<string, DailyProgressData>();
    
    // 모든 데이터를 합쳐서 날짜별로 그룹화
    const allData = [...unclassifiedData, ...classifiedData];
    
    allData.forEach(item => {
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
      const isClassified = item.status === 'classified';
      const collectionType = item.collectionType || 'auto'; // 기본값은 auto
      
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
  const handleDateClick = (date: string) => {
    console.log('📅 날짜 클릭됨:', date);
    console.log('🔗 이동할 URL:', `/date-classification-detail?date=${date}`);
    navigate(`/date-classification-detail?date=${date}`);
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

  // 하이브리드 동기화 핸들러
  const handleHybridSync = async () => {
    try {
      console.log('🔄 하이브리드 동기화 시작...');
      setIsLoading(true);
      
      // 1. 동기화 상태 확인
      const syncStatus = hybridSyncService.getSyncStatus();
      console.log('📊 동기화 상태:', syncStatus);
      
      // 2. 서버와 로컬 데이터 병합 (최대값 보존)
      const mergeResult = await loadAndMergeDays('overwrite');
      console.log('📊 병합 결과:', mergeResult);
      
      // 2-1. IndexedDB에 최대값 보존 upsert 적용
      if (mergeResult.mergedDays && mergeResult.mergedDays.length > 0) {
        const allData = await hybridService.loadUnclassifiedData();
        if (allData && allData.length > 0) {
          await indexedDBService.upsertUnclassifiedDataWithMaxValues(allData);
          console.log('✅ IndexedDB 최대값 보존 upsert 완료');
        }
      }
      
      // 3. 하이브리드 동기화 실행
      const syncResult = await hybridSyncService.performFullSync();
      console.log('✅ 동기화 결과:', syncResult);
      
      // 4. 데이터 새로고침
      const loadData = async () => {
        try {
          const savedData = await hybridService.loadUnclassifiedData();
          if (savedData && savedData.length > 0) {
            const { getKoreanDateString } = await import('@/lib/utils');
            const today = getKoreanDateString();
            
            const sanitized: UnclassifiedData[] = savedData.map((it: UnclassifiedData) => {
              const baseItem = it.category === '해외채널'
                ? { ...it, category: '', subCategory: '', status: 'unclassified' as const }
                : it;
              
              return {
                ...baseItem,
                collectionDate: baseItem.collectionDate || baseItem.uploadDate || today
              };
            });
            
            setUnclassifiedData(sanitized);
            
            // 날짜별 통계 업데이트
            const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
            sanitized.forEach(item => {
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
          }
        } catch (error) {
          console.error('❌ 데이터 새로고침 실패:', error);
        }
      };
      
      await loadData();
      
      // 5. 결과 표시
      alert(`🔄 하이브리드 동기화 완료!\n업로드: ${syncResult.uploaded}개\n다운로드: ${syncResult.downloaded}개\n충돌 해결: ${syncResult.conflicts}개`);
      
    } catch (error) {
      console.error('❌ 하이브리드 동기화 실패:', error);
      alert('❌ 동기화 실패: ' + error.message);
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
      const { startDataCollection } = await import('@/lib/youtube-api-service');
      
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

  // 일별 분류 진행률 일괄 저장
  const handleBulkSaveProgress = async () => {
    try {
      // 분류된 데이터만 추출
      const classifiedData = unclassifiedData.filter(item => item.status === 'classified');
      
      // 7일간 모든 날짜 생성 (한국 시간 기준)
      const { getKoreanDateString } = await import('@/lib/utils');
      const today = getKoreanDateString();
      const sevenDays = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        sevenDays.push(date.toISOString().split('T')[0]);
      }
      
      console.log('📊 일괄저장 - 7일간 날짜들:', sevenDays);
      console.log('📊 일괄저장 - 전체 데이터:', unclassifiedData.length);
      console.log('📊 일괄저장 - 분류된 데이터:', classifiedData.length);
      console.log('📊 일괄저장 - 분류된 데이터 날짜 분포:', 
        classifiedData.reduce((acc, item) => {
          const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      // 7일간 모든 날짜에 대해 분류된 데이터 생성 (없는 날은 빈 배열)
      const allClassifiedData = [];
      sevenDays.forEach(date => {
        const dateClassifiedData = classifiedData.filter(item => {
          const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
          return itemDate === date;
        });
        allClassifiedData.push(...dateClassifiedData);
      });

      // 분류된 데이터를 하이브리드 저장 (대시보드용)
      await hybridService.saveClassifiedData(allClassifiedData);
      
      // 진행률 데이터 생성 (14일간 모든 날짜)
      const progressData = sevenDays.map(date => {
        const dateData = unclassifiedData.filter(item => {
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
      await hybridService.saveDailyProgress(progressData);
      
      // 데이터 업데이트 이벤트 발생 (대시보드 새로고침)
      window.dispatchEvent(new CustomEvent('dataUpdated'));
      
      // 강제 새로고침을 위한 localStorage 플래그 설정
      localStorage.setItem('forceRefresh', JSON.stringify({
        timestamp: Date.now(),
        type: 'bulkSave',
        dataCount: allClassifiedData.length
      }));
      
      alert(`✅ 14일간의 분류 진행률과 ${allClassifiedData.length}개의 분류된 데이터가 저장되었습니다.\n\n대시보드가 자동으로 업데이트됩니다.`);
    } catch (error) {
      console.error('진행률 저장 실패:', error);
      alert('❌ 진행률 저장에 실패했습니다.');
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

  // 전체 백업 다운로드
  const handleDownloadAllBackup = async () => {
    try {
      const allBackupData = {
        exportDate: new Date().toISOString(),
        totalVideos: unclassifiedData.length,
        classifiedVideos: unclassifiedData.filter(item => item.status === 'classified').length,
        unclassifiedVideos: unclassifiedData.filter(item => item.status === 'unclassified').length,
        dailyProgress: availableDates.slice(0, 7).map(date => {
      const dateData = unclassifiedData.filter(item => {
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
            progress: Math.round(progress)
          };
        }),
        allData: unclassifiedData,
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(allBackupData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtubepulse_full_backup_${new Date().toISOString().split('T')[0]}.json`;
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
        const { getKoreanDateString } = await import('@/lib/utils');
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
      const { indexedDBService } = await import('@/lib/indexeddb-service');
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
        const { getKoreanDateString } = await import('@/lib/utils');
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

  // 로컬 압축 핸들러
  const handleCompressLocal = async () => {
    try {
      setIsLoading(true);
      console.log('🗜️ 로컬 압축 시작...');
      
      const result = await compressLocalIndexedDB();
      
      const message = `✅ 로컬 압축 완료!\n\n` +
                     `📊 압축 전: ${result.before}개 항목\n` +
                     `📊 압축 후: ${result.after}개 항목\n` +
                     `🗑️ 중복 제거: ${result.duplicatesRemoved}개\n` +
                     `📈 압축률: ${result.compressionRate.toFixed(2)}%`;
      
      alert(message);
      
      // 데이터 새로고침
      await loadData();
      
    } catch (error) {
      console.error('❌ 로컬 압축 실패:', error);
      alert('❌ 로컬 압축에 실패했습니다: ' + error.message);
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
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('YouTubePulseDB', 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      
      // 트랜잭션 시작
      const transaction = db.transaction(['unclassifiedData'], 'readwrite');
      const store = transaction.objectStore('unclassifiedData');
      
      // 모든 데이터 가져오기
      const allData = await new Promise((resolve, reject) => {
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
      await loadData();
      
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
        a.download = `auto-collected-${new Date().toISOString().split('T')[0]}.json`;
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
          const { getKoreanDateString } = await import('@/lib/utils');
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
          window.restoreLock = true; // 전역 락 설정
          
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
            
            // 모든 날짜의 데이터를 하나의 배열로 합치기
            const allData = restoredData.dailyData.flatMap((dayData: any) => dayData.data || []);
            console.log(`📊 ${restoredData.dailyData.length}일간의 데이터를 합쳐서 총 ${allData.length}개 복원`);
            
            if (allData.length > 0) {
              
              const confirmed = confirm(
                `백업 파일에서 ${restoredData.dailyData.length}일간의 데이터를 복원하시겠습니까?\n\n` +
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
                
                // dailyProgress 데이터 생성 및 하이브리드 저장 (원본 날짜 기준)
                const progressData = restoredData.dailyData.map((dayData: any) => ({
                  date: dayData.date,
                  total: dayData.total,
                  classified: dayData.classified,
                  unclassified: dayData.unclassified,
                  progress: dayData.progress
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
                      `📅 ${restoredData.dailyData.length}일간의 데이터를 원본 날짜로 복원\n` +
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
          window.restoreLock = false; // 전역 락 해제
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
            const timestamp = parseInt(item.id.split('_')[0]);
            if (!isNaN(timestamp)) {
              const actualDate = new Date(timestamp).toISOString().split('T')[0];
              if (actualDate === date) return true;
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
              <h2 className="text-xl font-semibold text-foreground">일별 분류 진행률</h2>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkSaveProgress}
                className="flex items-center space-x-1"
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
                title="서버와 로컬 데이터 동기화 + 중복 제거 + 최대값 보존"
              >
                <RefreshCw className="w-4 h-4" />
                <span>하이브리드 동기화</span>
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
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompressLocal}
                className="flex items-center space-x-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                title="IndexedDB 전체 데이터 압축 및 중복 제거"
              >
                <Archive className="w-4 h-4" />
                <span>로컬 압축</span>
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
                      onClick={() => handleDateClick(date)}
                      title={`${date} 날짜 데이터 분류하기 - 클릭하여 상세 페이지로 이동`}
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
                      onClick={() => handleDateClick(date)}
                      title={`${date} 날짜 자동수집 데이터 - 클릭하여 상세 페이지로 이동`}
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
                      onClick={() => handleDateClick(date)}
                      title={`${date} 날짜 합계 데이터 - 클릭하여 상세 페이지로 이동`}
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
                   <p>• 7일 이전 데이터는 자동으로 정리됩니다</p>
                 </div>
               </div>
              </div>
          </div>
        </Card>

        {/* 일별 분류 진행률 테이블 */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              일별 분류 진행률
            </CardTitle>
            <CardDescription>
              자동수집, 수동수집, 합계별 분류 진행률을 확인하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">날짜</th>
                    <th className="text-center p-2 font-medium">자동수집</th>
                    <th className="text-center p-2 font-medium">수동수집</th>
                    <th className="text-center p-2 font-medium">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateDailyProgress(unclassifiedData, classifiedData).slice(0, 7).map((progress) => (
                    <tr key={progress.date} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium"
                          onClick={() => handleDateClick(progress.date)}
                        >
                          {progress.date}
                        </Button>
                      </td>
                      <td className="p-2 text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {progress.autoClassified}/{progress.autoCollected}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {progress.autoProgress}%
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress.autoProgress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {progress.manualClassified}/{progress.manualCollected}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {progress.manualProgress}%
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress.manualProgress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {progress.totalClassified}/{progress.totalCollected}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {progress.totalProgress}%
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${progress.totalProgress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p>• 자동수집: 시스템이 자동으로 수집한 데이터</p>
              <p>• 수동수집: 사용자가 직접 추가한 데이터</p>
              <p>• 합계: 자동수집 + 수동수집 전체 데이터</p>
            </div>
          </CardContent>
        </Card>

        {/* 모달들 제거 - 하드코딩 방식에서는 불필요 */}

              </div>

    </div>
  );
};

export default DataClassification;