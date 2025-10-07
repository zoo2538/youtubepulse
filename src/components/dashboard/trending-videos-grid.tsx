import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories, categoryColors } from "@/lib/subcategories";

interface VideoData {
  id: string;
  thumbnail: string;
  title: string;
  channelName: string;
  views: number;
  timeAgo: string;
  category: string;
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

  // 분류된 데이터에서 트렌딩 비디오 데이터 생성
  const loadTrendingVideosData = async () => {
      try {
        // IndexedDB에서 분류된 데이터 로드
        const classifiedData = await indexedDBService.loadClassifiedData();
        
        console.log(`📊 트렌딩 비디오 - 전체 분류된 데이터: ${classifiedData.length}개`);
        console.log(`📊 트렌딩 비디오 - 데이터 날짜 분포:`, classifiedData.reduce((acc: any, item: any) => {
          const date = (item.collectionDate || item.uploadDate)?.split('T')[0];
          if (date) acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}));
        
        if (classifiedData && classifiedData.length > 0) {
          // 오늘 날짜 기준으로만 데이터 필터링하고 조회수 기준 정렬 (한국 시간 기준)
          const today = getKoreanDateString();
          const filteredData = classifiedData
            .filter((item: any) => 
              (item.collectionDate || item.uploadDate)?.split('T')[0] === today &&
              item.category && item.videoTitle
            )
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
              category: item.category || '기타'
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
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-foreground">조회수 급등 동영상</h3>
          <Badge className="bg-youtube text-white">
            <TrendingUp className="w-3 h-3 mr-1" />
            급상승
          </Badge>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videoData.slice(0, 10).map((video, index) => (
                    <TableRow key={video.id} className="hover:bg-surface-hover transition-colors">
                      <TableCell className="text-center font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-4 p-2">
                          <div className="relative">
                            <img 
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-16 h-12 object-cover rounded"
                            />
                          </div>
                          
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
                    </TableRow>
                  ))}
                  {videoData.length > 10 && videoData.slice(10).map((video, index) => (
                    <TableRow key={video.id} className="hover:bg-surface-hover transition-colors">
                      <TableCell className="text-center font-medium">
                        {index + 11}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-4 p-2">
                          <div className="relative">
                            <img 
                              src={video.thumbnail}
                              alt={video.title}
                              className="w-16 h-12 object-cover rounded"
                            />
                          </div>
                          
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}