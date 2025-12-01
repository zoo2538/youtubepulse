import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Eye,
  LogOut,
  Star,
  TrendingUp,
  Users,
  Filter,
  BarChartBig,
  Gauge,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories } from "@/lib/subcategories";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE_URL } from "@/lib/config";
import { showToast } from "@/lib/toast-util";

interface PerformanceVideo {
  id: string;
  thumbnail: string;
  title: string;
  channelName: string;
  category: string;
  subCategory: string;
  views: number;
  averageViews: number;
  performanceRatio: number;
  uploadDate: string;
  collectionDate: string;
  description?: string;
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

const RATIO_OPTIONS = [
  { value: "1.5", label: "1.5배 이상" },
  { value: "2", label: "2배 이상" },
  { value: "3", label: "3배 이상" },
];

function formatViews(views: number): string {
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + "M";
  if (views >= 1_000) return (views / 1_000).toFixed(1) + "K";
  return views.toLocaleString();
}

const PerformanceVideosDetail: React.FC = () => {
  const navigate = useNavigate();
  const { logout, userEmail } = useAuth();

  const [loading, setLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
  const [minimumRatio, setMinimumRatio] = useState<string>("1.5");
  const [videos, setVideos] = useState<PerformanceVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<PerformanceVideo[]>([]);

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

  useEffect(() => {
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
    }
    setAvailableDates(dates);
  }, []);

  const buildPerformanceData = useCallback(
    (allData: any[]) => {
      if (!allData || allData.length === 0) {
        setVideos([]);
        setFilteredVideos([]);
        return;
      }

      const targetDate = selectedDate || getKoreanDateString();
      const todayData = allData.filter((item: any) => {
        const itemDate = item.collectionDate || item.uploadDate || item.dayKeyLocal;
        return itemDate && itemDate.split("T")[0] === targetDate && item.videoTitle;
      });

      console.log(`📊 평균 대비 고성과 동영상 - ${targetDate} 데이터 ${todayData.length}개`);

      const channelStats: Record<string, { totalViews: number; count: number }> = {};
      allData.forEach((item: any) => {
        if (!item.channelId || !item.viewCount) return;
        if (!channelStats[item.channelId]) {
          channelStats[item.channelId] = { totalViews: 0, count: 0 };
        }
        channelStats[item.channelId].totalViews += item.viewCount;
        channelStats[item.channelId].count += 1;
      });

      // videoId 기준으로 중복 제거 (같은 비디오가 여러 날짜에 수집된 경우 최신 조회수 사용)
      const videoMap = new Map<string, any>();
      todayData.forEach((item: any) => {
        const videoId = item.videoId || item.id;
        if (!videoId) return;
        
        const existing = videoMap.get(videoId);
        if (!existing || (item.viewCount || 0) > (existing.viewCount || 0)) {
          // 기존 항목이 없거나 현재 항목의 조회수가 더 높으면 업데이트
          videoMap.set(videoId, item);
        }
      });
      
      const uniqueVideos = Array.from(videoMap.values());

      const performanceVideos = uniqueVideos
        .map((item: any) => {
          const stats = channelStats[item.channelId];
          const averageViews =
            stats && stats.count > 0 ? Math.round(stats.totalViews / stats.count) : item.viewCount || 0;
          const performanceRatio =
            averageViews > 0 ? (item.viewCount || 0) / averageViews : 0;

          return {
            id: item.videoId || item.id,
            thumbnail:
              item.thumbnailUrl ||
              `https://via.placeholder.com/320x180?text=${item.videoTitle?.substring(0, 2) || "YT"}`,
            title: item.videoTitle || "제목 없음",
            channelName: item.channelName || "채널명 없음",
            category: item.category || "미분류",
            subCategory: item.subCategory || "",
            views: item.viewCount || 0,
            averageViews,
            performanceRatio,
            uploadDate: item.uploadDate || "",
            collectionDate: item.collectionDate || "",
            description: item.videoDescription || item.description || "",
          } as PerformanceVideo;
        })
        .filter((video) => video.performanceRatio >= parseFloat(minimumRatio))
        .sort((a, b) => b.performanceRatio - a.performanceRatio)
        .slice(0, 100);

      console.log(
        `📊 평균 대비 고성과 동영상 - 생성된 목록 ${performanceVideos.length}개`,
        performanceVideos.slice(0, 3)
      );

      setVideos(performanceVideos);
      setFilteredVideos(applyFiltersForData(performanceVideos, selectedCategory, selectedSubCategory));
    },
    [minimumRatio, selectedCategory, selectedSubCategory, selectedDate]
  );

  const loadPerformanceData = useCallback(async () => {
    setLoading(true);
    try {
      // 분류된 데이터와 미분류 데이터 모두 로드
      const classifiedData = await indexedDBService.loadClassifiedData();
      const unclassifiedData = await indexedDBService.loadUnclassifiedData();
      const allData = [...classifiedData, ...unclassifiedData];
      
      console.log(`📊 평균 대비 고성과 동영상 - IndexedDB에서 분류: ${classifiedData.length}개, 미분류: ${unclassifiedData.length}개, 전체: ${allData.length}개`);

      buildPerformanceData(allData);

      setTimeout(async () => {
        try {
          const [serverClassified, serverUnclassified] = await Promise.all([
            hybridService.getClassifiedData(),
            hybridService.loadUnclassifiedData()
          ]);
          const serverAllData = [...serverClassified, ...serverUnclassified];
          
          if (serverAllData.length > allData.length) {
            console.log(
              `🔄 평균 대비 고성과 동영상 - 서버 데이터 ${serverAllData.length}개 > 로컬 ${allData.length}개`
            );
            buildPerformanceData(serverAllData);
          }
        } catch (error) {
          console.warn("⚠️ 평균 대비 고성과 동영상 - 백그라운드 동기화 실패 (무시)", error);
        }
      }, 1000);
    } catch (error) {
      console.error("❌ 평균 대비 고성과 동영상 데이터 로드 실패:", error);
      setVideos([]);
      setFilteredVideos([]);
    } finally {
      setLoading(false);
    }
  }, [buildPerformanceData]);

  useEffect(() => {
    loadPerformanceData();
  }, [loadPerformanceData]);

  const applyFiltersForData = (
    data: PerformanceVideo[],
    category: string,
    subCategory: string
  ): PerformanceVideo[] => {
    let filtered = [...data];

    if (category !== "all") {
      filtered = filtered.filter((video) => video.category === category);
    }
    if (subCategory !== "all") {
      filtered = filtered.filter((video) => video.subCategory === subCategory);
    }
    return filtered;
  };

  const applyFilters = useCallback(() => {
    setFilteredVideos(applyFiltersForData(videos, selectedCategory, selectedSubCategory));
  }, [videos, selectedCategory, selectedSubCategory]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
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

  // AI 분석 함수
  const handleAnalyze = async (video: PerformanceVideo) => {
    if (analyzingVideoId === video.id) return;
    
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey || apiKey.trim() === '') {
      alert('먼저 AI 키를 설정해주세요.');
      setOpenApiKeyDialog(true);
      return;
    }
    
    setAnalyzingVideoId(video.id);
    
    try {
      const apiUrl = `${API_BASE_URL}/api/analyze/video`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          channelName: video.channelName,
          description: video.description || '',
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
        setOpenDialogVideoId(video.id);
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
    const video = filteredVideos.find(v => v.id === videoId);
    
    if (!insight || !video) {
      alert('복사할 분석 결과가 없습니다.');
      return;
    }

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
      showToast('📋 리포트가 클립보드에 복사되었습니다!', { type: 'success', duration: 2000 });
      setTimeout(() => {
        setCopiedVideoId(null);
      }, 2000);
    } catch (error) {
      console.error('복사 실패:', error);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const positiveVideos = filteredVideos.filter((video) => video.performanceRatio >= 1).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">평균 대비 고성과 동영상을 분석하는 중...</p>
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
                <BarChartBig className="w-8 h-8 text-amber-600" />
                <h1 className="text-2xl font-bold text-foreground">평균 대비 우수 성과 동영상</h1>
                <Badge className="bg-amber-600 text-white">
                  <Star className="w-3 h-3 mr-1" />
                  고성과
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate("/user-management")}>
                  <Users className="w-4 h-4 mr-2" />
                  회원관리
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                <Eye className="w-4 h-4 mr-2" />
                국내
              </Button>
              <Button variant="outline" onClick={() => navigate("/trend")}>
                <TrendingUp className="w-4 h-4 mr-2" />
                트렌드
              </Button>
              <Button variant="outline" onClick={() => navigate("/data")}>
                📊 데이터
              </Button>
              <Button variant="outline" onClick={() => navigate("/system")}>
                <Gauge className="w-4 h-4 mr-2" />
                시스템
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
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
              <span className="text-sm font-medium text-muted-foreground">날짜</span>
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
              <span className="text-sm font-medium text-muted-foreground">카테고리</span>
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
              <span className="text-sm font-medium text-muted-foreground">세부카테고리</span>
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
              <span className="text-sm font-medium text-muted-foreground">최소 성과 배율</span>
              <Select value={minimumRatio} onValueChange={setMinimumRatio}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="기준 선택" />
                </SelectTrigger>
                <SelectContent>
                  {RATIO_OPTIONS.map((option) => (
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
              <p className="text-sm text-muted-foreground mb-1">총 고성과 동영상</p>
              <p className="text-2xl font-semibold text-foreground">
                {filteredVideos.length.toLocaleString()}개
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-success/10">
              <p className="text-sm text-success mb-1 flex items-center space-x-1">
                <TrendingUp className="w-4 h-4" />
                <span>평균 대비 높은 영상</span>
              </p>
              <p className="text-2xl font-semibold text-success">
                {positiveVideos.toLocaleString()}개
              </p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-amber-100">
              <p className="text-sm text-amber-700 mb-1 flex items-center space-x-1">
                <Gauge className="w-4 h-4" />
                <span>평균 대비 최소 배율</span>
              </p>
              <p className="text-2xl font-semibold text-amber-700">
                {parseFloat(minimumRatio).toFixed(1)}x
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">평균 대비 우수 성과 동영상 목록</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedDate} 기준 상위 {filteredVideos.length}개 동영상
                {selectedCategory !== "all" && ` (${selectedCategory})`}
                {selectedSubCategory !== "all" && ` - ${selectedSubCategory}`}
              </p>
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>선택한 조건에 해당하는 동영상이 없습니다.</p>
              <p className="text-sm mt-1">필터를 조정하거나 데이터를 다시 수집해 주세요.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    <TableHead className="w-16 text-center">순위</TableHead>
                    <TableHead>동영상 정보</TableHead>
                    <TableHead className="text-right">현재 조회수</TableHead>
                    <TableHead className="text-right">채널 평균</TableHead>
                    <TableHead className="text-right">성과 배율</TableHead>
                    <TableHead className="text-right">게시일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVideos.map((video, index) => {
                    const isAnalyzing = analyzingVideoId === video.id;
                    const isAnalyzed = analyzedVideoIds.has(video.id);
                    const hasResult = analysisResults[video.id];
                    
                    return (
                      <TableRow key={video.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center font-semibold">{index + 1}</TableCell>
                        <TableCell>
                          <div className="space-y-3">
                            {/* 첫 번째 행: 동영상 정보 */}
                            <div className="flex items-center space-x-4">
                              <a
                                href={`https://www.youtube.com/watch?v=${video.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative hover:opacity-80 transition-opacity"
                              >
                                <div className="relative overflow-hidden rounded w-64 h-64 bg-muted">
                                  <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-full h-full object-cover object-center"
                                  />
                                </div>
                              </a>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center space-x-2">
                                  <a
                                    href={`https://www.youtube.com/watch?v=${video.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-blue-500 hover:text-blue-700 hover:underline line-clamp-2 text-sm leading-5 cursor-pointer flex-1 min-w-0"
                                    title={`${video.title} - 새 탭에서 열기`}
                                  >
                                    {video.title}
                                  </a>
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
                                        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 flex-shrink-0"
                                        : "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 flex-shrink-0"
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
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-muted-foreground">{video.channelName}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {video.category}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {video.subCategory || "미분류"}
                                  </Badge>
                                  <Badge className="bg-success text-white text-xs">
                                    <Star className="w-3 h-3 mr-1" />
                                    {(video.performanceRatio).toFixed(1)}x
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatViews(video.views)}회
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatViews(video.averageViews)}회
                        </TableCell>
                        <TableCell className="text-right text-success font-semibold">
                          {(video.performanceRatio).toFixed(2)}x
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {(video.uploadDate || video.collectionDate || "").split("T")[0] || "-"}
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
                      {filteredVideos.find(v => v.id === openDialogVideoId)?.title}
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

export default PerformanceVideosDetail;

