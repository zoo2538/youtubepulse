import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  TrendingDown,
  TrendingUp,
  Users,
  Eye,
  LogOut,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString, cn } from "@/lib/utils";
import { subCategories } from "@/lib/subcategories";
import { useAuth } from "@/hooks/useAuth";

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
  const { logout, userEmail } = useAuth();

  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [filteredChannelData, setFilteredChannelData] = useState<ChannelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");
  const [sortOption, setSortOption] = useState<string>("changePercent");

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
    (classifiedData: any[]) => {
    if (!classifiedData || classifiedData.length === 0) {
      setChannelData([]);
      setFilteredChannelData([]);
      return;
    }

    const targetDate = selectedDate || getKoreanDateString();
    const todayData = classifiedData.filter((item: any) => {
      const itemDate = item.collectionDate || item.uploadDate;
      return itemDate && itemDate.split("T")[0] === targetDate && item.channelId;
    });

    const yesterday = new Date(new Date(targetDate).getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const yesterdayData = classifiedData.filter(
      (item: any) =>
        (item.collectionDate || item.uploadDate)?.split("T")[0] === yesterday && item.channelId
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
        category: channel.category,
        subCategory: channel.subCategory,
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
      let classifiedData = await indexedDBService.loadClassifiedData();
      console.log(`📊 급등 채널 상세 - IndexedDB에서 ${classifiedData.length}개 로드`);

      // 백그라운드 서버 동기화 (UI 블로킹 없음)
      setTimeout(async () => {
        try {
          const serverData = await hybridService.getClassifiedData();
          if (serverData.length > classifiedData.length) {
            console.log(
              `🔄 급등 채널 상세 - 서버 데이터 ${serverData.length}개 > 로컬 ${classifiedData.length}개`
            );
            classifiedData = serverData;
            generateChannelStats(serverData);
          }
        } catch (error) {
          console.warn("⚠️ 급등 채널 상세 - 백그라운드 동기화 실패 (무시)", error);
        }
      }, 1000);

      generateChannelStats(classifiedData);
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
              <Button variant="outline" onClick={() => navigate("/data")}>
                📊 데이터
              </Button>
              <Button variant="outline" onClick={() => navigate("/system")}>
                <Calendar className="w-4 h-4 mr-2" />
                시스템
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TrendingChannelsDetail;

