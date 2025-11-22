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
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories } from "@/lib/subcategories";
import { useAuth } from "@/hooks/useAuth";

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

      const performanceVideos = todayData
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
                  {filteredVideos.map((video, index) => (
                    <TableRow key={video.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-semibold">{index + 1}</TableCell>
                      <TableCell>
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
                          <div className="flex-1 space-y-2">
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
                            <a
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-500 hover:text-blue-700 hover:underline line-clamp-2 text-sm leading-5 cursor-pointer block"
                              title={`${video.title} - 새 탭에서 열기`}
                            >
                              {video.title}
                            </a>
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

export default PerformanceVideosDetail;

