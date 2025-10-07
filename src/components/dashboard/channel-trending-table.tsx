import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { subCategories, categoryColors } from "@/lib/subcategories";

interface ChannelData {
  id: string;
  thumbnail: string;
  channelName: string;
  category: string;
  subCategory: string;
  todayViews: number;
  yesterdayViews: number;
  changeAmount: number;
  changePercent: number;
  topVideoUrl: string;
  topVideoTitle: string;
}

// Mock 데이터 제거 - 실제 IndexedDB 데이터 사용

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function ChannelTrendingTable() {
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  // 하드코딩된 세부카테고리 사용
  const dynamicSubCategories = subCategories;

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
      console.log('🔄 채널 트렌딩 데이터 업데이트 이벤트 감지:', event.detail);
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

  // 분류된 데이터에서 채널 트렌딩 데이터 생성
  useEffect(() => {
    const loadChannelTrendingData = async () => {
      try {
        // IndexedDB에서 분류된 데이터 로드
        const classifiedData = await indexedDBService.loadClassifiedData();
        
        console.log(`📊 채널 트렌딩 - 전체 분류된 데이터: ${classifiedData.length}개`);
        console.log(`📊 채널 트렌딩 - 데이터 날짜 분포:`, classifiedData.reduce((acc: any, item: any) => {
          const date = (item.collectionDate || item.uploadDate)?.split('T')[0];
          if (date) acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}));
        
        if (classifiedData && classifiedData.length > 0) {
          // 선택된 날짜의 수집일 기준 데이터 필터링
          const targetDate = selectedDate || new Date().toISOString().split('T')[0];
          const filteredData = classifiedData.filter((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            return itemDate && itemDate.split('T')[0] === targetDate;
          });
          console.log(`📊 채널 트렌딩 - ${targetDate} 날짜 데이터: ${filteredData.length}개`);
          console.log(`📊 채널 트렌딩 - ${targetDate} 날짜 데이터 샘플:`, filteredData.slice(0, 3));

          // 채널별로 그룹화하여 조회수 합계 계산
          const channelGroups: any = {};
          filteredData.forEach((item: any) => {
            if (!item.channelId || !item.category) return;
            
            if (!channelGroups[item.channelId]) {
              channelGroups[item.channelId] = {
                channelId: item.channelId,
                channelName: item.channelName,
                category: item.category,
                subCategory: item.subCategory || '',
                thumbnail: item.thumbnailUrl || `https://via.placeholder.com/40x40?text=${item.channelName?.substring(0, 2) || 'CH'}`,
                todayViews: 0,
                yesterdayViews: 0,
                videos: []
              };
            }
            channelGroups[item.channelId].todayViews += item.viewCount || 0;
            channelGroups[item.channelId].videos.push(item);
          });

          // 어제 데이터와 비교하여 변화율 계산
          const yesterdayStr = new Date(new Date(targetDate).getTime() - 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
          const yesterdayData = classifiedData.filter((item: any) => 
            (item.collectionDate || item.uploadDate)?.split('T')[0] === yesterdayStr
          );

          const yesterdayChannelGroups: any = {};
          yesterdayData.forEach((item: any) => {
            if (!item.channelId) return;
            if (!yesterdayChannelGroups[item.channelId]) {
              yesterdayChannelGroups[item.channelId] = { totalViews: 0 };
            }
            yesterdayChannelGroups[item.channelId].totalViews += item.viewCount || 0;
          });

          // 채널 데이터 변환
          const channels: ChannelData[] = Object.values(channelGroups)
            .map((channel: any, index: number) => {
              const yesterdayViews = yesterdayChannelGroups[channel.channelId]?.totalViews || 0;
              const changeAmount = channel.todayViews - yesterdayViews;
              const changePercent = yesterdayViews > 0 ? (changeAmount / yesterdayViews) * 100 : 0;

              // 마지막에 올린 영상 찾기 (업로드 날짜 기준)
              const latestVideo = channel.videos.sort((a: any, b: any) => {
                const dateA = new Date(a.uploadDate || a.collectionDate || 0);
                const dateB = new Date(b.uploadDate || b.collectionDate || 0);
                return dateB.getTime() - dateA.getTime();
              })[0];
              
              // 실제 썸네일이 있는 영상 찾기
              const thumbnailVideo = channel.videos.find((video: any) => 
                video.thumbnailUrl && !video.thumbnailUrl.includes('placeholder')
              );
              
              return {
                id: channel.channelId,
                thumbnail: thumbnailVideo?.thumbnailUrl || 
                  `https://via.placeholder.com/48x48?text=${channel.channelName.charAt(0)}`,
                channelName: channel.channelName,
                category: channel.category,
                subCategory: channel.subCategory,
                todayViews: channel.todayViews,
                yesterdayViews: yesterdayViews,
                changeAmount: changeAmount,
                changePercent: changePercent,
                topVideoUrl: latestVideo?.videoId ? `https://www.youtube.com/watch?v=${latestVideo.videoId}` : '',
                topVideoTitle: latestVideo?.videoTitle || latestVideo?.title || ''
              };
            })
            .sort((a, b) => b.todayViews - a.todayViews) // 조회수 기준 내림차순 정렬
            .slice(0, 30); // 상위 30개만 표시

          console.log(`📊 채널 트렌딩 - 생성된 채널 데이터: ${channels.length}개`);
          console.log(`📊 채널 트렌딩 - 채널 데이터 샘플:`, channels.slice(0, 3));
          setChannelData(channels);
        } else {
          // 데이터가 없는 경우 빈 배열 설정
          setChannelData([]);
        }
      } catch (error) {
        console.error('채널 트렌딩 데이터 로드 실패:', error);
        setChannelData([]);
      } finally {
        setLoading(false);
      }
    };

    loadChannelTrendingData();
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
        <h3 className="text-lg font-semibold text-foreground">[카테고리] 신규 조회수 급등 채널</h3>
        
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">순위</TableHead>
                <TableHead className="w-16">썸네일</TableHead>
                <TableHead>채널명</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>세부카테고리</TableHead>
                <TableHead className="text-right">당일</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="text-right">증감</TableHead>
                <TableHead className="text-right">증감률(%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelData.map((channel, index) => (
                <TableRow key={channel.id} className="hover:bg-surface-hover transition-colors">
                  <TableCell className="text-center font-medium">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <img 
                      src={channel.thumbnail}
                      alt={channel.channelName}
                      className="w-10 h-10"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link 
                      to={`/channel/${channel.id}`}
                      className="text-blue-500 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      {channel.channelName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className="text-xs bg-secondary text-secondary-foreground"
                    >
                      {channel.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className="text-xs border-muted-foreground text-muted-foreground"
                    >
                      {channel.subCategory}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(channel.todayViews)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNumber(channel.yesterdayViews)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {channel.changeAmount > 0 ? '+' : ''}{formatNumber(channel.changeAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={cn(
                      "flex items-center justify-end space-x-1",
                      channel.changePercent > 0 ? "text-success" : "text-danger"
                    )}>
                      {channel.changePercent > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {channel.changePercent > 0 ? '+' : ''}{Math.floor(channel.changePercent)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}