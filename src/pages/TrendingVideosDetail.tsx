import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  TrendingUp, 
  ArrowLeft, 
  Filter, 
  Calendar,
  Eye,
  Play,
  LogOut,
  Users,
  Settings,
  User,
  Sparkles,
  CheckCircle2,
  Loader2,
  Key,
  Copy,
  Check
} from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories } from "@/lib/subcategories";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL } from "@/lib/config";
import { showToast } from "@/lib/toast-util";

interface VideoData {
  id: string;
  thumbnail: string;
  title: string;
  channelName: string;
  views: number;
  timeAgo: string;
  category: string;
  subCategory: string;
  uploadDate: string;
  description: string;
}

interface AiAnalysisResult {
  summary: string;
  viral_reason: string;
  keywords: string[];
  clickbait_score: number;
  sentiment: string;
  target_audience?: string;
  intro_hook?: string;
  plot_structure?: string;
  emotional_trigger?: string;
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toLocaleString();
}

function formatTimeAgo(uploadDate: string): string {
  const upload = new Date(uploadDate);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - upload.getTime()) / (1000 * 60 * 60));
  
  if (diffHours < 1) return '방금 전';
  if (diffHours < 24) return `${diffHours}시간 전`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}주 전`;
}

const DATE_RANGE_DAYS = 14;

const TrendingVideosDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, userEmail } = useAuth();
  const [videoData, setVideoData] = useState<VideoData[]>([]);
  const [filteredVideoData, setFilteredVideoData] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString()); // 기본값: 오늘
  const [availableDates, setAvailableDates] = useState<string[]>([]); // 사용 가능한 날짜 목록
  // 하드코딩된 세부카테고리 사용
  const dynamicSubCategories = subCategories;
  const isAdmin = !!userEmail; // 로그인한 모든 사용자를 관리자로 처리
  
  // AI 분석 관련 상태
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AiAnalysisResult>>({});
  const [openDialogVideoId, setOpenDialogVideoId] = useState<string | null>(null);
  const [analyzedVideoIds, setAnalyzedVideoIds] = useState<Set<string>>(new Set());
  
  // API 키 설정 관련 상태
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [openApiKeyDialog, setOpenApiKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  // 복사 상태 관리
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // 날짜 변경 이벤트 리스너
  useEffect(() => {
    const handleDateChange = (event: CustomEvent) => {
      setSelectedDate(event.detail.selectedDate);
    };

    window.addEventListener('dashboardDateChanged', handleDateChange as EventListener);
    
    return () => {
      window.removeEventListener('dashboardDateChanged', handleDateChange as EventListener);
    };
  }, []);

  // 하드코딩된 카테고리 사용 (동적 로딩 제거)
  useEffect(() => {
    console.log('📊 하드코딩된 카테고리 사용:', subCategories);
  }, []);

  // 사용 가능한 날짜 목록 생성 (최근 DATE_RANGE_DAYS일)
  useEffect(() => {
    const dates = [];
    for (let i = 0; i < DATE_RANGE_DAYS; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"}));
    }
    setAvailableDates(dates);
    console.log('📅 사용 가능한 날짜 목록:', dates);
  }, []);

  // 컴포넌트 마운트 시 API 키 로드
  useEffect(() => {
    const savedKey = localStorage.getItem('geminiApiKey');
    setGeminiApiKey(savedKey);
  }, []);

  // 데이터 로드
  const loadTrendingVideosData = useCallback(async () => {
    try {
      setLoading(true);
      
      // IndexedDB 우선 로드 (빠른 응답) - 분류된 데이터와 미분류 데이터 모두 로드
      const classifiedData = await indexedDBService.loadClassifiedData();
      const unclassifiedData = await indexedDBService.loadUnclassifiedData();
      const allData = [...classifiedData, ...unclassifiedData];
      
      console.log(`📊 조회수 급등 동영상 상세 - IndexedDB에서 분류: ${classifiedData.length}개, 미분류: ${unclassifiedData.length}개, 전체: ${allData.length}개`);
      
      // 백그라운드에서 서버 동기화 (비동기, UI 블로킹 없음)
      setTimeout(async () => {
        try {
          const [serverClassified, serverUnclassified] = await Promise.all([
            hybridService.getClassifiedData(),
            hybridService.loadUnclassifiedData()
          ]);
          const serverAllData = [...serverClassified, ...serverUnclassified];
          
          if (serverAllData.length > allData.length) {
            console.log(`🔄 백그라운드 동기화: 서버 데이터 ${serverAllData.length}개 > 로컬 ${allData.length}개`);
            // 서버에 더 많은 데이터가 있으면 업데이트
            // 비디오 데이터 재계산
            if (serverAllData && serverAllData.length > 0) {
              // 선택된 날짜 또는 오늘 날짜 기준으로 데이터 필터링
              const targetDate = selectedDate || getKoreanDateString();
              const filteredData = serverAllData
                .filter((item: any) => {
                  const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
                  const dateStr = itemDate ? itemDate.split('T')[0] : '';
                  return dateStr === targetDate && item.videoTitle;
                })
                .sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0))
                .slice(0, 100);
              
              const videos: VideoData[] = filteredData.map((item: any) => ({
                id: item.videoId || item.id,
                thumbnail: item.thumbnailUrl || `https://via.placeholder.com/320x180?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
                title: item.videoTitle || '제목 없음',
                channelName: item.channelName || '채널명 없음',
                views: item.viewCount || 0,
                timeAgo: formatTimeAgo(item.uploadDate || item.collectionDate),
                category: item.category || '미분류',
                subCategory: item.subCategory || '',
                uploadDate: item.uploadDate || item.collectionDate,
                description: item.videoDescription || item.description || ''
              }));
              
              setVideoData(videos);
              setFilteredVideoData(videos);
            }
          }
        } catch (error) {
          console.warn('⚠️ 백그라운드 동기화 실패 (무시):', error);
        }
      }, 1000); // 1초 후 백그라운드 동기화
      
      if (allData && allData.length > 0) {
        // 선택된 날짜 또는 오늘 날짜 기준으로 데이터 필터링 (한국 시간 기준)
        const targetDate = selectedDate || getKoreanDateString();
        const filteredData = allData
          .filter((item: any) => {
            const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
            const dateStr = itemDate ? itemDate.split('T')[0] : '';
            return dateStr === targetDate && item.videoTitle;
          })
          .sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0)) // 조회수 기준 내림차순
          .slice(0, 100); // 상위 100개 표시

        console.log(`📊 조회수 급등 동영상 상세 - ${targetDate} 날짜 데이터: ${filteredData.length}개`);

        // 비디오 데이터 변환
        const videos: VideoData[] = filteredData.map((item: any) => {
          const videoId = item.videoId || item.id;

          return {
            id: videoId,
            thumbnail: item.thumbnailUrl || `https://via.placeholder.com/320x180?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
            title: item.videoTitle || '제목 없음',
            channelName: item.channelName || '채널명 없음',
            views: item.viewCount || 0,
            timeAgo: formatTimeAgo(item.uploadDate || item.collectionDate),
            category: item.category || '미분류',
            subCategory: item.subCategory || '',
            uploadDate: item.uploadDate || item.collectionDate,
            description: item.videoDescription || item.description || ''
          };
        });

        console.log(`📊 조회수 급등 동영상 상세 - 생성된 비디오 데이터: ${videos.length}개`);
        setVideoData(videos);
        setFilteredVideoData(videos);
      } else {
        setVideoData([]);
        setFilteredVideoData([]);
      }
    } catch (error) {
      console.error('조회수 급등 동영상 데이터 로드 실패:', error);
      setVideoData([]);
      setFilteredVideoData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]); // 의존성 배열: selectedDate만 사용

  // 데이터 로드 및 업데이트 이벤트 리스너
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      console.log('🔄 조회수 급등 동영상 상세 데이터 업데이트 이벤트 감지:', event.detail);
      loadTrendingVideosData();
    };
    
    // 컴포넌트 마운트 시 데이터 로드
    loadTrendingVideosData();
    
    // 데이터 업데이트 이벤트 리스너 등록
    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate as EventListener);
    };
  }, [selectedDate, loadTrendingVideosData]);

  // 필터링 함수
  const applyFilters = useCallback(() => {
    let filtered = [...videoData];

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(video => video.category === selectedCategory);
    }

    // 세부카테고리 필터링
    if (selectedSubCategory !== 'all') {
      filtered = filtered.filter(video => video.subCategory === selectedSubCategory);
    }

    setFilteredVideoData(filtered);
  }, [selectedCategory, selectedSubCategory, videoData]); // 의존성 배열: 사용하는 상태들

  // 필터 변경 시 적용
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 카테고리 변경 시 세부카테고리 초기화
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubCategory('all');
  };

  // API 키 저장 함수
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }
    const trimmedKey = apiKeyInput.trim();
    localStorage.setItem('geminiApiKey', trimmedKey);
    setGeminiApiKey(trimmedKey); // 상태 업데이트
    setOpenApiKeyDialog(false);
    setApiKeyInput('');
    alert('API 키가 저장되었습니다.');
  };

  // AI 분석 함수
  const handleAnalyze = async (video: VideoData) => {
    if (analyzingVideoId === video.id) return; // 이미 분석 중이면 무시
    
    // API 키 확인
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey || apiKey.trim() === '') {
      alert('먼저 AI 키를 설정해주세요.');
      setOpenApiKeyDialog(true);
      return;
    }
    
    setAnalyzingVideoId(video.id);
    
    try {
      const apiUrl = `${API_BASE_URL}/api/analyze/video`;
      console.log('📡 API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          channelName: video.channelName,
          description: video.description,
          viewCount: video.views,
          apiKey: apiKey.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`분석 실패: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalysisResults(prev => ({
          ...prev,
          [video.id]: result.data,
        }));
        setAnalyzedVideoIds(prev => new Set([...prev, video.id]));
        setOpenDialogVideoId(video.id); // 분석 결과 모달 열기
      } else {
        throw new Error(result.error || '분석 결과를 받을 수 없습니다.');
      }
    } catch (error) {
      console.error('AI 분석 실패:', error);
      alert(`AI 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setAnalyzingVideoId(null);
    }
  };

  // AI 분석 결과 복사 함수
  const handleCopyInsight = async (videoId: string) => {
    const insight = analysisResults[videoId];
    const video = filteredVideoData.find(v => v.id === videoId);
    
    if (!insight || !video) {
      alert('복사할 분석 결과가 없습니다.');
      return;
    }

    // 리포트 텍스트 생성
    const reportText = `[AI 분석 리포트: ${video.title}]

📌 3줄 요약
- ${insight.summary}

🚀 인기/성공 요인
- ${insight.viral_reason}

${insight.intro_hook ? `🎬 도입부 훅 (Intro Hook)
- ${insight.intro_hook}

` : ''}${insight.plot_structure ? `📝 대본 구조 (Plot)
- ${insight.plot_structure}

` : ''}${insight.target_audience ? `🎯 타겟 시청층
- ${insight.target_audience}

` : ''}${insight.emotional_trigger ? `💓 감정 트리거
- ${insight.emotional_trigger}

` : ''}🏷️ 핵심 키워드
- ${insight.keywords.join(', ')}`;

    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedVideoId(videoId);
      
      // 토스트 메시지 표시
      showToast('📋 리포트가 클립보드에 복사되었습니다!', { type: 'success', duration: 2000 });
      
      // 2초 후 복사 상태 초기화
      setTimeout(() => {
        setCopiedVideoId(null);
      }, 2000);
    } catch (error) {
      console.error('복사 실패:', error);
      showToast('❌ 클립보드 복사에 실패했습니다.', { type: 'error', duration: 3000 });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">조회수 급등 동영상 데이터를 로드하는 중...</p>
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>대시보드로 돌아가기</span>
              </Button>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-red-600" />
                <h1 className="text-2xl font-bold text-foreground">조회수 급등 동영상</h1>
                <Badge className="bg-red-600 text-white">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  급상승
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {location.pathname === '/dashboard' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  국내
                </span>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  국내
                </Button>
              )}
              {location.pathname === '/trend' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  트렌드
                </span>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/trend')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  트렌드
                </Button>
              )}
              {location.pathname === '/data' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4">
                  📊 데이터
                </span>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/data')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  📊 데이터
                </Button>
              )}
              {location.pathname === '/system' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  시스템
                </span>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/system')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  시스템
                </Button>
              )}
              
              {/* User Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-white/30 text-white hover:bg-white/10"
                  >
                    <User className="w-4 h-4 mr-2" />
                    사용자
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/user-management" className="cursor-pointer">
                        <Users className="w-4 h-4 mr-2" />
                        회원관리
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/change-password" className="cursor-pointer">
                      비밀번호 변경
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* API 키 설정 경고 배너 */}
        {!geminiApiKey && (
          <Card className="p-4 mb-6 border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Gemini API 키가 설정되지 않았습니다
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    AI 분석 기능을 사용하려면 API 키를 설정해주세요.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setApiKeyInput('');
                  setOpenApiKeyDialog(true);
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
              >
                <Key className="w-4 h-4 mr-2" />
                키 설정하기
              </Button>
            </div>
          </Card>
        )}

        {/* 필터 컨트롤 */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-foreground">필터 설정</h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* AI 키 설정 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const savedKey = localStorage.getItem('geminiApiKey');
                  setApiKeyInput(savedKey || '');
                  setOpenApiKeyDialog(true);
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 border-0"
              >
                <Key className="w-4 h-4 mr-2" />
                🔑 AI 키 설정
              </Button>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium text-muted-foreground">날짜:</label>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="날짜 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(date => (
                      <SelectItem key={date} value={date}>
                        {date === getKoreanDateString() ? `오늘 (${date})` : date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">카테고리:</label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {Object.keys(dynamicSubCategories).map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">세부카테고리:</label>
                <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="세부카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {selectedCategory !== 'all' && dynamicSubCategories[selectedCategory]?.map(subCategory => (
                      <SelectItem key={subCategory} value={subCategory}>
                        {subCategory}
                      </SelectItem>
                    ))}
                    {/* 디버깅용 로그 */}
                    {selectedCategory !== 'all' && console.log(`📊 정치 카테고리 세부카테고리:`, dynamicSubCategories[selectedCategory])}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* 결과 요약 */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">조회수 급등 동영상 목록</h3>
              <p className="text-sm text-muted-foreground mt-1">
                총 {filteredVideoData.length}개 동영상 표시
                {selectedCategory !== 'all' && ` (${selectedCategory})`}
                {selectedSubCategory !== 'all' && ` - ${selectedSubCategory}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">전체 {videoData.length}개 중</p>
              <p className="text-lg font-semibold text-foreground">
                {filteredVideoData.length}개 표시
              </p>
            </div>
          </div>
        </Card>

        {/* 동영상 목록 */}
        <Card className="p-6">
          {filteredVideoData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">조회수 급등 동영상이 없습니다</p>
              <p className="text-sm mt-2">
                {videoData.length === 0 
                  ? "데이터 수집을 먼저 진행해주세요."
                  : "선택한 필터 조건에 맞는 동영상이 없습니다."
                }
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    <TableHead className="w-16 text-center">순위</TableHead>
                    <TableHead>동영상 정보</TableHead>
                    <TableHead className="text-right">조회수</TableHead>
                    <TableHead className="text-center">카테고리</TableHead>
                    <TableHead className="text-center">AI 분석</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVideoData.map((video, index) => {
                    const isAnalyzing = analyzingVideoId === video.id;
                    const isAnalyzed = analyzedVideoIds.has(video.id);
                    const hasResult = analysisResults[video.id];
                    
                    return (
                      <TableRow key={video.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-semibold">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-4">
                            <a
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative hover:opacity-80 transition-opacity"
                            >
                              <div className="relative overflow-hidden rounded w-32 h-20 bg-muted">
                                <img
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-full h-full object-cover object-center"
                                />
                              </div>
                            </a>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="font-medium text-foreground line-clamp-2">
                                {video.title}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {video.channelName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {video.timeAgo}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatViews(video.views)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {video.category}
                            </Badge>
                            {video.subCategory && (
                              <Badge variant="secondary" className="text-xs">
                                {video.subCategory}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant={isAnalyzed ? "outline" : "default"}
                            onClick={() => {
                              if (hasResult) {
                                setOpenDialogVideoId(video.id);
                              } else {
                                handleAnalyze(video);
                              }
                            }}
                            disabled={isAnalyzing || !geminiApiKey}
                            className={
                              isAnalyzed
                                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                                : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                            }
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                분석 중...
                              </>
                            ) : isAnalyzed ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                📊 분석 완료
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                ✨ AI 분석
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* AI 분석 결과 모달 */}
        {openDialogVideoId && analysisResults[openDialogVideoId] && (
          <Dialog open={!!openDialogVideoId} onOpenChange={(open) => !open && setOpenDialogVideoId(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      ✨ AI 분석 결과
                    </DialogTitle>
                    <DialogDescription>
                      {filteredVideoData.find(v => v.id === openDialogVideoId)?.title}
                    </DialogDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialogVideoId && handleCopyInsight(openDialogVideoId)}
                    className="ml-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 border-0"
                  >
                    {copiedVideoId === openDialogVideoId ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        복사 완료
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        📋 리포트 복사
                      </>
                    )}
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* 3줄 요약 */}
                <Card className="p-4 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                  <h3 className="font-semibold text-purple-700 mb-2 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    요약
                  </h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">
                    {analysisResults[openDialogVideoId].summary}
                  </p>
                </Card>

                {/* 인기 원인 */}
                <Card className="p-4 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
                  <h3 className="font-semibold text-blue-700 mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    인기 원인
                  </h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {analysisResults[openDialogVideoId].viral_reason}
                  </p>
                </Card>

                {/* 도입부 훅 */}
                {analysisResults[openDialogVideoId].intro_hook && (
                  <Card className="p-4 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                    <h3 className="font-semibold text-green-700 mb-2 flex items-center">
                      🎬 도입부 훅 (Intro Hook)
                    </h3>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {analysisResults[openDialogVideoId].intro_hook}
                    </p>
                  </Card>
                )}

                {/* 대본 구조 */}
                {analysisResults[openDialogVideoId].plot_structure && (
                  <Card className="p-4 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                    <h3 className="font-semibold text-orange-700 mb-2 flex items-center">
                      📝 대본 구조 (Plot)
                    </h3>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {analysisResults[openDialogVideoId].plot_structure}
                    </p>
                  </Card>
                )}

                {/* 타겟 시청층 */}
                {analysisResults[openDialogVideoId].target_audience && (
                  <Card className="p-4 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <h3 className="font-semibold text-indigo-700 mb-2 flex items-center">
                      🎯 타겟 시청층
                    </h3>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {analysisResults[openDialogVideoId].target_audience}
                    </p>
                  </Card>
                )}

                {/* 감정 트리거 */}
                {analysisResults[openDialogVideoId].emotional_trigger && (
                  <Card className="p-4 border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50">
                    <h3 className="font-semibold text-pink-700 mb-2 flex items-center">
                      💓 감정 트리거
                    </h3>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {analysisResults[openDialogVideoId].emotional_trigger}
                    </p>
                  </Card>
                )}

                {/* 낚시 지수 */}
                <Card className="p-4 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                  <h3 className="font-semibold text-purple-700 mb-3 flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    낚시 지수
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">점수</span>
                      <span className="font-semibold text-purple-600">
                        {analysisResults[openDialogVideoId].clickbait_score} / 100
                      </span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={analysisResults[openDialogVideoId].clickbait_score} 
                        className="h-3 bg-gray-200"
                      />
                      <div 
                        className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 transition-all duration-300"
                        style={{ width: `${analysisResults[openDialogVideoId].clickbait_score}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analysisResults[openDialogVideoId].clickbait_score >= 70 
                        ? "높은 낚시성 콘텐츠" 
                        : analysisResults[openDialogVideoId].clickbait_score >= 40 
                        ? "보통 낚시성 콘텐츠" 
                        : "낮은 낚시성 콘텐츠"}
                    </p>
                  </div>
                </Card>

                {/* 추천 키워드 */}
                <Card className="p-4 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
                  <h3 className="font-semibold text-blue-700 mb-3 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    추천 키워드
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisResults[openDialogVideoId].keywords.map((keyword, idx) => (
                      <Badge
                        key={idx}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </Card>

                {/* 여론/반응 */}
                <Card className="p-4 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
                  <h3 className="font-semibold text-purple-700 mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    여론/반응
                  </h3>
                  <Badge
                    className={
                      analysisResults[openDialogVideoId].sentiment === '긍정'
                        ? "bg-green-500 text-white"
                        : analysisResults[openDialogVideoId].sentiment === '부정'
                        ? "bg-red-500 text-white"
                        : "bg-gray-500 text-white"
                    }
                  >
                    {analysisResults[openDialogVideoId].sentiment}
                  </Badge>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* API 키 설정 모달 */}
        <Dialog open={openApiKeyDialog} onOpenChange={setOpenApiKeyDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent flex items-center">
                <Key className="w-5 h-5 mr-2" />
                🔑 Gemini API 키 설정
              </DialogTitle>
              <DialogDescription>
                Google Gemini API 키를 입력해주세요. 키는 브라우저에 안전하게 저장됩니다.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  API 키
                </label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveApiKey();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  API 키는 <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>에서 발급받을 수 있습니다.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenApiKeyDialog(false);
                    setApiKeyInput('');
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveApiKey}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
                >
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TrendingVideosDetail;

