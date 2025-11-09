import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, TrendingUp, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories, categoryColors } from "@/lib/subcategories";
import { Button } from "@/components/ui/button";

interface PerformanceVideoData {
  id: string;
  thumbnail: string;
  title: string;
  channelName: string;
  views: number;
  averageViews: number;
  performanceRatio: number;
  category: string;
  duration: string;
}

// Mock 데이터 제거 - 실제 IndexedDB 데이터 사용
const mockPerformanceVideos: PerformanceVideoData[] = [
  {
    id: "1",
    thumbnail: "/placeholder-120x68.png",
    title: "이 영상이 평균보다 300% 높은 조회수를 기록한 비밀",
    channelName: "성공크리에이터", 
    views: 1800000,
    averageViews: 450000,
    performanceRatio: 4.0,
    category: "기타",
    duration: "15:32"
  },
  {
    id: "2",
    thumbnail: "/placeholder-120x68.png",
    title: "숏폼으로 대박 난 이유가 이것 때문이었다",
    channelName: "숏폼마스터",
    views: 950000,
    averageViews: 380000,
    performanceRatio: 2.5,
    category: "롱폼",
    duration: "0:58"
  },
  {
    id: "3", 
    thumbnail: "/placeholder-120x68.png",
    title: "게임 실황이 이렇게 인기 있을 줄 몰랐다",
    channelName: "게임스트리머",
    views: 1200000,
    averageViews: 600000,
    performanceRatio: 2.0,
    category: "게임",
    duration: "1:25:10"
  },
  {
    id: "4",
    thumbnail: "/placeholder-120x68.png",
    title: "AI가 만든 영상이 화제가 되는 이유",
    channelName: "AI크리에이터",
    views: 750000,
    averageViews: 300000,
    performanceRatio: 2.5,
    category: "AI",
    duration: "8:45"
  },
  {
    id: "5",
    thumbnail: "/placeholder-120x68.png",
    title: "요리 레시피로 이렇게 많은 조회수가?",
    channelName: "쿠킹스타",
    views: 1100000,
    averageViews: 400000,
    performanceRatio: 2.8,
    category: "라이프스타일",
    duration: "12:15"
  },
  {
    id: "6",
    thumbnail: "/placeholder-120x68.png",
    title: "스포츠 하이라이트가 이렇게 인기있다니",
    channelName: "스포츠매니아",
    views: 890000,
    averageViews: 350000,
    performanceRatio: 2.5,
    category: "스포츠",
    duration: "18:42"
  },
  {
    id: "7",
    thumbnail: "/placeholder-120x68.png",
    title: "뷰티 튜토리얼이 바이럴 된 진짜 이유",
    channelName: "뷰티마스터",
    views: 670000,
    averageViews: 250000,
    performanceRatio: 2.7,
    category: "라이프스타일",
    duration: "9:33"
  },
  {
    id: "8",
    thumbnail: "/placeholder-120x68.png",
    title: "펫 영상이 이렇게 감동적일 수가",
    channelName: "펫러버",
    views: 1050000,
    averageViews: 420000,
    performanceRatio: 2.5,
    category: "라이프스타일",
    duration: "7:21"
  },
  {
    id: "9",
    thumbnail: "/placeholder-120x68.png",
    title: "여행 브이로그가 대박 난 이유",
    channelName: "세계여행자",
    views: 820000,
    averageViews: 320000,
    performanceRatio: 2.6,
    category: "여행",
    duration: "22:18"
  },
];

function formatViews(views: number): string {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toLocaleString();
}

function getPerformanceBadge(ratio: number) {
  if (ratio >= 3) return { label: "대박", color: "bg-youtube text-white" };
  if (ratio >= 2) return { label: "우수", color: "bg-success text-white" };
  return { label: "양호", color: "bg-info text-white" };
}

