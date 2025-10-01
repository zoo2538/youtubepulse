import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
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
  Users,
  Trash2,
  Download,
  Upload,
  Play,
  Pause,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Archive,
  FileDown,
  SaveAll
  } from "lucide-react";
import { postgresqlService } from "@/lib/postgresql-service";
import { redisService } from "@/lib/redis-service";
import { hybridService } from "@/lib/hybrid-service";
import { categories, subCategories } from "@/lib/subcategories";
import { useAuth } from "@/contexts/AuthContext";

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
  category: string;
  subCategory: string;
  status: 'unclassified' | 'classified' | 'pending';
  updatedAt?: string;
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
  // 하드코딩된 세부카테고리 사용 (수정 불가)
  const dynamicSubCategories = subCategories;
  const isAdmin = userRole === 'admin'; // 관리자 권한 확인

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // 카테고리는 하드코딩된 값 사용 (subcategories.ts에서 import)
  React.useEffect(() => {
    console.log('📊 하드코딩된 카테고리 사용:', subCategories);
  }, []);

  // IndexedDB에서 데이터 로드 (전체 데이터 - 통계용)
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // 1. 하이브리드 서비스에서 전체 unclassifiedData 로드 (통계용)
        const savedData = await hybridService.loadUnclassifiedData();
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
              collectionDate: baseItem.collectionDate || today
            };
          });
          console.log('✅ IndexedDB에서 로드:', savedData.length, '개');
          setUnclassifiedData(sanitized);
          
          // 날짜별 통계 계산 (초기 로드 시)
          const initialDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
          sanitized.forEach(item => {
            const date = item.collectionDate || item.uploadDate;
            if (date) {
              if (!initialDateStats[date]) {
                initialDateStats[date] = { total: 0, classified: 0, progress: 0 };
              }
              initialDateStats[date].total++;
              if (item.status === 'classified') {
                initialDateStats[date].classified++;
              }
            }
          });
          
          // 진행률 계산
          Object.keys(initialDateStats).forEach(date => {
            const stats = initialDateStats[date];
            stats.progress = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;
          });
          
          setDateStats(initialDateStats);
          console.log('📊 초기 로드 시 dateStats 설정:', initialDateStats);
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
            const date = item.collectionDate || item.uploadDate;
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
            
            // 사용 가능한 날짜 목록도 새로고침
            const availableDatesFromDB = await hybridService.getAvailableDates();
            const { getKoreanDateStringWithOffset } = await import('@/lib/utils');
            const dates = new Set<string>();
            
            // 1. IndexedDB에서 실제 데이터가 있는 날짜들 조회
            availableDatesFromDB.forEach(date => dates.add(date));
            
            // 2. 오늘 기준 최근 7일 날짜들 추가 (데이터가 없어도 표시) - 한국 시간 기준
            for (let i = 0; i < 7; i++) {
              const date = getKoreanDateStringWithOffset(-i); // i일 전
              dates.add(date);
            }
            
            // 3. 날짜 정렬 (최신순)
            const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
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
        
        // 1. 하이브리드 서비스에서 실제 데이터가 있는 날짜들 조회
        const availableDatesFromDB = await hybridService.getAvailableDates();
        availableDatesFromDB.forEach(date => dates.add(date));
        
        // 2. 오늘 기준 최근 7일 날짜들 추가 (데이터가 없어도 표시) - 한국 시간 기준
        for (let i = 0; i < 7; i++) {
          const date = getKoreanDateStringWithOffset(-i); // i일 전
          dates.add(date);
        }
        
        // 3. 날짜 정렬 (최신순)
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
      const itemDate = item.collectionDate || item.uploadDate;
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
          const date = item.collectionDate || item.uploadDate;
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      );

      // 7일간 모든 날짜에 대해 분류된 데이터 생성 (없는 날은 빈 배열)
      const allClassifiedData = [];
      sevenDays.forEach(date => {
        const dateClassifiedData = classifiedData.filter(item => {
          const itemDate = item.collectionDate || item.uploadDate;
          return itemDate === date;
        });
        allClassifiedData.push(...dateClassifiedData);
      });

      // 분류된 데이터를 하이브리드 저장 (대시보드용)
      await hybridService.saveClassifiedData(allClassifiedData);
      
      // 진행률 데이터 생성 (14일간 모든 날짜)
      const progressData = sevenDays.map(date => {
        const dateData = unclassifiedData.filter(item => {
          const itemDate = item.collectionDate || item.uploadDate;
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
        const itemDate = item.collectionDate || item.uploadDate;
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
            const itemDate = item.collectionDate || item.uploadDate;
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

  // 중복 제거 기능
  const handleRemoveDuplicates = async () => {
    if (!confirm('⚠️ 중복된 데이터를 제거하시겠습니까?\n\n같은 videoId + collectionDate 조합에서:\n- 분류된 것 우선 유지\n- 조회수 높은 것 유지\n- 나머지 자동 삭제')) {
      return;
    }

    try {
      setIsLoading(true);
      
      // 전체 데이터 로드
      const allData = await hybridService.loadUnclassifiedData();
      
      // videoId + collectionDate 조합으로 그룹화
      const videoDateMap = new Map<string, UnclassifiedData>();
      let duplicateCount = 0;
      
      allData.forEach((item: UnclassifiedData) => {
        const key = `${item.videoId}_${item.collectionDate}`;
        
        if (!videoDateMap.has(key)) {
          // 첫 번째 발견
          videoDateMap.set(key, item);
        } else {
          // 중복 발견
          const existing = videoDateMap.get(key)!;
          let shouldReplace = false;
          
          // 우선순위 판단
          if (item.status === 'classified' && existing.status !== 'classified') {
            // 분류된 것 우선
            shouldReplace = true;
          } else if (item.status === existing.status) {
            // 같은 상태라면 조회수 비교
            if (item.viewCount > existing.viewCount) {
              shouldReplace = true;
            }
          }
          
          if (shouldReplace) {
            videoDateMap.set(key, item);
          }
          
          duplicateCount++;
        }
      });
      
      const uniqueData = Array.from(videoDateMap.values());
      
      // 저장 (전체 교체 방식 - 중복 방지)
      const { indexedDBService } = await import('@/lib/indexeddb-service');
      await indexedDBService.replaceAllUnclassifiedData(uniqueData);
      console.log('✅ 중복 제거 후 전체 데이터 교체 완료');
      
      setUnclassifiedData(uniqueData);
      
      // 날짜별 통계 재계산
      const newDateStats: { [date: string]: { total: number; classified: number; progress: number } } = {};
      uniqueData.forEach(item => {
        const date = item.collectionDate || item.uploadDate;
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
      
      alert(`✅ 중복 제거 완료!\n\n` +
            `🗑️ 제거된 중복: ${duplicateCount}개\n` +
            `✅ 남은 데이터: ${uniqueData.length}개\n\n` +
            `페이지를 새로고침합니다.`);
      
      window.location.reload();
    } catch (error) {
      console.error('중복 제거 실패:', error);
      alert('❌ 중복 제거에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 백업 복원
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
          const text = event.target?.result as string;
          let restoredData;

          // JSON 파싱 시도
          try {
            restoredData = JSON.parse(text);
          } catch (parseError) {
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
                // 원본 날짜를 그대로 유지하여 하이브리드 저장
                await hybridService.saveUnclassifiedData(allData);
                setUnclassifiedData(allData);
                
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
                  const date = item.collectionDate || item.uploadDate;
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
                  const date = item.collectionDate || item.uploadDate;
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
          console.error('백업 복원 실패:', error);
          alert('❌ 백업 복원에 실패했습니다.');
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
          const itemDate = item.collectionDate || item.uploadDate;
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
          const itemDate = item.collectionDate || item.uploadDate;
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
        const itemDate = item.collectionDate || item.uploadDate;
        return itemDate >= startDate && itemDate <= endDate;
      });

      if (rangeData.length === 0) {
        alert('선택한 기간에 데이터가 없습니다.');
        return;
      }

      // 날짜별로 그룹화
      const groupedData = rangeData.reduce((acc, item) => {
        const date = item.collectionDate || item.uploadDate;
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
    const itemDate = item.collectionDate || item.uploadDate;
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
                onClick={handleRemoveDuplicates}
                className="flex items-center space-x-1 border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>중복 제거</span>
              </Button>
              
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
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {availableDates.slice(0, 7).map(date => {
              // 날짜별 통계에서 직접 가져오기 (실시간 업데이트)
              const stats = dateStats[date] || { total: 0, classified: 0, progress: 0 };
              const total = stats.total;
              const classified = stats.classified;
              const progress = stats.progress;
              const hasData = total > 0;
              
              return (
                <div 
                  key={date} 
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
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadBackup(date);
                        }}
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                        title={`${date} 날짜 백업 다운로드`}
                        disabled={!hasData}
                      >
                        <FileDown className={`w-3 h-3 ${hasData ? 'text-blue-600' : 'text-gray-400'}`} />
                      </Button>
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
                  
                  {/* 클릭 안내 텍스트 */}
                  <div className="text-xs text-blue-500 font-medium text-center mt-2">
                    클릭하여 분류하기
                  </div>
                    </div>
              );
            })}
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

        {/* 모달들 제거 - 하드코딩 방식에서는 불필요 */}

              </div>

    </div>
  );
};

export default DataClassification;