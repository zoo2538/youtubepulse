import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  ExternalLink, 
  Calendar,
  Settings,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Sparkles,
  CheckCircle2,
  Loader2,
  Key,
  Eye
} from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface ChannelRankingData {
  rank: number;
  channelId: string;
  channelName: string;
  thumbnail: string;
  todayViews: number;
  yesterdayViews: number;
  rankChange: number;
  changePercent: number;
  description?: string;
  totalSubscribers?: number;
  channelCreationDate?: string;
  videoCount?: number;
  topVideo?: {
    videoId: string;
    title: string;
    viewCount: number;
    description?: string;
    thumbnailUrl?: string;
  };
}

interface AiAnalysisResult {
  summary: string;
  viral_reason: string;
  keywords: string[];
  clickbait_score: number;
  sentiment: string;
}

interface AiAnalysisResult {
  summary: string;
  viral_reason: string;
  keywords: string[];
  clickbait_score: number;
  sentiment: string;
}

const ChannelTrend = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const channelIdParam = searchParams.get('channelId') || '';
  
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channelIdParam);
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString());
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 일주일 전으로 변경 (20일 → 7일)
    return date.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
  });
  const [endDate, setEndDate] = useState<string>(getKoreanDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [country, setCountry] = useState<string>('대한민국');
  const [showNewOnly, setShowNewOnly] = useState<boolean>(false);
  const [reverseOrder, setReverseOrder] = useState<boolean>(false);
  const [excludeOfficial, setExcludeOfficial] = useState<boolean>(true); // 공식 채널 제외 (기본값: true)
  const [showOnlyOfficial, setShowOnlyOfficial] = useState<boolean>(false); // 공식 채널만 표시 (기본값: false)
  
  const [channelRankings, setChannelRankings] = useState<ChannelRankingData[]>([]);
  
  // 디바운싱을 위한 타이머 ref
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 스크롤 위치 유지를 위한 ref
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number | null>(null);
  const shouldRestoreScrollRef = useRef<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelRankingData | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  
  // AI 분석 관련 상태
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AiAnalysisResult>>({});
  const [openDialogVideoId, setOpenDialogVideoId] = useState<string | null>(null);
  const [analyzedVideoIds, setAnalyzedVideoIds] = useState<Set<string>>(new Set());
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [openApiKeyDialog, setOpenApiKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // 컴포넌트 마운트 시 API 키 로드
  useEffect(() => {
    const savedKey = localStorage.getItem('geminiApiKey');
    setGeminiApiKey(savedKey);
  }, []);

  // API 키 저장 함수
  const handleSaveApiKey = () => {
    console.log('💾 API 키 저장 시도');
    if (!apiKeyInput.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }
    const trimmedKey = apiKeyInput.trim();
    localStorage.setItem('geminiApiKey', trimmedKey);
    setGeminiApiKey(trimmedKey);
    setOpenApiKeyDialog(false);
    setApiKeyInput('');
    console.log('✅ API 키 저장 완료');
    alert('API 키가 저장되었습니다.');
  };

  // AI 분석 함수
  const handleAnalyze = async (video: { videoId: string; title: string; viewCount: number; description?: string }) => {
    console.log('🔍 AI 분석 시작:', video);
    
    if (analyzingVideoId === video.videoId) {
      console.log('⚠️ 이미 분석 중입니다.');
      return;
    }
    
    const apiKey = localStorage.getItem('geminiApiKey');
    console.log('🔑 API 키 확인:', apiKey ? '있음' : '없음');
    
    if (!apiKey || apiKey.trim() === '') {
      alert('먼저 AI 키를 설정해주세요.');
      setOpenApiKeyDialog(true);
      return;
    }
    
    setAnalyzingVideoId(video.videoId);
    
    const requestData = {
      videoId: video.videoId,
      title: video.title,
      channelName: selectedChannel?.channelName || '알 수 없음',
      description: video.description || '',
      viewCount: video.viewCount,
      apiKey: apiKey.trim(),
    };
    
    console.log('📡 API 요청 전송 중...', {
      videoId: requestData.videoId,
      title: requestData.title.substring(0, 50),
      channelName: requestData.channelName,
      viewCount: requestData.viewCount,
      apiKeyLength: requestData.apiKey.length,
      hasDescription: !!requestData.description
    });
    
    try {
      const apiUrl = `${API_BASE_URL}/api/analyze/video`;
      console.log('📡 API 요청 URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('📥 API 응답 받음:', response.status, response.statusText);

      // 응답 본문을 한 번만 읽기
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      if (!response.ok) {
        let errorMessage = `분석 실패: ${response.statusText}`;
        try {
          if (isJson) {
            const errorData = await response.json();
            console.error('❌ API 오류 상세:', errorData);
            errorMessage = errorData.error || errorData.message || errorMessage;
            if (errorData.message && errorData.message !== errorMessage) {
              errorMessage += ` (${errorData.message})`;
            }
          } else {
            const errorText = await response.text();
            console.error('❌ API 오류 (텍스트):', errorText);
            errorMessage = errorText || errorMessage;
          }
        } catch (parseError) {
          console.error('❌ 응답 본문 읽기 실패:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ 분석 결과:', result);
      
      if (result.success && result.data) {
        setAnalysisResults(prev => ({
          ...prev,
          [video.videoId]: result.data,
        }));
        setAnalyzedVideoIds(prev => new Set([...prev, video.videoId]));
        setOpenDialogVideoId(video.videoId);
        console.log('✅ 분석 완료 및 모달 열기');
      } else {
        const errorMsg = result.error || result.message || '분석 결과를 받을 수 없습니다.';
        console.error('❌ 분석 결과 오류:', result);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ AI 분석 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      console.error('❌ 에러 스택:', error instanceof Error ? error.stack : 'N/A');
      alert(`AI 분석 실패: ${errorMessage}\n\n브라우저 콘솔(F12)에서 자세한 오류를 확인하세요.`);
    } finally {
      setAnalyzingVideoId(null);
    }
  };

  // 채널 랭킹 데이터 로드 (Web Worker 사용)
  useEffect(() => {
    const loadChannelRankings = async () => {
      try {
        setIsLoading(true);
        const startTime = performance.now();
        
        // 선택된 날짜와 어제 날짜 계산
        const targetDate = selectedDate || getKoreanDateString();
        const yesterday = new Date(targetDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
        
        // 데이터 병렬 로드
        const [classifiedData, unclassifiedData] = await Promise.all([
          indexedDBService.loadClassifiedData(),
          indexedDBService.loadUnclassifiedData()
        ]);
        
        const loadTime = performance.now() - startTime;
        console.log(`📊 데이터 로드 완료: ${classifiedData.length + unclassifiedData.length}개 (${loadTime.toFixed(0)}ms)`);
        
        // 모든 데이터를 하나로 합침 (워커에서 처리)
        const allData = [...classifiedData, ...unclassifiedData];
        
        // Web Worker 생성 및 랭킹 계산 위임
        const worker = new Worker(new URL('../workers/ranking.worker.ts', import.meta.url), { type: 'module' });
        
        // 워커에 데이터 전송 (모든 계산 로직은 워커에서 처리)
        worker.postMessage({
          classifiedData,
          unclassifiedData,
          targetDate,
          yesterdayStr,
          showNewOnly,
          reverseOrder,
          country,
          excludeOfficial,
          showOnlyOfficial
        });
        
        // 워커로부터 결과 수신
        worker.onmessage = (e) => {
          const { success, rankings, processingTime, channelCount, error } = e.data;
          
          if (success) {
            setChannelRankings(rankings);
            
            const totalTime = performance.now() - startTime;
            console.log(`✅ 채널 랭킹 계산 완료: ${channelCount}개 채널 (워커: ${processingTime.toFixed(0)}ms, 총: ${totalTime.toFixed(0)}ms)`);
            
            // URL 파라미터로 채널이 지정된 경우 선택
            if (channelIdParam && rankings.length > 0) {
              const foundChannel = rankings.find(c => c.channelId === channelIdParam);
              if (foundChannel) {
                setSelectedChannel(foundChannel);
                setSelectedChannelId(channelIdParam);
              }
            } else if (selectedChannelId && rankings.length > 0) {
              // 날짜 변경 시 선택된 채널이 새로운 랭킹에 있는지 확인
              const foundChannel = rankings.find(c => c.channelId === selectedChannelId);
              if (foundChannel) {
                // 같은 채널이면 선택 상태만 업데이트 (selectedChannelId는 변경하지 않아 차트는 다시 로드하지 않음)
                setSelectedChannel(foundChannel);
                // selectedChannelId는 변경하지 않음 - 차트는 다시 로드되지 않음
              } else {
                // 선택된 채널이 새 랭킹에 없으면 선택 해제
                setSelectedChannel(null);
                setSelectedChannelId('');
                setSearchParams({});
              }
            }
            
            setIsLoading(false);
          } else {
            console.error('❌ 워커 랭킹 계산 실패:', error);
            setIsLoading(false);
          }
          
          // 워커 종료
          worker.terminate();
        };
        
        // 워커 오류 처리
        worker.onerror = (error) => {
          console.error('❌ 워커 오류:', error);
          setIsLoading(false);
          worker.terminate();
        };
        
      } catch (error) {
        console.error('채널 랭킹 로드 실패:', error);
        setIsLoading(false);
      }
    };
    
    loadChannelRankings();
  }, [selectedDate, showNewOnly, reverseOrder, channelIdParam, country, excludeOfficial, showOnlyOfficial, selectedChannelId, setSearchParams]);

  // 채널 선택 시 차트 데이터 로드
  useEffect(() => {
    if (!selectedChannelId) {
      setChartData([]);
      setIsLoadingChart(false);
      return;
    }
    
    const loadChartData = async () => {
      try {
        setIsLoadingChart(true);
        const startTime = performance.now();
        console.log(`📊 차트 데이터 로드 시작: 채널 ${selectedChannelId}`);
        
        const unclassifiedData = await indexedDBService.loadUnclassifiedData();
        const classifiedData = await indexedDBService.loadClassifiedData();
        
        // 트렌드 페이지는 채널 랭킹이므로 분류 여부와 상관없이 모든 데이터 포함
        const unclassifiedChannelData = unclassifiedData.filter((item: any) => 
          item.channelId === selectedChannelId
        );
        const classifiedChannelData = classifiedData.filter((item: any) => 
          item.channelId === selectedChannelId
        );
        
        const allChannelData = [...unclassifiedChannelData, ...classifiedChannelData];
        
        // 중복 제거 (videoId + dayKeyLocal 기준)
        const uniqueMap = new Map();
        allChannelData.forEach((item: any) => {
          const key = `${item.videoId}-${item.dayKeyLocal || item.collectionDate}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        
        const channelVideos = Array.from(uniqueMap.values());
        
        if (channelVideos.length === 0) {
          setChartData([]);
          setIsLoadingChart(false);
          return;
        }
        
        // 날짜 범위 내의 데이터 필터링
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        // 기간별 데이터 집계
        const chartDataMap = new Map<string, number>();
        
        channelVideos.forEach((video: any) => {
          const videoDate = video.collectionDate || video.uploadDate || video.dayKeyLocal;
          if (!videoDate) return;
          
          const dateStr = videoDate.split('T')[0];
          const videoDateObj = new Date(dateStr);
          
          if (videoDateObj < start || videoDateObj > end) return;
          
          let key: string;
          if (period === 'daily') {
            key = dateStr;
          } else if (period === 'weekly') {
            // 주의 시작일 (월요일) 계산
            const dayOfWeek = videoDateObj.getDay();
            const monday = new Date(videoDateObj);
            monday.setDate(videoDateObj.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            key = monday.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
          }
          
          const currentValue = chartDataMap.get(key) || 0;
          chartDataMap.set(key, currentValue + (video.viewCount || 0));
        });
        
        // 차트 데이터 생성 (날짜 순 정렬)
        const sortedData = Array.from(chartDataMap.entries())
          .map(([date, views]) => ({
            date,
            views
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        setChartData(sortedData);
        const loadTime = performance.now() - startTime;
        console.log(`✅ 차트 데이터 로드 완료: ${sortedData.length}개 데이터 포인트 (${loadTime.toFixed(0)}ms)`);
        setIsLoadingChart(false);
      } catch (error) {
        console.error('차트 데이터 로드 실패:', error);
        setIsLoadingChart(false);
      }
    };
    
    loadChartData();
  }, [selectedChannelId, period, startDate, endDate]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // 채널 선택 핸들러 (state만 업데이트, URL 변경 없음)
  const handleChannelSelect = (channel: ChannelRankingData) => {
    setSelectedChannel(channel);
    setSelectedChannelId(channel.channelId);
  };

  // 채널 선택 핸들러 (state + URL 업데이트)
  const handleChannelSelectWithUrl = (channel: ChannelRankingData) => {
    setSelectedChannel(channel);
    setSelectedChannelId(channel.channelId);
    // replace: true로 히스토리를 교체하여 스크롤 위치 유지
    setSearchParams({ channelId: channel.channelId }, { replace: true });
  };

  // 마우스 호버 핸들러 (디바운싱 적용, URL 변경 없음)
  const handleMouseEnter = (channel: ChannelRankingData) => {
    // 기존 타이머가 있다면 취소
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // 300ms 후에 채널 선택 실행 (URL 변경 없이 state만 업데이트)
    hoverTimeoutRef.current = setTimeout(() => {
      handleChannelSelect(channel);
      hoverTimeoutRef.current = null;
    }, 300);
  };

  // 마우스 떠날 때 타이머 취소
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // 클릭 핸들러 (즉시 실행 + 호버 타이머 취소 + URL 업데이트)
  const handleClick = (channel: ChannelRankingData, event: React.MouseEvent) => {
    // 대기 중인 호버 타이머 취소
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // 스크롤 위치 저장 (클릭 시에만)
    if (tableScrollRef.current) {
      savedScrollTopRef.current = tableScrollRef.current.scrollTop;
      shouldRestoreScrollRef.current = true;
    }
    
    // 즉시 채널 선택 (URL 포함)
    handleChannelSelectWithUrl(channel);
  };
  
  // 스크롤 위치 복원 (클릭 후 selectedChannelId 변경 시에만)
  useEffect(() => {
    if (shouldRestoreScrollRef.current && savedScrollTopRef.current !== null && tableScrollRef.current) {
      const savedScroll = savedScrollTopRef.current;
      const restoreScroll = () => {
        if (tableScrollRef.current && savedScroll !== null) {
          tableScrollRef.current.scrollTop = savedScroll;
        }
      };
      
      // 리렌더링 완료 후 스크롤 복원 (여러 시점에 시도)
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(() => {
          restoreScroll();
        }, 0);
        setTimeout(() => {
          restoreScroll();
          savedScrollTopRef.current = null;
          shouldRestoreScrollRef.current = false;
        }, 10);
      });
    }
  }, [selectedChannelId]);

  // 검색 필터링된 채널 목록 (useMemo로 최적화)
  const filteredRankings = useMemo(() => {
    if (!searchQuery.trim()) return channelRankings;
    const query = searchQuery.toLowerCase();
    return channelRankings.filter(channel =>
      channel.channelName.toLowerCase().includes(query) ||
      channel.channelId.toLowerCase().includes(query)
    );
  }, [channelRankings, searchQuery]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-muted-foreground">
            조회수: {formatNumber(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
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
              <Link to="/trend">
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  트렌드
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
              <Link to="/system">
                <Button 
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  시스템
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔑 API 키 설정 버튼 클릭 (배너)');
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

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* 왼쪽: 채널 랭킹 대시보드 (1.5배 확장: 3/7 = 약 43%) */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">채널 랭킹 대시보드</h2>
                {/* AI 키 설정 버튼 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔑 API 키 설정 버튼 클릭 (필터)');
                    const savedKey = localStorage.getItem('geminiApiKey');
                    setApiKeyInput(savedKey || '');
                    setOpenApiKeyDialog(true);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 border-0"
                >
                  <Key className="w-4 h-4 mr-2" />
                  🔑 AI 키 설정
                </Button>
              </div>
              
              {/* 필터 컨트롤 */}
              <div className="space-y-3 mb-4">
                {/* 기간 선택 */}
                <div className="flex space-x-1">
                  <Button
                    variant={period === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriod('daily')}
                    className={period === 'daily' ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    일별
                  </Button>
                  <Button
                    variant={period === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriod('weekly')}
                    className={period === 'weekly' ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    주별
                  </Button>
                </div>

                {/* 국가 필터 */}
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="대한민국">대한민국</SelectItem>
                  </SelectContent>
                </Select>

                {/* 날짜 선택 */}
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />

                {/* 검색 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="채널명으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* 액션 버튼 */}
                <div className="flex space-x-2 flex-wrap gap-2">
                  <Button
                    variant={showNewOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowNewOnly(!showNewOnly)}
                    className={showNewOnly ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    신규진입
                  </Button>
                  <Button
                    variant={reverseOrder ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReverseOrder(!reverseOrder)}
                    className={reverseOrder ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    <ArrowUpDown className="w-4 h-4 mr-1" />
                    역순
                  </Button>
                  <Button
                    variant={showOnlyOfficial ? 'default' : excludeOfficial ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (showOnlyOfficial) {
                        // 공식 채널만 표시 모드에서 클릭하면 전체 표시로
                        setShowOnlyOfficial(false);
                        setExcludeOfficial(true);
                      } else if (excludeOfficial) {
                        // 공식 채널 제외 모드에서 클릭하면 공식 채널만 표시로
                        setShowOnlyOfficial(true);
                        setExcludeOfficial(false);
                      } else {
                        // 전체 표시 모드에서 클릭하면 공식 채널 제외로
                        setExcludeOfficial(true);
                        setShowOnlyOfficial(false);
                      }
                    }}
                    className={showOnlyOfficial ? 'bg-blue-600 hover:bg-blue-700' : excludeOfficial ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    {showOnlyOfficial ? '공식채널만' : excludeOfficial ? '공식채널 제외' : '전체 표시'}
                  </Button>
                </div>
              </div>

              {/* 채널 랭킹 테이블 */}
              <div ref={tableScrollRef} className="space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">로딩 중...</p>
                  </div>
                ) : filteredRankings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">채널을 찾을 수 없습니다</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">순위</TableHead>
                        <TableHead>채널 정보</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRankings.map((channel) => (
                        <TableRow
                          key={channel.channelId}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            selectedChannelId === channel.channelId ? 'bg-red-600/10' : ''
                          }`}
                          onMouseEnter={() => handleMouseEnter(channel)}
                          onMouseLeave={handleMouseLeave}
                          onClick={(e) => handleClick(channel, e)}
                        >
                          <TableCell>
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-foreground">{channel.rank}</span>
                              {channel.rankChange !== 0 && (
                                <span className={`text-xs flex items-center ${
                                  channel.rankChange > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {channel.rankChange > 0 ? (
                                    <>
                                      <TrendingUp className="w-3 h-3 mr-1" />
                                      {channel.rankChange}
                                    </>
                                  ) : (
                                    <>
                                      <TrendingDown className="w-3 h-3 mr-1" />
                                      {Math.abs(channel.rankChange)}
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <img
                                src={channel.thumbnail}
                                alt={channel.channelName}
                                className="w-24 h-24 rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {channel.channelName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {channel.channelId}
                                </p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-sm font-semibold text-foreground">
                                    {formatNumber(channel.todayViews)}
                                  </span>
                                  {channel.changePercent !== 0 && (
                                    <span className={`text-xs flex items-center ${
                                      channel.changePercent > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {channel.changePercent > 0 ? (
                                        <>
                                          <TrendingUp className="w-3 h-3 mr-1" />
                                          {channel.changePercent.toFixed(1)}%
                                        </>
                                      ) : (
                                        <>
                                          <TrendingDown className="w-3 h-3 mr-1" />
                                          {channel.changePercent.toFixed(1)}%
                                        </>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          </div>

          {/* 오른쪽: 채널 상세 정보 및 차트 (4/7 = 약 57%) */}
          <div className="lg:col-span-4 space-y-4">
            {selectedChannel ? (
              <>
                {/* 채널 상세 정보 */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <img
                        src={selectedChannel.thumbnail}
                        alt={selectedChannel.channelName}
                        className="w-16 h-16 rounded-full"
                      />
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">
                          {selectedChannel.channelName}
                        </h3>
                        <p className="text-sm text-muted-foreground">{selectedChannel.channelId}</p>
                      </div>
                    </div>
                    <a
                      href={`https://www.youtube.com/channel/${selectedChannel.channelId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        유튜브에서 보기
                      </Button>
                    </a>
                  </div>

                  {/* 채널 통계 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">총 조회수</p>
                      <p className="text-2xl font-bold text-foreground">
                        {formatNumber(selectedChannel.todayViews)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">총 구독자 수</p>
                      <p className="text-2xl font-bold text-foreground">
                        {selectedChannel.totalSubscribers ? formatNumber(selectedChannel.totalSubscribers) : '데이터 없음'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">채널 생성일</p>
                      <p className="text-lg font-semibold text-foreground">
                        {selectedChannel.channelCreationDate ? 
                          new Date(selectedChannel.channelCreationDate).toLocaleDateString('ko-KR') : 
                          '데이터 없음'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">영상 개수</p>
                      <p className="text-lg font-semibold text-foreground">
                        {selectedChannel.videoCount || 0}
                      </p>
                    </div>
                  </div>

                  {/* 채널 설명 */}
                  {selectedChannel.description && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-foreground mb-2">채널 설명</h4>
                      <div className="bg-muted/50 p-4 rounded-lg max-h-32 overflow-y-auto">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedChannel.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 최고 조회수 비디오 및 AI 분석 */}
                  {selectedChannel.topVideo && (
                    <div className="mb-6 p-4 border-2 border-purple-200 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-purple-700 flex items-center">
                          <TrendingUp className="w-4 h-4 mr-2" />
                          최고 조회수 영상
                        </h4>
                        <Button
                          size="sm"
                          variant={analyzedVideoIds.has(selectedChannel.topVideo.videoId) ? "outline" : "default"}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 AI 분석 버튼 클릭:', selectedChannel.topVideo);
                            console.log('📊 분석 결과 존재 여부:', !!analysisResults[selectedChannel.topVideo!.videoId]);
                            console.log('🔑 API 키 상태:', geminiApiKey);
                            
                            // 이미 분석된 경우 결과 표시, 아니면 새로 분석
                            if (analysisResults[selectedChannel.topVideo!.videoId]) {
                              console.log('📊 기존 분석 결과 표시');
                              setOpenDialogVideoId(selectedChannel.topVideo!.videoId);
                            } else if (analyzedVideoIds.has(selectedChannel.topVideo!.videoId)) {
                              // 분석 완료되었지만 결과가 없는 경우 (캐시에서 로드 필요)
                              console.log('📊 분석 완료 상태이지만 결과 없음 - 재분석');
                              handleAnalyze(selectedChannel.topVideo!);
                            } else {
                              console.log('🚀 새 분석 시작');
                              handleAnalyze(selectedChannel.topVideo!);
                            }
                          }}
                          disabled={analyzingVideoId === selectedChannel.topVideo.videoId || !geminiApiKey}
                          className={`bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 ${
                            (!geminiApiKey || analyzingVideoId === selectedChannel.topVideo.videoId) ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {analyzingVideoId === selectedChannel.topVideo.videoId ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              분석 중...
                            </>
                          ) : analyzedVideoIds.has(selectedChannel.topVideo.videoId) ? (
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
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {selectedChannel.topVideo.title}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>조회수: {formatNumber(selectedChannel.topVideo.viewCount)}</span>
                          {selectedChannel.topVideo.videoId && (
                            <a
                              href={`https://www.youtube.com/watch?v=${selectedChannel.topVideo.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              영상 보기
                            </a>
                          )}
                        </div>
                        {!geminiApiKey && (
                          <p className="text-xs text-yellow-600 mt-2">
                            ⚠️ AI 분석을 사용하려면 API 키를 설정해주세요.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 차트 필터 */}
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex space-x-1">
                      <Button
                        variant={period === 'daily' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('daily')}
                        className={period === 'daily' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        일별
                      </Button>
                      <Button
                        variant={period === 'weekly' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('weekly')}
                        className={period === 'weekly' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        주별
                      </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-40"
                      />
                      <span className="text-muted-foreground">~</span>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-40"
                      />
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => {
                          // 차트 데이터 다시 로드
                          setSelectedChannelId(selectedChannelId);
                        }}
                      >
                        조회
                      </Button>
                    </div>
                  </div>

                  {/* 조회수 성장 차트 */}
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-4">조회수 성장 차트</h4>
                    {isLoadingChart ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                          <p className="mt-4 text-muted-foreground">차트 데이터를 불러오는 중...</p>
                        </div>
                      </div>
                    ) : chartData.length === 0 ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <p className="text-muted-foreground">선택한 기간에 데이터가 없습니다</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tick={{ fontSize: 10 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickFormatter={(value) => formatNumber(value)}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="views" 
                            stroke="#F97316"
                            strokeWidth={3}
                            dot={{ fill: "#F97316", strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: "#F97316", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-6">
                <div className="flex items-center justify-center h-[600px]">
                  <div className="text-center">
                    <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">왼쪽에서 채널을 선택하세요</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

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
                    e.preventDefault();
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('❌ API 키 설정 취소');
                  setOpenApiKeyDialog(false);
                  setApiKeyInput('');
                }}
              >
                취소
              </Button>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('✅ API 키 저장 버튼 클릭');
                  handleSaveApiKey();
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
              >
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelTrend;
