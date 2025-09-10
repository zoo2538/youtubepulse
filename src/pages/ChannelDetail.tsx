import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  TrendingUp, 
  TrendingDown, 
  ExternalLink, 
  Calendar,
  Settings,
  X
} from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { subCategories, categoryColors } from "@/lib/subcategories";

const ChannelDetail = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const [dynamicSubCategories, setDynamicSubCategories] = useState<Record<string, string[]>>(subCategories);
  const [channelData, setChannelData] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};


  useEffect(() => {
    const loadChannelData = async () => {
      try {
        const storedData = await indexedDBService.loadClassifiedData();
        if (storedData && channelId) {
          const data = storedData;
          
          // 해당 채널의 데이터만 필터링
          const channelVideos = data.filter((item: any) => item.channelId === channelId);
          
          if (channelVideos.length > 0) {
            const firstVideo = channelVideos[0];
            const totalViews = channelVideos.reduce((sum: number, video: any) => sum + (video.viewCount || 0), 0);
            const averageViews = Math.round(totalViews / channelVideos.length);
            
            // 수집일 기준 일별 조회수 데이터 생성
            const today = new Date();
            const dailyViews = [];
            
            // 최근 7일간의 수집일별 데이터 생성
            for (let i = 6; i >= 0; i--) {
              const date = new Date(today);
              date.setDate(today.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];
              
              // 해당 날짜에 수집된 영상들의 조회수 합계 계산
              const dailyViewCount = channelVideos
                .filter((video: any) => {
                  const videoDate = video.collectionDate || video.uploadDate;
                  if (!videoDate) return false;
                  const normalizedVideoDate = videoDate.split('T')[0];
                  return normalizedVideoDate === dateStr;
                })
                .reduce((sum: number, video: any) => sum + (video.viewCount || 0), 0);
              
              dailyViews.push({
                date: dateStr,
                daily_view_count: dailyViewCount
              });
            }
            
            // 채널 썸네일 찾기 (썸네일이 있는 첫 번째 영상에서 가져오기)
            const channelThumbnail = channelVideos.find((video: any) => 
              video.thumbnailUrl && !video.thumbnailUrl.includes('placeholder')
            )?.thumbnailUrl || 
            `https://via.placeholder.com/64x64?text=${firstVideo.channelName?.substring(0, 2) || 'CH'}`;

            setChannelData({
              channelId: firstVideo.channelId,
              channelName: firstVideo.channelName,
              description: firstVideo.description || "비어있음",
              category: firstVideo.category,
              subCategory: firstVideo.subCategory || "미분류",
              youtubeUrl: `https://www.youtube.com/channel/${firstVideo.channelId}`,
              thumbnail: channelThumbnail,
              totalViews,
              averageViews,
              videoCount: channelVideos.length,
              dailyUploads: 2.71,
              weeklyViews: totalViews,
              avgVideoLength: 50.97,
              shortsRatio: 100,
              dailyViews,
              lastModified: "6시간 전"
            });
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('채널 데이터 로드 실패:', error);
        setLoading(false);
      }
    };

    loadChannelData();
  }, [channelId]);


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">채널 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!channelData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-4">채널을 찾을 수 없습니다</h2>
          <Button onClick={() => window.history.back()}>뒤로 가기</Button>
        </Card>
      </div>
    );
  }

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

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 채널 정보 */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">채널 정보</h2>
                {channelData.category && (
                  <Link to={`/category/${encodeURIComponent(channelData.category)}`}>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-blue-600 border-blue-600 hover:bg-black hover:text-white hover:border-black"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {channelData.category} 카테고리로
                    </Button>
                  </Link>
                )}
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-sm font-medium text-foreground">Channel ID:</span>
                  <Badge 
                    variant="secondary"
                    className="text-white bg-blue-600"
                  >
                    {channelData.channelId}
                  </Badge>
                  <Button variant="ghost" size="sm" className="p-1 h-auto">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={channelData.thumbnail}
                      alt={channelData.channelName}
                      className="w-12 h-12 rounded"
                    />
                    <div>
                      <h3 className="font-medium text-foreground">{channelData.channelName}</h3>
                      <p className="text-sm text-muted-foreground">채널명</p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">채널설명:</h3>
                    <div className="bg-muted/50 p-3 rounded-lg max-h-32 overflow-y-auto">
                      <p className="text-sm text-muted-foreground">
                        {channelData.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">카테고리:</span>
                      <Link to={`/category/${encodeURIComponent(channelData.category)}`}>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-black hover:text-white hover:border-black transition-colors"
                        >
                          {channelData.category}
                        </Badge>
                      </Link>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">세부카테고리:</span>
                      <Badge variant="outline">{channelData.subCategory}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">유튜브URL:</span>
                      <a 
                        href={channelData.youtubeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center space-x-1"
                      >
                        <span>{channelData.youtubeUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 상세 정보 */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">상세 정보</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">일평균 업로드수:</span>
                  <span className="font-medium text-foreground">{channelData.dailyUploads}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {(() => {
                      const today = new Date();
                      const weekAgo = new Date(today);
                      weekAgo.setDate(today.getDate() - 7);
                      return `${weekAgo.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}-${today.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 총 조회수:`;
                    })()}
                  </span>
                  <span className="font-medium text-foreground">{channelData.weeklyViews.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">영상평균시간(초):</span>
                  <span className="font-medium text-foreground">{channelData.avgVideoLength}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">숏폼 비율(%):</span>
                  <span className="font-medium text-foreground">{channelData.shortsRatio}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* 채널 일별 조회수 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">채널 일별 조회수</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={channelData.dailyViews}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="daily_view_count" 
                stroke="#F97316"
                strokeWidth={3}
                dot={{ fill: "#F97316", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "#F97316", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default ChannelDetail;