export function PerformanceVideosList() {
  const [performanceData, setPerformanceData] = useState<PerformanceVideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString());
  // 하드코딩된 세부카테고리 사용
  const dynamicSubCategories = subCategories;
  const navigate = useNavigate();

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

  // 데이터 업데이트 이벤트 리스너
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      console.log('🔄 성과 우수 비디오 데이터 업데이트 이벤트 감지:', event.detail);
      // 데이터 다시 로드
      window.dispatchEvent(new CustomEvent('dashboardDateChanged', { 
        detail: { selectedDate: selectedDate } 
      }));
    };

    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate as EventListener);
    };
  }, [selectedDate]);

  // 분류된 데이터에서 성과 우수 비디오 데이터 생성
  useEffect(() => {
    const loadPerformanceVideosData = async () => {
      try {
        // IndexedDB에서 분류된 데이터 로드
        const classifiedData = await indexedDBService.loadClassifiedData();
        
        console.log(`📊 성과 우수 비디오 - 전체 분류된 데이터: ${classifiedData.length}개`);
        console.log(`📊 성과 우수 비디오 - 데이터 날짜 분포:`, classifiedData.reduce((acc: any, item: any) => {
          const date = (item.collectionDate || item.uploadDate)?.split('T')[0];
          if (date) acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}));
        
        if (classifiedData && classifiedData.length > 0) {
          // 선택된 날짜 또는 오늘 데이터 필터링 (한국 시간 기준)
          const targetDate = selectedDate || getKoreanDateString();
          const filteredData = classifiedData.filter((item: any) => 
            (item.collectionDate || item.uploadDate)?.split('T')[0] === targetDate &&
            item.category && item.videoTitle
          );

          console.log(`📊 성과 우수 비디오 - ${targetDate} 날짜 데이터: ${filteredData.length}개`);
          console.log(`📊 성과 우수 비디오 - ${targetDate} 날짜 데이터 샘플:`, filteredData.slice(0, 3));

          // 채널별 평균 조회수 계산
          const channelAverages: any = {};
          classifiedData.forEach((item: any) => {
            if (!item.channelId || !item.viewCount) return;
            
            if (!channelAverages[item.channelId]) {
              channelAverages[item.channelId] = {
                totalViews: 0,
                count: 0,
                channelName: item.channelName
              };
            }
            channelAverages[item.channelId].totalViews += item.viewCount;
            channelAverages[item.channelId].count += 1;
          });

          // 성과 비율 계산 및 정렬
          const performanceVideos = filteredData
            .map((item: any) => {
              const channelAvg = channelAverages[item.channelId];
              const averageViews = channelAvg ? Math.round(channelAvg.totalViews / channelAvg.count) : item.viewCount;
              const performanceRatio = averageViews > 0 ? item.viewCount / averageViews : 1;

              return {
                id: item.videoId || item.id,
                thumbnail: item.thumbnailUrl || `https://via.placeholder.com/120x68?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
                title: item.videoTitle || '제목 없음',
                channelName: item.channelName || '채널명 없음',
                views: item.viewCount || 0,
                averageViews: averageViews,
                performanceRatio: performanceRatio,
                category: item.category || '기타',
                duration: '0:00' // 실제 데이터에는 duration이 없으므로 기본값
              };
            })
            .filter(video => video.performanceRatio >= 1.5) // 평균 대비 1.5배 이상인 영상만
            .sort((a, b) => b.performanceRatio - a.performanceRatio) // 성과 비율 기준 내림차순
            .slice(0, 30); // 상위 30개만 표시

          console.log(`📊 성과 우수 비디오 - 생성된 성과 비디오 데이터: ${performanceVideos.length}개`);
          console.log(`📊 성과 우수 비디오 - 성과 비디오 데이터 샘플:`, performanceVideos.slice(0, 3));
          setPerformanceData(performanceVideos);
        } else {
          // 데이터가 없는 경우 mock 데이터 사용
          setPerformanceData(mockPerformanceVideos.slice(0, 30));
        }
      } catch (error) {
        console.error('성과 우수 비디오 데이터 로드 실패:', error);
        setPerformanceData(mockPerformanceVideos.slice(0, 30));
      } finally {
        setLoading(false);
      }
    };

    loadPerformanceVideosData();
  }, [selectedDate]);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-foreground">평균 대비 우수 성과 동영상</h3>
            <Badge className="bg-success text-white">
              <Star className="w-3 h-3 mr-1" />
              고성과
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center space-x-1"
            onClick={() => navigate("/performance-videos")}
          >
            <span>상세 페이지 이동</span>
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div>
          <div className="max-h-[600px] overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-16 text-center">순위</TableHead>
                  <TableHead>동영상 정보</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceData.slice(0, 10).map((video, index) => (
                  <TableRow key={video.id} className="hover:bg-surface-hover transition-colors">
                    <TableCell className="text-center font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-4">
                        <a 
                          href={`https://www.youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative hover:opacity-80 transition-opacity"
                        >
                          <div className="relative overflow-hidden rounded">
                            <img 
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-64 h-64 object-cover object-center"
                              style={{ objectPosition: '50% 50%', clipPath: 'inset(0 10% 0 10%)' }}
                            />
                          </div>
                        </a>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-muted-foreground">{video.channelName}</span>
                            <Badge 
                              variant="secondary"
                              className="text-xs bg-secondary text-secondary-foreground"
                            >
                              {video.category}
                            </Badge>
                            <Badge className={getPerformanceBadge(video.performanceRatio).color}>
                              {getPerformanceBadge(video.performanceRatio).label}
                            </Badge>
                          </div>
                          <a 
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-500 hover:text-blue-700 hover:underline line-clamp-2 text-sm leading-5 cursor-pointer block"
                            title={`${video.title} - 새 탭에서 열기`}
                          >
                            {video.title}
                          </a>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              현재: {formatViews(video.views)}회
                            </p>
                            <p className="text-sm text-muted-foreground">
                              평균: {formatViews(video.averageViews)}회
                            </p>
                            <div className="flex items-center space-x-1 text-success">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                {video.performanceRatio.toFixed(1)}x
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {performanceData.length > 10 && performanceData.slice(10).map((video, index) => (
                  <TableRow key={video.id} className="hover:bg-surface-hover transition-colors">
                    <TableCell className="text-center font-medium">
                      {index + 11}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-4">
                        <a 
                          href={`https://www.youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative hover:opacity-80 transition-opacity"
                        >
                          <div className="relative overflow-hidden rounded">
                            <img 
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-64 h-64 object-cover object-center"
                              style={{ objectPosition: '50% 50%', clipPath: 'inset(0 10% 0 10%)' }}
                            />
                          </div>
                        </a>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-muted-foreground">{video.channelName}</span>
                            <Badge 
                              variant="secondary"
                              className="text-xs bg-secondary text-secondary-foreground"
                            >
                              {video.category}
                            </Badge>
                            <Badge className={getPerformanceBadge(video.performanceRatio).color}>
                              {getPerformanceBadge(video.performanceRatio).label}
                            </Badge>
                          </div>
                          <a 
                            href={`https://www.youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-500 hover:text-blue-700 hover:underline line-clamp-2 text-sm leading-5 cursor-pointer block"
                            title={`${video.title} - 새 탭에서 열기`}
                          >
                            {video.title}
                          </a>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              현재: {formatViews(video.views)}회
                            </p>
                            <p className="text-sm text-muted-foreground">
                              평균: {formatViews(video.averageViews)}회
                            </p>
                            <div className="flex items-center space-x-1 text-success">
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                {video.performanceRatio.toFixed(1)}x
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Card>
  );
}