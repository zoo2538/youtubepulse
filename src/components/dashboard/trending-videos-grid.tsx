import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, ArrowUpRight, Sparkles, CheckCircle2, Loader2, Key, Copy, Check, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories, categoryColors } from "@/lib/subcategories";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/lib/config";
import { showToast } from "@/lib/toast-util";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

interface VideoData {
  id: string;
  thumbnail: string;
  title: string;
  channelName: string;
  views: number;
  timeAgo: string;
  category: string;
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

// Mock 데이터 제거 - 실제 IndexedDB 데이터 사용

function formatViews(views: number): string {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toLocaleString();
}

export function TrendingVideosGrid() {
  const [videoData, setVideoData] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  // 하드코딩된 세부카테고리 사용
  const dynamicSubCategories = subCategories;
  const navigate = useNavigate();
  
  // AI 분석 관련 상태
  const [analyzingVideoId, setAnalyzingVideoId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AiAnalysisResult>>({});
  const [openDialogVideoId, setOpenDialogVideoId] = useState<string | null>(null);
  const [analyzedVideoIds, setAnalyzedVideoIds] = useState<Set<string>>(new Set());
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [openApiKeyDialog, setOpenApiKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);

  // 분류된 데이터에서 트렌딩 비디오 데이터 생성
  const loadTrendingVideosData = async () => {
      try {
        // IndexedDB에서 분류된 데이터와 미분류 데이터 모두 로드
        const classifiedData = await indexedDBService.loadClassifiedData();
        const unclassifiedData = await indexedDBService.loadUnclassifiedData();
        
        // 모든 데이터 합치기
        const allData = [...classifiedData, ...unclassifiedData];
        
        console.log(`📊 트렌딩 비디오 - 전체 분류된 데이터: ${classifiedData.length}개`);
        console.log(`📊 트렌딩 비디오 - 전체 미분류 데이터: ${unclassifiedData.length}개`);
        console.log(`📊 트렌딩 비디오 - 전체 데이터: ${allData.length}개`);
        console.log(`📊 트렌딩 비디오 - 데이터 날짜 분포:`, allData.reduce((acc: any, item: any) => {
          const date = (item.collectionDate || item.uploadDate || item.dayKeyLocal)?.split('T')[0];
          if (date) acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}));
        
        if (allData && allData.length > 0) {
          // 오늘 날짜 기준으로만 데이터 필터링하고 조회수 기준 정렬 (한국 시간 기준)
          const today = getKoreanDateString();
          const filteredData = allData
            .filter((item: any) => {
              const itemDate = item.collectionDate || item.uploadDate || item.dayKeyLocal;
              return itemDate && itemDate.split('T')[0] === today && item.videoTitle;
            })
            .sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0)) // 조회수 기준 내림차순
            .slice(0, 30); // 상위 30개만 표시

          console.log(`📊 트렌딩 비디오 - 오늘(${today}) 데이터: ${filteredData.length}개`);
          console.log(`📊 트렌딩 비디오 - 오늘(${today}) 데이터 샘플:`, filteredData.slice(0, 3));


          // 비디오 데이터 변환
          const videos: VideoData[] = filteredData.map((item: any) => {
            const uploadDate = new Date(item.uploadDate || item.collectionDate);
            const now = new Date();
            const diffHours = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60));
            
            let timeAgo = '';
            if (diffHours < 1) timeAgo = '방금 전';
            else if (diffHours < 24) timeAgo = `${diffHours}시간 전`;
            else {
              const diffDays = Math.floor(diffHours / 24);
              timeAgo = `${diffDays}일 전`;
            }

            const videoId = item.videoId || item.id;

            return {
              id: videoId,
              thumbnail: item.thumbnailUrl || `https://via.placeholder.com/320x180?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
              title: item.videoTitle || '제목 없음',
              channelName: item.channelName || '채널명 없음',
              views: item.viewCount || 0,
              timeAgo: timeAgo,
              category: item.category || '미분류',
              description: item.videoDescription || item.description || ''
            };
          });

          console.log(`📊 트렌딩 비디오 - 생성된 비디오 데이터: ${videos.length}개`);
          console.log(`📊 트렌딩 비디오 - 비디오 데이터 샘플:`, videos.slice(0, 3));
          setVideoData(videos);
        } else {
          // 데이터가 없는 경우 빈 배열
          setVideoData([]);
        }
      } catch (error) {
        console.error('트렌딩 비디오 데이터 로드 실패:', error);
        setVideoData([]);
      } finally {
        setLoading(false);
      }
    };

  // 데이터 업데이트 이벤트 리스너
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      console.log('🔄 트렌딩 비디오 데이터 업데이트 이벤트 감지:', event.detail);
      // 데이터 다시 로드 (오늘 날짜 기준)
      loadTrendingVideosData();
    };

    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate as EventListener);
    };
  }, []);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadTrendingVideosData();
  }, []);

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
  const handleAnalyze = async (video: VideoData) => {
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
    const video = videoData.find(v => v.id === videoId);
    
    if (!insight || !video) {
      showToast('복사할 분석 결과가 없습니다.', { type: 'warning' });
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
      showToast('❌ 클립보드 복사에 실패했습니다.', { type: 'error' });
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">데이터 로딩 중...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* API 키 설정 경고 배너 */}
        {!geminiApiKey && (
          <Card className="p-3 mb-4 border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">⚠️</span>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  AI 분석 기능을 사용하려면 API 키를 설정해주세요.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setApiKeyInput('');
                  setOpenApiKeyDialog(true);
                }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600"
              >
                <Key className="w-4 h-4 mr-2" />
                키 설정
              </Button>
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-foreground">조회수 급등 동영상</h3>
          <Badge className="bg-youtube text-white">
            <TrendingUp className="w-3 h-3 mr-1" />
            급상승
          </Badge>
          </div>
          <div className="flex items-center space-x-2">
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
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-1"
              onClick={() => navigate("/trending-channels")}
            >
              <span>조회수 급등 채널 보기</span>
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div>
          {videoData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>오늘 수집된 조회수 급등 동영상이 없습니다.</p>
              <p className="text-sm mt-1">데이터 수집을 먼저 진행해주세요.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-16 text-center">순위</TableHead>
                    <TableHead>동영상 정보</TableHead>
                    <TableHead className="text-center">AI 분석</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videoData.slice(0, 10).map((video, index) => {
                    const isAnalyzing = analyzingVideoId === video.id;
                    const isAnalyzed = analyzedVideoIds.has(video.id);
                    const hasResult = analysisResults[video.id];
                    
                    return (
                      <TableRow key={video.id} className="hover:bg-surface-hover transition-colors">
                        <TableCell className="text-center font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-4 p-2">
                            <a 
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative hover:opacity-80 transition-opacity"
                            >
                              <div className="relative overflow-hidden rounded w-32 h-32 bg-muted">
                                <img 
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-full h-full object-cover object-center"
                                  style={{ objectPosition: '50% 50%', clipPath: 'inset(0 10% 0 10%)' }}
                                />
                              </div>
                            </a>
                            
                            <div className="flex-1 min-w-0 space-y-2">
                              <a 
                                href={`https://www.youtube.com/watch?v=${video.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-500 hover:text-blue-700 hover:underline line-clamp-2 text-sm leading-5 cursor-pointer"
                                title={`${video.title} - 새 탭에서 열기`}
                              >
                                {video.title}
                              </a>
                              <p className="text-xs text-muted-foreground">
                                {video.channelName}
                              </p>
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant="secondary"
                                  className="text-xs bg-secondary text-secondary-foreground"
                                >
                                  {video.category}
                                </Badge>
                                <Badge className="bg-youtube text-white text-xs">
                                  <TrendingUp className="w-2 h-2 mr-1" />
                                  급등
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-sm font-medium text-foreground">
                                {formatViews(video.views)}회
                              </p>
                            </div>
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
                  {videoData.length > 10 && videoData.slice(10).map((video, index) => {
                    const isAnalyzing = analyzingVideoId === video.id;
                    const isAnalyzed = analyzedVideoIds.has(video.id);
                    const hasResult = analysisResults[video.id];
                    
                    return (
                      <TableRow key={video.id} className="hover:bg-surface-hover transition-colors">
                        <TableCell className="text-center font-medium">
                          {index + 11}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-4 p-2">
                            <a 
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative hover:opacity-80 transition-opacity"
                            >
                              <div className="relative overflow-hidden rounded w-32 h-32 bg-muted">
                                <img 
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-full h-full object-cover object-center"
                                  style={{ objectPosition: '50% 50%', clipPath: 'inset(0 10% 0 10%)' }}
                                />
                              </div>
                            </a>
                            
                            <div className="flex-1 min-w-0 space-y-2">
                              <a 
                                href={`https://www.youtube.com/watch?v=${video.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-500 hover:text-blue-700 hover:underline line-clamp-2 text-sm leading-5 cursor-pointer"
                                title={`${video.title} - 새 탭에서 열기`}
                              >
                                {video.title}
                              </a>
                              <p className="text-xs text-muted-foreground">
                                {video.channelName}
                              </p>
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  variant="secondary"
                                  className="text-xs bg-secondary text-secondary-foreground"
                                >
                                  {video.category}
                                </Badge>
                                <Badge className="bg-youtube text-white text-xs">
                                  <TrendingUp className="w-2 h-2 mr-1" />
                                  급등
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-sm font-medium text-foreground">
                                {formatViews(video.views)}회
                              </p>
                            </div>
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
        </div>
      </div>

      {/* AI 분석 결과 모달 */}
      {openDialogVideoId && analysisResults[openDialogVideoId] && (
        <Dialog open={!!openDialogVideoId} onOpenChange={(open) => !open && setOpenDialogVideoId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    ✨ AI 분석 결과
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400">
                    {videoData.find(v => v.id === openDialogVideoId)?.title}
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

              {/* 추가 필드들 */}
              {analysisResults[openDialogVideoId].intro_hook && (
                <Card className="p-4 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                  <h3 className="font-semibold text-green-700 mb-2">🎬 도입부 훅 (Intro Hook)</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {analysisResults[openDialogVideoId].intro_hook}
                  </p>
                </Card>
              )}

              {analysisResults[openDialogVideoId].plot_structure && (
                <Card className="p-4 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                  <h3 className="font-semibold text-orange-700 mb-2">📝 대본 구조 (Plot)</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {analysisResults[openDialogVideoId].plot_structure}
                  </p>
                </Card>
              )}

              {analysisResults[openDialogVideoId].target_audience && (
                <Card className="p-4 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                  <h3 className="font-semibold text-indigo-700 mb-2">🎯 타겟 시청층</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {analysisResults[openDialogVideoId].target_audience}
                  </p>
                </Card>
              )}

              {analysisResults[openDialogVideoId].emotional_trigger && (
                <Card className="p-4 border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50">
                  <h3 className="font-semibold text-pink-700 mb-2">💓 감정 트리거</h3>
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
                  <Progress 
                    value={analysisResults[openDialogVideoId].clickbait_score} 
                    className="h-3 bg-gray-200"
                  />
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
                      className="bg-gradient-to-r from-purple-500 to-blue-500 text-white"
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
    </Card>
  );
}