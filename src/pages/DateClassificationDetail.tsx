import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  Save,
  Search,
  CheckCircle,
  XCircle,
  LogOut,
  Users,
  Settings,
  Eye,
  Edit,
  X,
  Download,
  Upload,
  Trash2
} from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { hybridDBService } from "@/lib/hybrid-db-service";
import { API_BASE_URL } from "@/lib/config";
import { apiService } from "@/lib/api-service";
import { dedupeByDate, dedupeByVideoDay, type VideoItem } from "@/lib/dedupe-utils";
import { subCategories } from "@/lib/subcategories";
import { getKoreanDateString, getKoreanDateTimeString } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface UnclassifiedData {
  id: number;
  channelId: string;
  channelName: string;
  description: string;
  videoId: string;
  videoTitle: string;
  videoDescription: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  category: string;
  subCategory: string;
  status: 'unclassified' | 'classified' | 'pending';
  collectionDate: string;
  uploadDate: string;
}

const DateClassificationDetail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout, userEmail, userRole } = useAuth();
  const isAdmin = userRole === 'admin'; // 관리자 권한 확인
  
  const selectedDate = searchParams.get('date') || (() => {
    const now = new Date();
    return now.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
  })();
  const collectionType = searchParams.get('type') as 'manual' | 'auto' | 'total' | null;
  const [unclassifiedData, setUnclassifiedData] = useState<UnclassifiedData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unclassified' | 'classified' | 'priority'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectedRow, setSelectedRow] = useState<number | null>(null); // 클릭한 행 추적
  // 하드코딩된 세부카테고리 사용
  const dynamicSubCategories = subCategories;
  const [showBulkActions, setShowBulkActions] = useState<boolean>(false);
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkSubCategory, setBulkSubCategory] = useState<string>('');
  
  // 성능 최적화: 카테고리 옵션 메모이제이션
  const categoryOptions = useMemo(() => 
    Object.keys(dynamicSubCategories), 
    [dynamicSubCategories]
  );
  
  const subCategoryOptions = useMemo(() => 
    bulkCategory ? (dynamicSubCategories[bulkCategory] || []) : [],
    [bulkCategory, dynamicSubCategories]
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // 관리자 권한 확인 - 관리자가 아니면 대시보드로 리다이렉트
  React.useEffect(() => {
    if (!isAdmin && userRole) {
      console.log('❌ 관리자 권한 없음 - 대시보드로 리다이렉트');
      alert('⚠️ 관리자만 접근 가능한 페이지입니다.');
      navigate('/dashboard');
    }
  }, [isAdmin, userRole, navigate]);

  // 카테고리 데이터 로드
  // 하드코딩된 카테고리 사용 (동적 로딩 제거)
  React.useEffect(() => {
    console.log('📊 하드코딩된 카테고리 사용:', subCategories);
  }, []);

  // 데이터 로드
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('📅 날짜별 데이터 로드 시작:', selectedDate);
        
        // 1. 서버 우선 하이브리드 로드 (서버 권위성 보장)
        let allData = [];
        let dataSource = '';
        
        try {
          // 자동수집 데이터인 경우 별도 API 사용
          if (collectionType === 'auto') {
            console.log('📊 자동수집 데이터 - 전용 API 사용...');
            const response = await fetch(`${API_BASE_URL}/api/auto-collected`);
            if (response.ok) {
              const serverData = await response.json();
              if (serverData.success && serverData.data && serverData.data.length > 0) {
                // 선택된 날짜의 자동수집 데이터만 필터링
                allData = serverData.data.filter(item => {
                  const itemDate = item.collectionDate || item.dayKeyLocal || item.uploadDate;
                  const dateStr = itemDate ? itemDate.split('T')[0] : '';
                  return dateStr === selectedDate;
                });
                dataSource = 'server-auto';
                console.log(`✅ 서버에서 자동수집 데이터 로드 (${selectedDate}):`, allData.length, '개');
              }
            }
          } else if (collectionType === 'manual') {
            // 수동수집 데이터 - classified API 사용 (collection_type='manual' 필터링)
            console.log('📊 수동수집 데이터 - classified API 사용...');
            const response = await fetch(`${API_BASE_URL}/api/classified?date=${selectedDate}`);
            if (response.ok) {
              const serverData = await response.json();
              if (serverData.success && serverData.data && serverData.data.length > 0) {
                allData = serverData.data;
                dataSource = 'server-manual';
                console.log('✅ 서버에서 수동수집 데이터 로드:', allData.length, '개');
              }
            }
          } else if (collectionType === 'total') {
            // 전체 데이터 - unclassified_data 테이블에서 날짜별로 조회
            console.log('📊 전체 데이터 - unclassified_data 테이블 사용...');
            const response = await fetch(`${API_BASE_URL}/api/unclassified-by-date?date=${selectedDate}`);
            if (response.ok) {
              const serverData = await response.json();
              if (serverData.success && serverData.data && serverData.data.length > 0) {
                allData = serverData.data;
                dataSource = 'server-total';
                console.log('✅ 서버에서 전체 데이터 로드 (수동+자동):', allData.length, '개');
              }
            }
          }
        } catch (serverError) {
          console.log('⚠️ 서버 로드 실패:', serverError);
        }
        
        // 서버에 데이터가 없으면 IndexedDB에서 시도 (백업 복원 데이터 포함)
        if (allData.length === 0) {
          try {
            console.log('📊 서버에 데이터 없음, IndexedDB에서 시도...');
            const indexedDBData = await indexedDBService.loadUnclassifiedData();
            
            // IndexedDB 데이터도 수집 타입별로 필터링
            if (collectionType === 'auto') {
              allData = indexedDBData.filter(item => item.collectionType === 'auto');
              console.log(`✅ IndexedDB에서 자동수집 데이터만 로드: ${allData.length}개 (전체: ${indexedDBData.length}개)`);
            } else if (collectionType === 'manual') {
              allData = indexedDBData.filter(item => !item.collectionType || item.collectionType === 'manual');
              console.log(`✅ IndexedDB에서 수동수집 데이터만 로드: ${allData.length}개 (전체: ${indexedDBData.length}개)`);
            } else {
              allData = indexedDBData;
              console.log('✅ IndexedDB에서 전체 데이터 로드:', allData.length, '개');
            }
            
            dataSource = 'indexeddb';
          } catch (dbError) {
            console.error('❌ IndexedDB 로드 실패:', dbError);
            allData = [];
            dataSource = 'none';
          }
        }
        
        console.log(`📊 데이터 소스: ${dataSource}, 로드된 데이터: ${allData.length}개`);
        
        // 선택된 날짜의 데이터만 필터링 (다양한 날짜 필드 확인)
        const filteredData = allData.filter(item => {
          // 1. dayKeyLocal 우선 확인 (백업 복원 데이터) - 대시 문제 해결
          if (item.dayKeyLocal) {
            const normalizedDayKey = item.dayKeyLocal.replace(/-$/, ''); // 끝의 대시 제거
            if (normalizedDayKey === selectedDate) {
              return true;
            }
          }
          
          // 2. collectionDate 확인 (ISO 형식 지원)
          if (item.collectionDate) {
            const collectionDateStr = item.collectionDate.split('T')[0]; // ISO 형식에서 날짜만 추출
            if (collectionDateStr === selectedDate) {
              return true;
            }
          }
          
          // 3. uploadDate 확인 (ISO 형식 지원)
          if (item.uploadDate) {
            const uploadDateStr = item.uploadDate.split('T')[0]; // ISO 형식에서 날짜만 추출
            if (uploadDateStr === selectedDate) {
              return true;
            }
          }
          
          // 4. publishedAt 확인 (YYYY-MM-DD 형식)
          if (item.publishedAt && item.publishedAt.startsWith(selectedDate)) {
            return true;
          }
          
          // 5. ID 타임스탬프 확인 (실제 수집 시간)
          if (item.id && typeof item.id === 'string') {
            const timestamp = parseInt(item.id.split('_')[0]);
            if (!isNaN(timestamp)) {
              const actualDate = new Date(timestamp).toISOString().split('T')[0];
              if (actualDate === selectedDate) {
                console.log('✅ ID 타임스탬프 매치:', actualDate);
                return true;
              }
            }
          }
          
          return false;
        });

        // 수집 타입별 필터링 추가 (모든 데이터 소스에 대해 일관되게 적용)
        let typeFilteredData = filteredData;
        if (collectionType) {
          if (collectionType === 'manual') {
            // 수동수집 데이터만 (collectionType이 없거나 'manual')
            typeFilteredData = filteredData.filter(item => !item.collectionType || item.collectionType === 'manual');
          } else if (collectionType === 'auto') {
            // 자동수집 데이터만 (collectionType === 'auto')
            typeFilteredData = filteredData.filter(item => item.collectionType === 'auto');
          }
          // 'total'인 경우 모든 데이터 (필터링 없음)
          
          // 자동수집 필터링 시 collectionType 분포 확인
          if (collectionType === 'auto') {
            const autoCount = typeFilteredData.filter(item => item.collectionType === 'auto').length;
            const undefinedCount = typeFilteredData.filter(item => item.collectionType === undefined).length;
            const manualCount = typeFilteredData.filter(item => item.collectionType === 'manual').length;
            console.log('📊 자동수집 필터링 결과 분석:', {
              auto: autoCount,
              undefined: undefinedCount,
              manual: manualCount,
              total: typeFilteredData.length
            });
          }
        }

        // 중복 제거 로직 개선 (같은 날짜의 같은 영상 중 조회수 높은 것만 유지)
        console.log('📊 필터링된 데이터 개수:', typeFilteredData.length);
        
        // 조회수 기준으로 정렬 (높은 것부터)
        const sortedData = typeFilteredData.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        
        // 같은 날짜의 같은 영상 중복 제거 (조회수 높은 것 우선)
        const videoMap = new Map<string, any>();
        sortedData.forEach(item => {
          const videoKey = `${selectedDate}_${item.videoId}`;
          if (!videoMap.has(videoKey)) {
            videoMap.set(videoKey, item);
          }
        });
        
        const dateData = Array.from(videoMap.values());
        console.log(`📊 ${selectedDate} 중복 제거 완료: ${dateData.length}개 (제거: ${typeFilteredData.length - dateData.length}개)`);
        
        const finalData = dateData.map(item => ({
          ...item,
          channelName: item.channelName || 'N/A',
          videoTitle: item.videoTitle || 'N/A',
          description: item.description || 'N/A',
          videoDescription: item.videoDescription || 'N/A',
          viewCount: item.viewCount || 0,
          category: item.category || '',
          subCategory: item.subCategory || '',
          status: item.status || 'unclassified'
        }));
        
        console.log(`📊 ${selectedDate} 날짜 데이터: ${finalData.length}개`);
        
        setUnclassifiedData(finalData);
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        setUnclassifiedData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedDate]);

  // 필터링된 데이터 계산
  let filteredData = unclassifiedData.filter(item => {
    const matchesSearch = (item.channelName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.videoTitle || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = false;
    if (filterStatus === 'all') {
      matchesStatus = true;
    } else if (filterStatus === 'priority') {
      // 우선 분류 대상: 같은 채널에 여러 영상이 있는 항목들
      const channelGroups: { [key: string]: UnclassifiedData[] } = {};
      unclassifiedData.forEach(dataItem => {
        if (!channelGroups[dataItem.channelName]) {
          channelGroups[dataItem.channelName] = [];
        }
        channelGroups[dataItem.channelName].push(dataItem);
      });
      const channelItems = channelGroups[item.channelName] || [];
      matchesStatus = channelItems.length > 1 && (item.status === 'unclassified' || item.status === 'pending');
    } else if (filterStatus === 'unclassified') {
      // 미분류 필터: 다양한 미분류 상태를 인식
      matchesStatus = item.status === 'unclassified' || 
                     item.status === 'pending' || 
                     !item.category || 
                     item.category === '' || 
                     item.category === '기타' || 
                     (item.category === '기타' && item.subCategory === '기타(미분류)') ||
                     (item.category === '기타' && (!item.subCategory || item.subCategory === '')) ||
                     (item.category === '기타(해외)' && (!item.subCategory || item.subCategory === '')) ||
                     (item.category === '기타(국내)' && (!item.subCategory || item.subCategory === '')) ||
                     // 추가: 빈 서브카테고리도 미분류로 처리
                     (!item.subCategory || item.subCategory === '') ||
                     // 추가: '기타' 관련 카테고리들도 미분류로 처리
                     item.category === '기타(해외)' ||
                     item.category === '기타(국내)' ||
                     // 추가: 분류되지 않은 상태들
                     item.status === 'unclassified' ||
                     item.status === 'pending';
    } else {
      matchesStatus = item.status === filterStatus;
    }
    
    return matchesSearch && matchesStatus;
  });

  // 우선분류대상, 분류완료, 또는 미분류일 때 채널별로 그룹화하여 정렬
  if (filterStatus === 'priority' || filterStatus === 'classified' || filterStatus === 'unclassified') {
    // 채널별 그룹화
    const channelGroups: { [key: string]: UnclassifiedData[] } = {};
    filteredData.forEach(item => {
      if (!channelGroups[item.channelName]) {
        channelGroups[item.channelName] = [];
      }
      channelGroups[item.channelName].push(item);
    });

    // 채널별로 정렬 (영상 수가 많은 순서대로)
    const sortedChannels = Object.keys(channelGroups).sort((a, b) => {
      return channelGroups[b].length - channelGroups[a].length;
    });

    // 그룹화된 데이터를 다시 배열로 변환
    filteredData = sortedChannels.flatMap(channelName => channelGroups[channelName]);
  }

  // 페이지네이션
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // 개별 항목 업데이트 (최적화: useCallback)
  const updateItem = useCallback((id: number, updates: Partial<UnclassifiedData>) => {
    setUnclassifiedData(prev => 
      prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    );
  }, []);

  // 체크박스 핸들러
  const handleCheckboxChange = (id: number, checked: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  // 선택된 항목이 변경될 때는 자동으로 분류 UI를 표시하지 않음
  // React.useEffect(() => {
  //   setShowBulkActions(selectedItems.size > 0);
  // }, [selectedItems]);

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(currentData.map(item => item.id));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  };


  // 데이터 저장
  const saveData = async () => {
    try {
      console.log('💾 데이터 저장 시작 - 동적 세부카테고리 사용:', dynamicSubCategories);
      
      // 하이브리드 저장 (IndexedDB + 서버)
      // 기타(미분류)는 분류 완료가 아니므로 pending 상태도 제외
      const classifiedData = unclassifiedData.filter(item => 
        item.status === 'classified' && 
        !(item.category === '기타' && item.subCategory === '기타(미분류)')
      );
      
      // 디버깅용 로그
      const etcUnclassifiedCount = unclassifiedData.filter(item => 
        item.category === '기타' && item.subCategory === '기타(미분류)'
      ).length;
      console.log(`📊 기타(미분류) 영상 수: ${etcUnclassifiedCount}개 (분류 완료에서 제외됨)`);
      console.log(`📊 실제 분류 완료 영상 수: ${classifiedData.length}개`);
      
      // 1. IndexedDB 날짜별 업데이트 (다른 날짜 데이터 보존) ✅
      console.log('💾 IndexedDB 날짜별 업데이트 - 미분류 데이터');
      await indexedDBService.updateUnclassifiedDataByDate(unclassifiedData, selectedDate);
      
      console.log('💾 IndexedDB 날짜별 업데이트 - 분류 데이터');
      await indexedDBService.updateClassifiedDataByDate(classifiedData, selectedDate);
      
      // 2. 서버에 날짜별 업데이트 (현재 날짜 데이터만 전송) ✅
      console.log('💾 서버 날짜별 업데이트 시작...');
      
      // 2-1. IndexedDB에는 날짜별 선택적 교체 저장 (로컬 캐시)
      console.log(`💾 IndexedDB 날짜별 선택적 교체 저장: ${selectedDate}`);
      
      // 해당 날짜의 데이터만 필터링 (전체 데이터가 아닌 해당 날짜만)
      const dateSpecificData = unclassifiedData.filter(item => 
        item.dayKeyLocal === selectedDate || 
        item.collectionDate === selectedDate ||
        item.uploadDate === selectedDate
      );
      
      console.log(`📊 해당 날짜(${selectedDate}) 데이터 필터링: ${unclassifiedData.length}개 → ${dateSpecificData.length}개`);
      
      // 해당 날짜 데이터만 저장
      await hybridDBService.replaceDataByDate(selectedDate, dateSpecificData);
      console.log(`✅ IndexedDB ${selectedDate} 날짜 데이터 교체 완료: ${dateSpecificData.length}개`);
      
      // 2-2. 서버에는 현재 날짜 데이터를 교체 방식으로 전송 (DELETE + INSERT, 배치 처리)
      console.log(`💾 서버 저장 - 현재 날짜(${selectedDate}) 데이터 교체`);
      if (dateSpecificData.length > 0) {
        try {
          const BATCH_SIZE = 500;
          const totalBatches = Math.ceil(dateSpecificData.length / BATCH_SIZE);
          
          // 먼저 해당 날짜 데이터 삭제
          console.log(`🗑️ ${selectedDate} 기존 데이터 삭제 중...`);
          const deleteResponse = await fetch(`${API_BASE_URL}/api/replace-date-range`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dates: [selectedDate],
              data: [] // 빈 배열로 전송하여 삭제만 수행
            })
          });
          
          if (!deleteResponse.ok) {
            throw new Error(`기존 데이터 삭제 실패: ${deleteResponse.status}`);
          }
          console.log(`✅ ${selectedDate} 기존 데이터 삭제 완료`);
          
          // 배치로 나누어 저장
          if (unclassifiedData.length <= BATCH_SIZE) {
            console.log(`📤 미분류 데이터 전송: ${unclassifiedData.length}개`);
            await apiService.saveUnclassifiedData(unclassifiedData);
            console.log(`✅ 서버 미분류 데이터 저장 완료`);
          } else {
            console.log(`📦 미분류 데이터 배치 업로드 시작: ${unclassifiedData.length}개 → ${totalBatches}개 배치 (500개씩)`);
            
            for (let i = 0; i < unclassifiedData.length; i += BATCH_SIZE) {
              const batch = unclassifiedData.slice(i, i + BATCH_SIZE);
              const batchNum = Math.floor(i / BATCH_SIZE) + 1;
              
              console.log(`📦 미분류 배치 ${batchNum}/${totalBatches} 전송 중... (${batch.length}개)`);
              
              try {
                await apiService.saveUnclassifiedData(batch);
                console.log(`✅ 미분류 배치 ${batchNum}/${totalBatches} 전송 완료`);
              } catch (batchError) {
                console.error(`❌ 미분류 배치 ${batchNum} 전송 실패:`, batchError);
                throw batchError;
              }
              
              // 배치 간 500ms 지연
              if (i + BATCH_SIZE < unclassifiedData.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            
            console.log(`✅ 서버 미분류 데이터 배치 저장 완료 (${totalBatches}개 배치)`);
          }
        } catch (error) {
          console.error(`❌ 서버 저장 실패:`, error);
          alert(`⚠️ 서버 저장에 실패했지만 로컬에는 저장되었습니다.\n\n에러: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }
      
      // 2-3. 분류 데이터도 날짜별 선택적 교체로 처리
      if (classifiedData.length > 0) {
        console.log(`💾 분류 데이터 날짜별 선택적 교체 저장: ${selectedDate}`);
        
        // 해당 날짜의 분류 데이터만 교체 저장
        await hybridDBService.replaceDataByDate(selectedDate, classifiedData);
        console.log(`✅ IndexedDB ${selectedDate} 날짜 분류 데이터 교체 완료: ${classifiedData.length}개`);
        
        // 서버에는 현재 날짜 분류 데이터만 전송
        console.log(`💾 서버 저장 - 현재 날짜(${selectedDate}) 분류 데이터만 전송`);
        try {
          const BATCH_SIZE = 500;
          const totalBatches = Math.ceil(classifiedData.length / BATCH_SIZE);
          
          if (classifiedData.length <= BATCH_SIZE) {
            console.log(`📤 현재 날짜 분류 데이터 전송: ${classifiedData.length}개`);
            await apiService.saveClassifiedData(classifiedData);
            console.log(`✅ 서버 분류 데이터 저장 완료`);
          } else {
            console.log(`📦 분류 데이터 배치 업로드 시작: ${classifiedData.length}개 → ${totalBatches}개 배치 (500개씩)`);
            
            for (let i = 0; i < classifiedData.length; i += BATCH_SIZE) {
              const batch = classifiedData.slice(i, i + BATCH_SIZE);
              const batchNum = Math.floor(i / BATCH_SIZE) + 1;
              
              console.log(`📦 분류 배치 ${batchNum}/${totalBatches} 전송 중... (${batch.length}개)`);
              
              try {
                await apiService.saveClassifiedData(batch);
                console.log(`✅ 분류 배치 ${batchNum}/${totalBatches} 전송 완료`);
              } catch (batchError) {
                console.error(`❌ 분류 배치 ${batchNum} 전송 실패:`, batchError);
                throw batchError;
              }
              
              // 배치 간 500ms 지연
              if (i + BATCH_SIZE < classifiedData.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            
            console.log(`✅ 서버 분류 데이터 배치 저장 완료 (${totalBatches}개 배치)`);
          }
        } catch (error) {
          console.error(`❌ 서버 분류 데이터 저장 실패:`, error);
          alert(`⚠️ 서버 분류 데이터 저장에 실패했지만 로컬에는 저장되었습니다.\n\n에러: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
      }
      
      // 일별 요약 데이터 생성 및 저장 (대시보드용)
      const dailySummary = {
        date: selectedDate,
        categories: {} as Record<string, any>
      };
      
      // 모든 카테고리를 0으로 초기화
      const defaultCategories = Object.keys(dynamicSubCategories);
      const dataCategories = [...new Set(classifiedData.map(item => item.category).filter(Boolean))];
      const allCategories = [...new Set([...defaultCategories, ...dataCategories])];
      
      allCategories.forEach(category => {
        dailySummary.categories[category] = {
          totalViews: 0,
          count: 0,
          channelCount: 0,
          channels: new Set()
        };
      });
      
      // 카테고리별 통계 계산
      classifiedData.forEach(item => {
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
      
      // 일별 요약 데이터 저장
      await indexedDBService.saveDailySummary(selectedDate, dailySummary);
      
      // 일별 진행률 데이터 저장 (데이터 분류 관리 페이지용)
      const dailyProgress = {
        date: selectedDate,
        total: unclassifiedData.length,
        classified: classifiedData.length,
        progress: unclassifiedData.length > 0 ? Math.round((classifiedData.length / unclassifiedData.length) * 100) : 0
      };
      await indexedDBService.saveDailyProgress(dailyProgress);
      
      // 데이터 업데이트 이벤트 발생 (다른 페이지 동기화용)
      const eventDetail = {
        type: 'dataSaved',
        date: selectedDate,
        dataCount: unclassifiedData.length,
        classifiedCount: classifiedData.length,
        timestamp: getKoreanDateTimeString()
      };
      
      // 여러 이벤트로 다른 페이지들에 알림 (백업 데이터 보존)
      window.dispatchEvent(new CustomEvent('dataUpdated', { 
        detail: { 
          ...eventDetail, 
          preserveBackupData: true // 백업 데이터 보존 플래그
        } 
      }));
      window.dispatchEvent(new CustomEvent('dashboardDateChanged', { detail: { date: selectedDate } }));
      window.dispatchEvent(new CustomEvent('categoriesUpdated'));
      
      // 국내 대시보드와 연결된 상세 페이지들 동기화
      window.dispatchEvent(new CustomEvent('categoryDataUpdated', { 
        detail: { 
          date: selectedDate, 
          classifiedData: classifiedData,
          dailySummary: dailySummary
        } 
      }));
      window.dispatchEvent(new CustomEvent('channelDataUpdated', { 
        detail: { 
          date: selectedDate, 
          classifiedData: classifiedData
        } 
      }));
      window.dispatchEvent(new CustomEvent('trendingVideosUpdated', { 
        detail: { 
          date: selectedDate, 
          classifiedData: classifiedData
        } 
      }));
      
      console.log('📡 모든 동기화 이벤트 발생:', eventDetail);
      
      
      alert('✅ 데이터 저장 완료! 국내 대시보드, 상세 페이지들, 데이터 분류 관리 페이지에 반영되었습니다.');
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      alert('❌ 데이터 저장에 실패했습니다.');
    }
  };


  // 일별 데이터 내보내기 (하이브리드 호환 형식 - DataClassification과 동일)
  const handleExportByDate = () => {
    try {
      const total = unclassifiedData.length;
      const classified = unclassifiedData.filter(item => item.status === 'classified').length;
      const unclassified = total - classified;
      const progress = total > 0 ? Math.round((classified / total) * 100) : 0;
      
      // 수동수집/자동수집 구분 (collectionType이 없으면 수동수집으로 분류)
      const manualData = unclassifiedData.filter(item => !item.collectionType || item.collectionType === 'manual');
      const autoData = unclassifiedData.filter(item => item.collectionType === 'auto' || item.collectionType === undefined);
      
      console.log('📊 수집 타입 분류:', {
        total: unclassifiedData.length,
        manual: manualData.length,
        auto: autoData.length,
        undefined: unclassifiedData.filter(item => !item.collectionType).length
      });
      
      // 하이브리드 백업 형식으로 구성 (DataClassification과 동일)
      const backupData = {
        // 메타데이터 (한국 시간)
        exportDate: getKoreanDateTimeString(),
        version: '2.0', // 하이브리드 버전
        backupType: 'hybrid',
        
        // 통계 정보
        summary: {
          totalVideos: total,
          classifiedVideos: classified,
          unclassifiedVideos: unclassified,
          manualCollected: manualData.length,
          autoCollected: autoData.length
        },
        
        // 일별 데이터 (하이브리드 구조)
        dailyData: [{
          date: selectedDate,
          total,
          classified,
          unclassified: total - classified,
          progress,
          manualCollected: manualData.length,
          manualClassified: manualData.filter(item => item.status === 'classified').length,
          autoCollected: autoData.length,
          autoClassified: autoData.filter(item => item.status === 'classified').length,
          data: unclassifiedData // 해당 날짜의 모든 데이터
        }],
        
        // 전체 데이터 (하이브리드 구조)
        allData: unclassifiedData,
        
        // 하이브리드 설정 정보
        hybridConfig: {
          useApiServer: true,
          fallbackToLocal: true,
          syncEnabled: true
        }
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `youtubepulse_hybrid_${selectedDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`📤 ${selectedDate} 하이브리드 백업 내보내기 완료:`, backupData);
      alert(`✅ ${selectedDate} 하이브리드 백업이 성공적으로 내보내졌습니다!\n\n📊 총 ${total}개 영상 (분류완료: ${classified}개, 미분류: ${unclassified}개)\n🔧 수동수집: ${manualData.length}개, 자동수집: ${autoData.length}개`);
    } catch (error) {
      console.error('❌ 데이터 내보내기 실패:', error);
      alert('❌ 데이터 내보내기에 실패했습니다.');
    }
  };

  // 일별 백업 복원하기
  const handleRestoreBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const backupData = JSON.parse(text);
        
        console.log('📁 백업 파일 로드:', backupData);
        
        // 백업 데이터 검증 (하이브리드 형식 지원)
        console.log('🔍 백업 데이터 구조 확인:', {
          hasAllData: !!backupData.allData,
          allDataIsArray: Array.isArray(backupData.allData),
          hasData: !!backupData.data,
          dataIsArray: Array.isArray(backupData.data),
          backupKeys: Object.keys(backupData)
        });
        
        if (!backupData.allData || !Array.isArray(backupData.allData)) {
          // 기존 형식도 지원
        if (!backupData.data || !Array.isArray(backupData.data)) {
          throw new Error('유효하지 않은 백업 파일입니다. data 또는 allData 배열이 필요합니다.');
          }
        }
        
        // 현재 날짜와 백업 날짜가 일치하는지 확인 (한국 시간 기준)
        const now = new Date();
        const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
        const todayStr = koreaTime.toISOString().split('T')[0];
        
        if (backupData.selectedDate !== selectedDate) {
          const confirmRestore = confirm(
            `백업 파일의 날짜(${backupData.selectedDate})와 현재 선택된 날짜(${selectedDate})가 다릅니다.\n그래도 복원하시겠습니까?`
          );
          if (!confirmRestore) return;
        }
        
        // 데이터 복원 (하이브리드 형식 지원)
        const restoreData = backupData.allData || backupData.data;
        setUnclassifiedData(restoreData);
        
        // IndexedDB에 저장 (해당 날짜의 데이터만 업데이트)
        await indexedDBService.updateUnclassifiedDataByDate(restoreData, selectedDate);
        
        // 카테고리 정보도 복원 (있는 경우)
        if (backupData.categories) {
          await indexedDBService.saveCategories(backupData.categories);
          // setDynamicSubCategories는 하드코딩된 카테고리를 사용하므로 제거
          window.dispatchEvent(new CustomEvent('categoriesUpdated'));
        }
        
        // 분류 완료된 데이터를 IndexedDB에 저장 (대시보드용)
        const classifiedData = restoreData.filter(item => item.status === 'classified');
        await indexedDBService.updateClassifiedDataByDate(classifiedData, selectedDate);
        
        // 일별 요약 데이터 계산 및 저장
        const dailySummary = {
          totalItems: restoreData.length,
          classifiedItems: classifiedData.length,
          unclassifiedItems: restoreData.length - classifiedData.length,
          categories: {} as any
        };
        
        // 카테고리별 통계 계산
        classifiedData.forEach(item => {
          if (item.category && item.subCategory) {
            if (!dailySummary.categories[item.category]) {
              dailySummary.categories[item.category] = {
                totalViews: 0,
                count: 0,
                channels: new Set(),
                subCategories: {}
              };
            }
            if (!dailySummary.categories[item.category].subCategories[item.subCategory]) {
              dailySummary.categories[item.category].subCategories[item.subCategory] = {
                totalViews: 0,
                count: 0
              };
            }
            
            dailySummary.categories[item.category].totalViews += item.viewCount || 0;
            dailySummary.categories[item.category].count += 1;
            dailySummary.categories[item.category].channels.add(item.channelName);
            dailySummary.categories[item.category].subCategories[item.subCategory].totalViews += item.viewCount || 0;
            dailySummary.categories[item.category].subCategories[item.subCategory].count += 1;
          }
        });
        
        // Set을 배열로 변환
        Object.keys(dailySummary.categories).forEach(category => {
          dailySummary.categories[category].channels = Array.from(dailySummary.categories[category].channels);
          dailySummary.categories[category].channelCount = dailySummary.categories[category].channels.length;
        });
        
        // 일별 요약 데이터 저장
        await indexedDBService.saveDailySummary(selectedDate, dailySummary);
        
        // 일별 진행률 데이터 저장 (데이터 분류 관리 페이지용)
        const dailyProgress = {
          date: selectedDate,
          total: restoreData.length,
          classified: classifiedData.length,
          progress: restoreData.length > 0 ? Math.round((classifiedData.length / restoreData.length) * 100) : 0
        };
        await indexedDBService.saveDailyProgress(dailyProgress);
        
        // 서버 동기화 (API 서버가 연결된 경우)
        try {
          const response = await fetch(`${API_BASE_URL}/api/backup/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              data: restoreData,
              date: selectedDate 
            })
          });
          
          if (response.ok) {
            console.log('✅ 서버 동기화 완료');
          } else {
            const errorText = await response.text();
            console.log('⚠️ 서버 동기화 실패, 로컬에서만 복원됨:', response.status, errorText);
          }
        } catch (serverError) {
          console.log('⚠️ 서버 연결 실패, 로컬에서만 복원됨:', serverError);
        }
        
        // 데이터 업데이트 이벤트 발생 (백업 데이터 보존)
        window.dispatchEvent(new CustomEvent('dataUpdated', { 
          detail: { 
            type: 'backupRestored', 
            date: selectedDate, 
            dataCount: restoreData.length,
            preserveBackupData: true // 백업 데이터 보존 플래그
          } 
        }));
        
        console.log(`🔄 ${selectedDate} 날짜 데이터 복원 완료:`, backupData);
        alert(`✅ ${selectedDate} 날짜 데이터가 성공적으로 복원되었습니다!\n복원된 데이터: ${restoreData.length}개`);
        
      } catch (error) {
        console.error('❌ 백업 복원 실패:', error);
        console.error('❌ 에러 상세:', {
          message: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack : undefined,
          error: error
        });
        alert(`❌ 백업 복원에 실패했습니다.\n\n에러: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n파일을 확인해주세요.`);
      }
    };
    reader.readAsText(file);
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
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
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">YT</span>
                </div>
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
              <Button variant="outline" onClick={() => navigate('/data')}>
                📊 데이터
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
            <Button 
              variant="outline" 
              onClick={() => navigate('/data-classification')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              뒤로가기
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              데이터 분류 상세
              {collectionType && (
                <span className="ml-2 text-lg">
                  {collectionType === 'manual' && '📝 수동수집'}
                  {collectionType === 'auto' && '🤖 자동수집'}
                  {collectionType === 'total' && '📊 합계'}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-2">
              {new Date(selectedDate).toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
              })} 수집 데이터
              {collectionType && (
                <span className="ml-2 text-sm">
                  ({collectionType === 'manual' && '수동수집 데이터만'}
                   {collectionType === 'auto' && '자동수집 데이터만'}
                   {collectionType === 'total' && '수동+자동 전체 데이터'})
                </span>
              )}
            </p>
          </div>
          
          {/* 일별 내보내기 및 백업 버튼 */}
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={handleExportByDate}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>일별 내보내기</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRestoreBackup}
              className="flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>일별 백업 복원하기</span>
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">전체 데이터</p>
                <p className="text-2xl font-bold text-foreground">{unclassifiedData.length}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">📊</span>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">미분류</p>
                <p className="text-2xl font-bold text-orange-600">
                  {unclassifiedData.filter(item => item.status === 'unclassified').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-orange-600" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">분류 완료</p>
                <p className="text-2xl font-bold text-green-600">
                  {unclassifiedData.filter(item => item.status === 'classified').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">진행률</p>
                <p className="text-2xl font-bold text-primary">
                  {unclassifiedData.length > 0 
                    ? Math.round((unclassifiedData.filter(item => item.status === 'classified').length / unclassifiedData.length) * 100)
                    : 0}%
                </p>
              </div>
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-sm">
                  {unclassifiedData.length > 0 
                    ? Math.round((unclassifiedData.filter(item => item.status === 'classified').length / unclassifiedData.length) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* 필터 및 액션 버튼 */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="채널명 또는 영상 제목으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('all')}
                  className={filterStatus === 'all' ? 'bg-gray-600 text-white hover:bg-gray-700' : ''}
                >
                  전체 보기 ({unclassifiedData.length})
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'priority' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('priority')}
                  className={filterStatus === 'priority' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                  title="같은 채널에 여러 영상이 있는 항목들을 그룹화하여 우선 표시"
                >
                  우선 분류 대상
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'unclassified' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('unclassified')}
                  className={filterStatus === 'unclassified' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'hover:bg-orange-100'}
                  title="미분류된 항목들을 같은 채널끼리 그룹화하여 표시"
                >
                  미분류만 보기 ({unclassifiedData.filter(item => item.status === 'unclassified').length})
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'classified' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('classified')}
                  className={filterStatus === 'classified' ? 'bg-green-600 text-white hover:bg-green-700' : ''}
                  title="분류 완료된 항목들을 같은 채널끼리 그룹화하여 표시"
                >
                  분류 완료만 보기 ({unclassifiedData.filter(item => item.status === 'classified').length})
                </Button>
              </div>
              
              <div className="relative flex items-center space-x-4">
                <Button
                  onClick={() => {
                    if (selectedItems.size === 0) {
                      alert('분류할 항목을 선택해주세요.');
                      return;
                    }
                    setShowBulkActions(!showBulkActions);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  분류
                </Button>
                <Button
                  onClick={async () => {
                    if (selectedItems.size === 0) {
                      alert('삭제할 항목을 선택해주세요.');
                      return;
                    }
                    const confirmMessage = `선택된 ${selectedItems.size}개 항목을 삭제하시겠습니까?`;
                    if (confirm(confirmMessage)) {
                      try {
                        // 1. 로컬 상태 업데이트
                        const updatedData = unclassifiedData.filter(item => !selectedItems.has(item.id));
                        setUnclassifiedData(updatedData);
                        
                        // 2. IndexedDB에서 삭제
                        const selectedIds = Array.from(selectedItems);
                        await indexedDBService.deleteUnclassifiedDataByIds(selectedIds);
                        
                        // 3. 서버 동기화 (API 서버가 연결된 경우)
                        try {
                          const response = await fetch('/api/sync/delete-unclassified', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                              ids: selectedIds,
                              date: selectedDate 
                            })
                          });
                          
                          if (response.ok) {
                            console.log('✅ 서버 동기화 완료');
                          } else {
                            console.log('⚠️ 서버 동기화 실패, 로컬에서만 삭제됨');
                          }
                        } catch (serverError) {
                          console.log('⚠️ 서버 연결 실패, 로컬에서만 삭제됨');
                        }
                        
                        // 4. UI 상태 초기화
                      setSelectedItems(new Set());
                      setShowBulkActions(false);
                        
                      console.log(`✅ 대량 삭제 완료: ${selectedItems.size}개 항목 삭제`);
                      alert(`✅ ${selectedItems.size}개 항목이 성공적으로 삭제되었습니다!`);
                        
                      } catch (error) {
                        console.error('❌ 삭제 실패:', error);
                        alert('❌ 삭제 중 오류가 발생했습니다.');
                      }
                    }
                  }}
                  variant="destructive"
                >
                  삭제
                </Button>
                <Button onClick={saveData} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </Button>
              </div>
              
              {/* 분류 팝업 모달 */}
              {showBulkActions && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                    <div className="space-y-4">
                      {/* 제목 */}
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-800">대량 분류</h3>
                        <p className="text-sm text-gray-600">선택된 {selectedItems.size}개 항목을 분류합니다</p>
                      </div>
                      
                      {/* 카테고리 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                        <select
                          value={bulkCategory}
                          onChange={(e) => {
                            setBulkCategory(e.target.value);
                            setBulkSubCategory('');
                          }}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-black"
                        >
                          <option value="">카테고리를 선택하세요</option>
                          {categoryOptions.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* 세부카테고리 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">세부카테고리</label>
                        <select
                          value={bulkSubCategory}
                          onChange={(e) => setBulkSubCategory(e.target.value)}
                          disabled={!bulkCategory}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-black disabled:bg-gray-100"
                        >
                          <option value="">세부카테고리를 선택하세요</option>
                          {subCategoryOptions.map(subCategory => (
                            <option key={subCategory} value={subCategory}>{subCategory}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* 선택된 분류 정보 표시 */}
                      {bulkCategory && bulkSubCategory && (
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <span className="font-medium">분류 정보:</span> {bulkCategory} → {bulkSubCategory}
                          </p>
                        </div>
                      )}
                      
                      {/* 취소와 확인 버튼 */}
                      <div className="flex justify-center space-x-4">
                        <Button
                          onClick={() => {
                            setShowBulkActions(false);
                            setBulkCategory('');
                            setBulkSubCategory('');
                          }}
                          variant="outline"
                          className="bg-white text-black border-gray-300 px-6"
                        >
                          취소
                        </Button>
                        <Button
                          onClick={() => {
                            if (!bulkCategory) {
                              alert('카테고리를 선택해주세요.');
                              return;
                            }
                            if (!bulkSubCategory) {
                              alert('세부카테고리를 선택해주세요.');
                              return;
                            }
                            
                            const confirmMessage = `선택된 ${selectedItems.size}개 항목을 "${bulkCategory} > ${bulkSubCategory}"로 분류하시겠습니까?`;
                            if (confirm(confirmMessage)) {
                              // 데이터 업데이트 (동기적 실행 - 하이브리드 동기화 안정성 보장)
                              setUnclassifiedData(prev => 
                                prev.map(item => 
                                  selectedItems.has(item.id) 
                                    ? { 
                                        ...item, 
                                        category: bulkCategory, 
                                        subCategory: bulkSubCategory, 
                                        status: bulkSubCategory === '기타(미분류)' ? 'pending' : 'classified' 
                                      }
                                    : item
                                )
                              );

                              // 선택 해제 및 상태 초기화
                              setSelectedItems(new Set());
                              setShowBulkActions(false);
                              setBulkCategory('');
                              setBulkSubCategory('');

                              console.log(`✅ 대량 분류 완료: ${selectedItems.size}개 항목을 "${bulkCategory} > ${bulkSubCategory}"로 분류`);
                              alert(`✅ ${selectedItems.size}개 항목이 성공적으로 분류되었습니다!`);
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-6"
                        >
                          확인
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </Card>


        {/* 데이터 테이블 */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-foreground w-12">
                    <input
                      type="checkbox"
                      checked={currentData.length > 0 && selectedItems.size === currentData.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">상태</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">채널 정보</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">영상 정보</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">조회수</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">카테고리</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">세부카테고리</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`border-b cursor-pointer transition-colors ${
                      selectedRow === item.id || selectedItems.has(item.id)
                        ? 'bg-blue-600/40 hover:bg-blue-500/50' 
                        : 'hover:bg-gray-700/30'
                    }`}
                    onClick={() => setSelectedRow(item.id)}
                  >
                    <TableCell className="align-top py-3 w-12" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => handleCheckboxChange(item.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </TableCell>
                    <TableCell className="align-top py-3">
                      <Badge 
                        variant={
                          item.status === 'classified' ? 'default' : 
                          item.status === 'pending' ? 'secondary' : 'destructive'
                        }
                        className={`text-sm ${
                          item.status === 'classified' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
                        }`}
                      >
                        {item.status === 'classified' ? '완료' :
                         item.status === 'pending' ? '대기' : '미분류'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="align-top py-3">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground flex items-center space-x-2">
                          <a 
                            href={`https://www.youtube.com/channel/${item.channelId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            title="채널 페이지로 이동"
                          >
                            {item.channelName || 'N/A'}
                          </a>
                          {(filterStatus === 'priority' || filterStatus === 'classified' || filterStatus === 'unclassified') && (() => {
                            const channelCount = filteredData.filter(d => d.channelName === item.channelName).length;
                            return channelCount > 1 ? (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                filterStatus === 'priority' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : filterStatus === 'classified'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {channelCount}개 영상
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="text-sm text-muted-foreground max-w-xs truncate">
                          {item.description || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="align-top py-3">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground max-w-xs truncate">
                          <a 
                            href={`https://www.youtube.com/watch?v=${item.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            title="영상 페이지로 이동"
                          >
                            {item.videoTitle || 'N/A'}
                          </a>
                        </div>
                        <div className="text-sm text-muted-foreground max-w-xs truncate">
                          {item.videoDescription || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="align-top py-3">
                      <div className="text-sm font-medium text-foreground">
                        {(item.viewCount || 0).toLocaleString()}
                      </div>
                    </TableCell>
                    
                    <TableCell className="align-top py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={item.category || ''}
                        onValueChange={(value) => updateItem(item.id, { 
                          category: value, 
                          subCategory: '', 
                          status: 'pending' 
                        })}
                      >
                        <SelectTrigger className="w-32 bg-white text-black border-gray-300">
                          <SelectValue placeholder="카테고리" />
                        </SelectTrigger>
                        <SelectContent className="bg-white text-black">
                          {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category} className="bg-white text-black hover:bg-gray-100">
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell className="align-top py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={item.subCategory || ''}
                        onValueChange={(value) => {
                          // 기타(미분류)에서 다른 서브카테고리로 변경 시 classified로 변경
                          const newStatus = (item.subCategory === '기타(미분류)' && value !== '기타(미분류)') 
                            ? 'classified' 
                            : (value === '기타(미분류)' ? 'pending' : 'classified');
                          
                          updateItem(item.id, { 
                            subCategory: value, 
                            status: newStatus 
                          });
                        }}
                        disabled={!item.category}
                      >
                        <SelectTrigger className="w-32 bg-white text-black border-gray-300">
                          <SelectValue placeholder="세부카테고리" />
                        </SelectTrigger>
                        <SelectContent className="bg-white text-black">
                          {item.category && dynamicSubCategories[item.category]?.map((subCategory) => (
                            <SelectItem key={subCategory} value={subCategory} className="bg-white text-black hover:bg-gray-100">
                              {subCategory}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, filteredData.length)} / {filteredData.length}개
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="처음 페이지로"
                >
                  처음
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <span className="text-sm text-foreground px-3">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="끝 페이지로"
                >
                  끝
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// TableCell 컴포넌트 추가
const TableCell = ({ className, children, ...props }: any) => (
  <td className={className} {...props}>
    {children}
  </td>
);

export default DateClassificationDetail;

