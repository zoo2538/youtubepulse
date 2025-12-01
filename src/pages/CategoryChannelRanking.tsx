import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ExternalLink, Settings, Filter, TrendingUp, Sparkles, CheckCircle2, Loader2, Key, Copy, Check, Eye } from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { subCategories, categoryColors } from "@/lib/subcategories";
import { API_BASE_URL } from "@/lib/config";
import { showToast } from "@/lib/toast-util";

interface ChannelRankingData {
  rank: number;
  thumbnail: string;
  channelName: string;
  todayViews: number;
  category: string;
  subCategory: string;
  channelId: string;
  topVideoUrl: string;
  topVideoTitle: string;
  description: string;
  videoId: string;
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

const CategoryChannelRanking = () => {
  const { category } = useParams<{ category: string }>();
  const [dynamicSubCategories, setDynamicSubCategories] = useState<Record<string, string[]>>(subCategories);
  const [channels, setChannels] = useState<ChannelRankingData[]>([]);
  const [channelData, setChannelData] = useState<ChannelRankingData[]>([]);
  const [filteredChannelData, setFilteredChannelData] = useState<ChannelRankingData[]>([]);
  const [classifiedData, setClassifiedData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');

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

  // 동적 카테고리 로드
  useEffect(() => {
    const loadDynamicCategories = async () => {
      try {
        const savedCategories = await indexedDBService.loadCategories();
        if (savedCategories && Object.keys(savedCategories).length > 0) {
          setDynamicSubCategories(savedCategories);
        }
      } catch (error) {
        console.error('카테고리 로드 실패:', error);
      }
    };

    loadDynamicCategories();

    // 카테고리 업데이트 이벤트 리스너
    const handleCategoriesUpdate = () => {
      loadDynamicCategories();
    };

    window.addEventListener('categoriesUpdated', handleCategoriesUpdate);
    return () => {
      window.removeEventListener('categoriesUpdated', handleCategoriesUpdate);
    };
  }, []);

  const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// categoryColors는 subcategories.ts에서 import

  // 분류된 데이터 로드 (IndexedDB 우선 로딩)
  useEffect(() => {
    const loadClassifiedData = async () => {
      // 강제 타임아웃: 15초 후 무조건 로딩 해제
      const forceTimeout = setTimeout(() => {
        console.warn('⏰ 카테고리 채널 순위 데이터 로드 강제 타임아웃 (15초)');
        setIsLoading(false);
      }, 15000);
      
      try {
        setIsLoading(true);
        
        // IndexedDB 우선 로드 (빠른 응답)
        const data = await indexedDBService.loadClassifiedData();
        console.log(`📊 카테고리 채널 순위 - IndexedDB에서 로드: ${data.length}개`);
        
        // 백그라운드에서 서버 동기화 (비동기, UI 블로킹 없음) - 타임아웃 적용
        setTimeout(async () => {
          try {
            // 타임아웃 보호: Promise.race로 타임아웃 적용
            const timeoutPromise = new Promise<any[]>((_, reject) => {
              setTimeout(() => {
                console.warn('⏱️ 백그라운드 서버 동기화 타임아웃 (10초)');
                reject(new Error('백그라운드 동기화 타임아웃'));
              }, 10000);
            });
            
            const serverData = await Promise.race([
              hybridService.getClassifiedData(),
              timeoutPromise
            ]) as any[];
            
            if (serverData && serverData.length > data.length) {
              console.log(`🔄 백그라운드 동기화: 서버 데이터 ${serverData.length}개 > 로컬 ${data.length}개`);
              // 서버에 더 많은 데이터가 있으면 업데이트
              setClassifiedData(serverData);
              // 채널 데이터도 다시 계산
              if (category) {
                const filteredData = serverData.filter((item: any) => item.category === category);
                // 채널 순위 재계산 로직...
              }
            }
          } catch (error) {
            console.warn('⚠️ 백그라운드 동기화 실패 (무시):', error);
          }
        }, 1000); // 1초 후 백그라운드 동기화
        
        console.log(`📊 카테고리 채널 순위 - 전체 분류된 데이터: ${data.length}개`);
        console.log(`📊 카테고리 채널 순위 - 데이터 날짜 분포:`, data.reduce((acc: any, item: any) => {
          const date = (item.collectionDate || item.uploadDate)?.split('T')[0];
          if (date) acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}));
        
        if (data && category) {
          setClassifiedData(data);
          console.log(`📊 전체 분류된 데이터: ${data.length}개`);
          
          // 해당 카테고리의 데이터만 필터링
          const filteredData = data.filter((item: any) => item.category === category);
          console.log(`📊 카테고리 동영상 순위 - ${category} 카테고리 데이터: ${filteredData.length}개`);
          
          // 카테고리별 데이터 개수 확인
          const categoryCounts: any = {};
          data.forEach((item: any) => {
            if (item.category) {
              categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
            }
          });
          console.log(`📊 카테고리별 데이터 개수:`, categoryCounts);
          
          // 가장 최근 수집 날짜 찾기
          let latestDate: Date | null = null;
          filteredData.forEach((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            if (!itemDate) return;
            
            const currentDate = new Date(itemDate);
            if (!latestDate || currentDate > latestDate) {
              latestDate = currentDate;
            }
          });
          
          if (!latestDate) {
            console.log('📅 수집된 데이터가 없습니다.');
            setChannelData([]);
            setFilteredChannelData([]);
            return;
          }
          
          const latestDateString = latestDate.toISOString().split('T')[0];
          console.log(`📅 가장 최근 수집 날짜: ${latestDateString}`);
          
          // 가장 최근 날짜의 모든 데이터 표시 (조회수 최대값 선택 안 함)
          const latestData = filteredData.filter((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            if (!itemDate) return false;
            
            const itemDateString = itemDate.split('T')[0];
            return itemDateString === latestDateString;
          });
          
          console.log(`📊 가장 최근 날짜(${latestDateString}) 데이터: ${filteredData.length}개 → ${latestData.length}개`);
          
          // 같은 영상(videoId) 중에서 조회수가 가장 높은 것만 선택
          const videoGroups: any = {};
          latestData.forEach((item: any) => {
            const videoId = item.videoId || item.id;
            if (!videoId) return;
            
            // 해당 영상의 첫 번째 데이터이거나, 현재 데이터의 조회수가 더 높으면 업데이트
            if (!videoGroups[videoId] || 
                (item.viewCount || 0) > (videoGroups[videoId].viewCount || 0)) {
              videoGroups[videoId] = item;
            }
          });
          
          console.log(`📊 중복 제거 완료: ${latestData.length}개 → ${Object.keys(videoGroups).length}개`);

          // 중복 제거된 영상들을 배열로 변환하고 조회수 순으로 정렬
          const channelArray = Object.values(videoGroups)
            .map((item: any, index: number) => {
              const videoId = item.videoId || item.id;

              return {
                rank: index + 1,
                thumbnail: item.thumbnailUrl || `https://via.placeholder.com/128x128?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
                videoTitle: item.videoTitle || '제목 없음',
                channelName: item.channelName || '채널명 없음',
                todayViews: item.viewCount || 0,
                category: item.category,
                subCategory: item.subCategory || '미분류',
                channelId: item.channelId,
                videoId: videoId,
                topVideoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
                topVideoTitle: item.videoTitle || '',
                description: item.description || item.videoDescription || ''
              };
            })
            .sort((a, b) => b.todayViews - a.todayViews)
            .map((item, index) => ({ ...item, rank: index + 1 }));
          
          console.log(`📊 카테고리 채널 순위 - 생성된 채널 데이터: ${channelArray.length}개`);
          console.log(`📊 카테고리 채널 순위 - 채널 데이터 샘플:`, channelArray.slice(0, 3));
          setChannelData(channelArray);
          setFilteredChannelData(channelArray);
        }
      } catch (error) {
        console.error('분류된 데이터 로드 실패:', error);
      } finally {
        clearTimeout(forceTimeout);
        setIsLoading(false);
      }
    };

    loadClassifiedData();
  }, [category]);

  // 세부카테고리 필터링 함수
  const applySubCategoryFilter = useCallback(() => {
    console.log(`🔍 세부카테고리 필터링 - 선택된 세부카테고리: "${selectedSubCategory}"`);
    console.log(`🔍 세부카테고리 필터링 - 전체 채널 데이터: ${channelData.length}개`);
    
    if (selectedSubCategory === 'all') {
      console.log(`🔍 세부카테고리 필터링 - 전체 선택, 모든 데이터 표시`);
      setFilteredChannelData(channelData);
    } else {
      const filtered = channelData.filter(video => video.subCategory === selectedSubCategory);
      console.log(`🔍 세부카테고리 필터링 - "${selectedSubCategory}" 필터링 결과: ${filtered.length}개`);
      setFilteredChannelData(filtered);
    }
  }, [selectedSubCategory, channelData]); // 의존성 배열: 사용하는 상태들

  // 세부카테고리 변경 시 필터 적용
  useEffect(() => {
    applySubCategoryFilter();
  }, [selectedSubCategory, channelData, applySubCategoryFilter]);

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
  const handleAnalyze = async (video: ChannelRankingData) => {
    if (analyzingVideoId === video.videoId) return;
    
    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey || apiKey.trim() === '') {
      alert('먼저 AI 키를 설정해주세요.');
      setOpenApiKeyDialog(true);
      return;
    }
    
    setAnalyzingVideoId(video.videoId);
    
    try {
      const apiUrl = `${API_BASE_URL}/api/analyze/video`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.videoId,
          title: video.topVideoTitle || '제목 없음',
          channelName: video.channelName,
          description: video.description || '',
          viewCount: video.todayViews,
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
          [video.videoId]: result.data,
        }));
        setAnalyzedVideoIds(prev => new Set([...prev, video.videoId]));
        setOpenDialogVideoId(video.videoId);
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
    const video = filteredChannelData.find(v => v.videoId === videoId);
    
    if (!insight || !video) {
      alert('복사할 분석 결과가 없습니다.');
      return;
    }

    const reportText = `[AI 분석 리포트: ${video.topVideoTitle || '제목 없음'}]

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

      <div className="container mx-auto px-4 py-6 space-y-6">
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

        {/* 카테고리 헤더 */}
        <div className="flex items-center justify-between">
          <div>
        <h1 
          className="text-2xl font-bold"
          style={{ color: categoryColors[category as keyof typeof categoryColors] }}
        >
          {category} 조회수 급등 동영상
        </h1>
        <div className="text-muted-foreground">
          <Badge 
            variant="secondary" 
            className="text-white"
            style={{ 
              backgroundColor: categoryColors[category as keyof typeof categoryColors],
              borderColor: categoryColors[category as keyof typeof categoryColors]
            }}
          >
            {category}
          </Badge> 카테고리 조회수 급등 동영상 순위
        </div>
          </div>
          
        </div>

        {/* 카테고리 필터 버튼들 */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              카테고리 선택
            </label>
            <div className="grid grid-cols-9 gap-2">
              {Object.keys(subCategories).map((cat) => (
                <Link key={cat} to={`/category/${encodeURIComponent(cat)}`}>
                  <Badge
                    variant={category === cat ? "default" : "outline"}
                    className={`cursor-pointer transition-all duration-200 w-full text-center text-sm py-2 ${
                      category === cat 
                        ? "text-white shadow-lg" 
                        : "border-border text-muted-foreground"
                    }`}
                    style={{
                      backgroundColor: category === cat 
                        ? categoryColors[cat as keyof typeof categoryColors] 
                        : undefined,
                      borderColor: category === cat 
                        ? categoryColors[cat as keyof typeof categoryColors] 
                        : undefined
                    }}
                  >
                    {cat}
                  </Badge>
                </Link>
              ))}
            </div>
            
            {/* 카테고리 설명 */}
            <p className="text-xs text-muted-foreground mt-2">
              💡 카테고리를 클릭하면 해당 카테고리의 채널 순위를 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 필터 섹션 */}
        {channelData.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <label className="text-sm font-medium text-foreground">
                  필터 설정
                </label>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-muted-foreground">세부카테고리:</label>
                  <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="세부카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {dynamicSubCategories[category]?.map(subCategory => (
                        <SelectItem key={subCategory} value={subCategory}>
                          {subCategory}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {filteredChannelData.length}개 표시 (전체 {channelData.length}개 중) • 가장 최근 수집 데이터만 표시
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 채널 순위 테이블 */}
        <Card className="p-6">
          
          
          {filteredChannelData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <div className="text-lg font-medium">📊 데이터가 없습니다</div>
                <div className="text-sm mt-2">
                  {channelData.length === 0 
                    ? `${category} 카테고리의 데이터가 없습니다.`
                    : `선택한 세부카테고리 "${selectedSubCategory}"에 해당하는 데이터가 없습니다.`
                  }
                </div>
                <div className="text-xs mt-1">
                  {channelData.length === 0 
                    ? "다른 카테고리를 선택해보세요."
                    : "다른 세부카테고리를 선택해보세요."
                  }
                </div>
              </div>
              <Button asChild>
                <Link to="/dashboard">대시보드로 돌아가기</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-center font-semibold">순위</TableHead>
                    <TableHead className="font-semibold">썸네일</TableHead>
                    <TableHead className="font-semibold">제목</TableHead>
                    <TableHead className="font-semibold">채널명</TableHead>
                    <TableHead className="text-right font-semibold">조회수</TableHead>
                    <TableHead className="font-semibold">세부카테고리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredChannelData.map((video) => (
                  <TableRow key={video.videoId} className="hover:bg-surface-hover transition-colors">
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <span className={`text-lg font-bold ${
                          video.rank <= 3 ? 'text-youtube' : 'text-foreground'
                        }`}>
                          {video.rank}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="relative overflow-hidden rounded">
                        <img 
                          src={video.thumbnail}
                          alt={video.videoTitle}
                          className="w-64 h-64 object-cover object-center"
                          style={{ objectPosition: '50% 50%', clipPath: 'inset(0 10% 0 10%)' }}
                        />
                      </div>
                    </TableCell>
                    
                    <TableCell className="max-w-80">
                      {video.topVideoUrl && video.topVideoTitle ? (
                        <div className="space-y-3">
                          {/* 첫 번째 행: 제목과 설명 */}
                          <div className="space-y-1">
                            <a 
                              href={video.topVideoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 text-sm font-medium hover:underline cursor-pointer block"
                              title={`${video.topVideoTitle} - 새 탭에서 열기`}
                            >
                              <div className="truncate">
                                {video.topVideoTitle}
                              </div>
                            </a>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {video.description || '영상 설명 정보 없음'}
                            </div>
                          </div>
                          {/* 두 번째 행: AI 분석 */}
                          <div className="flex items-center justify-start pt-2 border-t">
                            {(() => {
                              const isAnalyzing = analyzingVideoId === video.videoId;
                              const isAnalyzed = analyzedVideoIds.has(video.videoId);
                              const hasResult = analysisResults[video.videoId];
                              
                              return (
                                <Button
                                  size="sm"
                                  variant={isAnalyzed ? "outline" : "default"}
                                  onClick={() => {
                                    if (hasResult) {
                                      setOpenDialogVideoId(video.videoId);
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
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">영상 정보 없음</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Link 
                        to={`/channel/${video.channelId}`}
                        className="text-blue-500 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {video.channelName}
                      </Link>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <span className="font-semibold text-foreground">
                        {formatNumber(video.todayViews)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {video.todayViews.toLocaleString()}회
                      </p>
                    </TableCell>
                    
                    
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className="border-border text-muted-foreground"
                      >
                        {video.subCategory}
                      </Badge>
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
                      {filteredChannelData.find(v => v.videoId === openDialogVideoId)?.topVideoTitle || '제목 없음'}
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

export default CategoryChannelRanking;