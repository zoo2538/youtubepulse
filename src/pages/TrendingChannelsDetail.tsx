import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  TrendingDown,
  TrendingUp,
  Users,
  Eye,
  LogOut,
  BarChart3,
  Settings,
  User,
  Sparkles,
  CheckCircle2,
  Loader2,
  Key,
  Copy,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString, cn } from "@/lib/utils";
import { subCategories } from "@/lib/subcategories";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL } from "@/lib/config";
import { showToast } from "@/lib/toast-util";

interface ChannelData {
  id: string;
  channelName: string;
  thumbnail: string;
  category: string;
  subCategory: string;
  todayViews: number;
  yesterdayViews: number;
  changeAmount: number;
  changePercent: number;
  topVideoUrl?: string;
  topVideoTitle?: string;
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

// YouTube URL에서 videoId 추출 함수
function extractVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

const SORT_OPTIONS = [
  { value: "changePercent", label: "증감률 높은 순" },
  { value: "changeAmount", label: "증가분 높은 순" },
  { value: "todayViews", label: "당일 조회수 높은 순" },
];

const TrendingChannelsDetail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, userEmail } = useAuth();

  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [filteredChannelData, setFilteredChannelData] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
  const [sortOption, setSortOption] = useState<string>("changePercent");

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

  const isAdmin = useMemo(() => !!userEmail, [userEmail]);
  const dynamicSubCategories = subCategories;

  // 사용 가능한 날짜 목록 (최근 14일)
  useEffect(() => {
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
    }
    setAvailableDates(dates);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  const applyFiltersForData = useCallback(
    (data: ChannelData[]): ChannelData[] => {
      let filtered = [...data];

      if (selectedCategory !== "all") {
        filtered = filtered.filter((channel) => channel.category === selectedCategory);
      }

      if (selectedSubCategory !== "all") {
        filtered = filtered.filter((channel) => channel.subCategory === selectedSubCategory);
      }

      switch (sortOption) {
        case "changeAmount":
          filtered.sort((a, b) => b.changeAmount - a.changeAmount);
          break;
        case "todayViews":
          filtered.sort((a, b) => b.todayViews - a.todayViews);
          break;
        case "changePercent":
        default:
          filtered.sort((a, b) => b.changePercent - a.changePercent);
          break;
      }

      return filtered;
    },
    [selectedCategory, selectedSubCategory, sortOption]
  );

  const generateChannelStats = useCallback(
    (allData: any[]) => {
    if (!allData || allData.length === 0) {
      setChannelData([]);
      setFilteredChannelData([]);
      return;
    }

    const targetDate = selectedDate || getKoreanDateString();
    const todayData = allData.filter((item: any) => {
      const itemDate = item.collectionDate || item.uploadDate || item.dayKeyLocal;
      return itemDate && itemDate.split("T")[0] === targetDate && item.channelId;
    });

    const yesterday = new Date(new Date(targetDate).getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const yesterdayData = allData.filter(
      (item: any) => {
        const itemDate = item.collectionDate || item.uploadDate || item.dayKeyLocal;
        return itemDate && itemDate.split("T")[0] === yesterday && item.channelId;
      }
    );

    console.log(`📊 급등 채널 상세 - ${targetDate} 데이터 ${todayData.length}개`);
    console.log(`📊 급등 채널 상세 - ${yesterday} 데이터 ${yesterdayData.length}개`);

    const todayGroups: Record<
      string,
      {
        channelId: string;
        channelName: string;
        category: string;
        subCategory: string;
        thumbnail: string;
        totalViews: number;
        videos: any[];
      }
    > = {};

    todayData.forEach((item: any) => {
      if (!todayGroups[item.channelId]) {
        todayGroups[item.channelId] = {
          channelId: item.channelId,
          channelName: item.channelName || "채널명 없음",
          category: item.category || "기타",
          subCategory: item.subCategory || "미분류",
          thumbnail:
            item.channelThumbnail ||
            item.thumbnailUrl ||
            `https://via.placeholder.com/96x96?text=${(item.channelName || "CH").charAt(0)}`,
          totalViews: 0,
          videos: [],
        };
      }
      todayGroups[item.channelId].totalViews += item.viewCount || 0;
      todayGroups[item.channelId].videos.push(item);
    });

    const yesterdayGroups: Record<string, number> = {};
    yesterdayData.forEach((item: any) => {
      yesterdayGroups[item.channelId] =
        (yesterdayGroups[item.channelId] || 0) + (item.viewCount || 0);
    });

    const channels: ChannelData[] = Object.values(todayGroups).map((channel) => {
      const yesterdayViews = yesterdayGroups[channel.channelId] || 0;
      const changeAmount = channel.totalViews - yesterdayViews;
      const changePercent =
        yesterdayViews > 0
          ? (changeAmount / yesterdayViews) * 100
          : channel.totalViews > 0
          ? 100
          : 0;

      const latestVideo = [...channel.videos].sort((a, b) => {
        const dateA = new Date(a.uploadDate || a.collectionDate || 0);
        const dateB = new Date(b.uploadDate || b.collectionDate || 0);
        return dateB.getTime() - dateA.getTime();
      })[0];

      const thumbnailVideo = channel.videos.find(
        (video: any) => video.thumbnailUrl && !video.thumbnailUrl.includes("placeholder")
      );

      const channelThumbnail =
        thumbnailVideo?.thumbnailUrl ||
        channel.thumbnail ||
        `https://via.placeholder.com/96x96?text=${channel.channelName.charAt(0)}`;

      return {
        id: channel.channelId,
        channelName: channel.channelName,
        category: channel.category || '미분류',
        subCategory: channel.subCategory || '',
        thumbnail: channelThumbnail,
        todayViews: channel.totalViews,
        yesterdayViews,
        changeAmount,
        changePercent,
        topVideoUrl: latestVideo?.videoId
          ? `https://www.youtube.com/watch?v=${latestVideo.videoId}`
          : undefined,
        topVideoTitle: latestVideo?.videoTitle || latestVideo?.title || undefined,
      };
    });

    setChannelData(channels);
      setFilteredChannelData(applyFiltersForData(channels));
    },
    [selectedDate, applyFiltersForData]
  );

  const loadChannelData = useCallback(async () => {
    setLoading(true);
    try {
      // 분류된 데이터와 미분류 데이터 모두 로드
      const classifiedData = await indexedDBService.loadClassifiedData();
      const unclassifiedData = await indexedDBService.loadUnclassifiedData();
      const allData = [...classifiedData, ...unclassifiedData];
      
      console.log(`📊 급등 채널 상세 - IndexedDB에서 분류: ${classifiedData.length}개, 미분류: ${unclassifiedData.length}개, 전체: ${allData.length}개`);

      // 백그라운드 서버 동기화 (UI 블로킹 없음)
      setTimeout(async () => {
        try {
          const [serverClassified, serverUnclassified] = await Promise.all([
            hybridService.getClassifiedData(),
            hybridService.loadUnclassifiedData()
          ]);
          const serverAllData = [...serverClassified, ...serverUnclassified];
          
          if (serverAllData.length > allData.length) {
            console.log(
              `🔄 급등 채널 상세 - 서버 데이터 ${serverAllData.length}개 > 로컬 ${allData.length}개`
            );
            generateChannelStats(serverAllData);
          }
        } catch (error) {
          console.warn("⚠️ 급등 채널 상세 - 백그라운드 동기화 실패 (무시)", error);
        }
      }, 1000);

      generateChannelStats(allData);
    } catch (error) {
      console.error("❌ 급등 채널 데이터 로드 실패:", error);
      setChannelData([]);
      setFilteredChannelData([]);
    } finally {
      setLoading(false);
    }
  }, [generateChannelStats]);

  const applyFilters = useCallback(() => {
    setFilteredChannelData(applyFiltersForData(channelData));
  }, [channelData, applyFiltersForData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    loadChannelData();
  }, [loadChannelData]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubCategory("all");
  };

  // API 키 로드
  useEffect(() => {
    const savedKey = localStorage.getItem('geminiApiKey');
    setGeminiApiKey(savedKey);
  }, []);

  // API 키 저장 함수
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }
    const trimmedKey = apiKeyInput.trim();
    localStorage.setItem('geminiApiKey', trimmedKey);
    setGeminiApiKey(trimmedKey);
    setOpenApiKeyDialog(false);
    setApiKeyInput('');
    alert('API 키가 저장되었습니다.');
  };

  // AI 분석 함수 (대표 영상 분석)
  const handleAnalyze = async (channel: ChannelData) => {
    if (!channel.topVideoUrl) {
      alert('대표 영상이 없어 분석할 수 없습니다.');
      return;
    }
    
    const videoId = extractVideoId(channel.topVideoUrl);
    if (!videoId) {
      alert('유효하지 않은 영상 URL입니다.');
      return;
    }

    if (analyzingVideoId === videoId) return;
    
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey || apiKey.trim() === '') {
      alert('먼저 AI 키를 설정해주세요.');
      setOpenApiKeyDialog(true);
      return;
    }
    
    setAnalyzingVideoId(videoId);
    
    try {
      const apiUrl = `${API_BASE_URL}/api/analyze/video`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoId,
          title: channel.topVideoTitle || '대표 영상',
          channelName: channel.channelName,
          description: '',
          viewCount: 0,
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
          [videoId]: result.data,
        }));
        setAnalyzedVideoIds(prev => new Set([...prev, videoId]));
        setOpenDialogVideoId(videoId);
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
    const channel = filteredChannelData.find(c => {
      const channelVideoId = c.topVideoUrl ? extractVideoId(c.topVideoUrl) : null;
      return channelVideoId === videoId;
    });
    
    if (!insight || !channel) {
      alert('복사할 분석 결과가 없습니다.');
      return;
    }

    const reportText = `[AI 분석 리포트: ${channel.topVideoTitle || '대표 영상'}]

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
      showToast('📋 리포트가 클립보드에 복사되었습니다!', { type: 'success', duration: 2000 });
      setTimeout(() => {
        setCopiedVideoId(null);
      }, 2000);
    } catch (error) {
      console.error('복사 실패:', error);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const totalSurgeChannels = filteredChannelData.length;
  const positiveChannels = filteredChannelData.filter((channel) => channel.changeAmount > 0).length;
  const negativeChannels = filteredChannelData.filter((channel) => channel.changeAmount < 0).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">조회수 급등 채널 데이터를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>대시보드로 돌아가기</span>
              </Button>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-foreground">조회수 급등 채널</h1>
                <Badge className="bg-blue-600 text-white">
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
                  onClick={() => navigate("/dashboard")}
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
                  onClick={() => navigate("/trend")}
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
                  onClick={() => navigate("/data")}
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
                  onClick={() => navigate("/system")}
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

      <div className="container mx-auto px-4 py-8 space-y-6">
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

        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-muted-foreground">날짜</label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="날짜 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {date === getKoreanDateString() ? `오늘 (${date})` : date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-muted-foreground">카테고리</label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.keys(dynamicSubCategories).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-muted-foreground">세부카테고리</label>
              <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="세부카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {selectedCategory !== "all" &&
                    dynamicSubCategories[selectedCategory]?.map((subCategory) => (
                      <SelectItem key={subCategory} value={subCategory}>
                        {subCategory}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-muted-foreground">정렬</label>
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="정렬 선택" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4 bg-muted/40">
              <p className="text-sm text-muted-foreground mb-1">총 급등 채널</p>
              <p className="text-2xl font-semibold text-foreground">{totalSurgeChannels.toLocaleString()}개</p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-success/10">
              <p className="text-sm text-success mb-1 flex items-center space-x-1">
                <TrendingUp className="w-4 h-4" />
                <span>증가 채널</span>
              </p>
              <p className="text-2xl font-semibold text-success">{positiveChannels.toLocaleString()}개</p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-destructive/10">
              <p className="text-sm text-destructive mb-1 flex items-center space-x-1">
                <TrendingDown className="w-4 h-4" />
                <span>감소 채널</span>
              </p>
              <p className="text-2xl font-semibold text-destructive">{negativeChannels.toLocaleString()}개</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">조회수 급등 채널 목록</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedDate} 기준 상위 {filteredChannelData.length}개 채널
                {selectedCategory !== "all" && ` (${selectedCategory})`}
                {selectedSubCategory !== "all" && ` - ${selectedSubCategory}`}
              </p>
            </div>
          </div>

          {filteredChannelData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>선택한 조건에 해당하는 채널이 없습니다.</p>
              <p className="text-sm mt-1">필터를 변경하거나 데이터를 다시 수집해 주세요.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-16 text-center">순위</TableHead>
                    <TableHead className="w-64 text-center">썸네일</TableHead>
                    <TableHead>채널 정보</TableHead>
                    <TableHead className="text-right">당일 조회수</TableHead>
                    <TableHead className="text-right">전일 조회수</TableHead>
                    <TableHead className="text-right">증가분</TableHead>
                    <TableHead className="text-right">증감률</TableHead>
                    <TableHead className="text-right">대표 영상</TableHead>
                    <TableHead className="text-center">AI 분석</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChannelData.map((channel, index) => (
                    <TableRow key={channel.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-semibold text-sm">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="w-64 h-64 rounded overflow-hidden bg-muted mx-auto">
                          <img
                            src={channel.thumbnail}
                            alt={channel.channelName}
                            className="w-full h-full object-cover object-center"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="space-y-2">
                        <div className="font-medium text-foreground">{channel.channelName}</div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-xs">
                            {channel.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {channel.subCategory || "미분류"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium text-foreground">
                          {formatNumber(channel.todayViews)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-muted-foreground">
                          {formatNumber(channel.yesterdayViews)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={cn(
                            "font-medium",
                            channel.changeAmount >= 0 ? "text-success" : "text-destructive"
                          )}
                        >
                          {channel.changeAmount >= 0 ? "+" : ""}
                          {formatNumber(Math.abs(channel.changeAmount))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={cn(
                            "flex items-center justify-end space-x-1 font-medium",
                            channel.changePercent >= 0 ? "text-success" : "text-destructive"
                          )}
                        >
                          {channel.changePercent >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>
                            {channel.changePercent >= 0 ? "+" : ""}
                            {Math.floor(channel.changePercent)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {channel.topVideoUrl ? (
                          <a
                            href={channel.topVideoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:text-blue-700 hover:underline"
                          >
                            {channel.topVideoTitle || "영상 보기"}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {channel.topVideoUrl ? (
                          (() => {
                            const videoId = extractVideoId(channel.topVideoUrl);
                            const isAnalyzing = analyzingVideoId === videoId;
                            const isAnalyzed = videoId ? analyzedVideoIds.has(videoId) : false;
                            const hasResult = videoId ? analysisResults[videoId] : false;
                            
                            return (
                              <Button
                                size="sm"
                                variant={isAnalyzed ? "outline" : "default"}
                                onClick={() => {
                                  if (hasResult && videoId) {
                                    setOpenDialogVideoId(videoId);
                                  } else {
                                    handleAnalyze(channel);
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
                            );
                          })()
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
                      {(() => {
                        const channel = filteredChannelData.find(c => {
                          const channelVideoId = c.topVideoUrl ? extractVideoId(c.topVideoUrl) : null;
                          return channelVideoId === openDialogVideoId;
                        });
                        return channel?.topVideoTitle || '대표 영상';
                      })()}
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

export default TrendingChannelsDetail;

