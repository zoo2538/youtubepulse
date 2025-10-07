import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Crown, Medal, Award } from "lucide-react";
import { cn, getKoreanDateString } from "@/lib/utils";
import { useEffect, useState } from "react";
import { hybridService } from "@/lib/hybrid-service";

interface CategoryRankingData {
  rank: number;
  category: string;
  todayViews: number;
  yesterdayViews: number;
  changeAmount: number;
  changePercent: number;
}

// Mock 데이터 제거 - 실제 IndexedDB 데이터 사용
const mockRankingData: CategoryRankingData[] = [
  {
    rank: 1,
          category: "기타",
    todayViews: 15800000,
    yesterdayViews: 12500000,
    changeAmount: 3300000,
    changePercent: 26
  },
  {
    rank: 2,
    category: "짜집기",
    todayViews: 12400000,
    yesterdayViews: 11200000,
    changeAmount: 1200000,
    changePercent: 10
  },
  {
    rank: 3,
    category: "게임",
    todayViews: 9800000,
    yesterdayViews: 10500000,
    changeAmount: -700000,
    changePercent: -6
  },
  {
    rank: 4,
    category: "연예",
    todayViews: 8600000,
    yesterdayViews: 7900000,
    changeAmount: 700000,
    changePercent: 8
  },
  {
    rank: 5,
    category: "정치",
    todayViews: 7200000,
    yesterdayViews: 6800000,
    changeAmount: 400000,
    changePercent: 5
  },
  {
    rank: 6,
    category: "AI",
    todayViews: 6500000,
    yesterdayViews: 5200000,
    changeAmount: 1300000,
    changePercent: 25
  },
  {
    rank: 7,
    category: "스포츠",
    todayViews: 5800000,
    yesterdayViews: 6100000,
    changeAmount: -300000,
    changePercent: -4
  },
  {
    rank: 8,
    category: "롱폼",
    todayViews: 5200000,
    yesterdayViews: 4800000,
    changeAmount: 400000,
    changePercent: 8
  },
  {
    rank: 9,
          category: "기타",
    todayViews: 4900000,
    yesterdayViews: 4500000,
    changeAmount: 400000,
    changePercent: 8
  },
  {
    rank: 10,
          category: "커뮤니티/썰",
    todayViews: 4200000,
    yesterdayViews: 3800000,
    changeAmount: 400000,
    changePercent: 10
  },
  {
    rank: 11,
    category: "해외짜집기",
    todayViews: 3600000,
    yesterdayViews: 3200000,
    changeAmount: 400000,
    changePercent: 12
  },
  {
    rank: 12,
            category: "라이프스타일",
    todayViews: 3200000,
    yesterdayViews: 2900000,
    changeAmount: 300000,
    changePercent: 10
  },
  {
    rank: 13,
    category: "오피셜",
    todayViews: 2800000,
    yesterdayViews: 2600000,
    changeAmount: 200000,
    changePercent: 7
  },
  {
    rank: 14,
          category: "쇼핑/리뷰",
    todayViews: 2500000,
    yesterdayViews: 2300000,
    changeAmount: 200000,
    changePercent: 8
  },
];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-500" />;
    case 2:
      return <Medal className="w-5 h-5 text-slate-400" />;
    case 3:
      return <Award className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
  }
}

function getRankBadgeVariant(rank: number) {
  if (rank <= 3) return "default";
  if (rank <= 5) return "secondary";
  return "outline";
}

export function CategoryDailyRanking() {
  const [rankingData, setRankingData] = useState<CategoryRankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

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
      console.log('🔄 카테고리 랭킹 데이터 업데이트 이벤트 감지:', event.detail);
      // 날짜 변경 이벤트 발생시켜 데이터 다시 로드
      window.dispatchEvent(new CustomEvent('dashboardDateChanged', { 
        detail: { selectedDate: selectedDate } 
      }));
    };

    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate as EventListener);
    };
  }, [selectedDate]);

  // 카테고리별 조회수 랭킹 데이터 로드
  useEffect(() => {
    const loadCategoryRanking = async () => {
      try {
        setLoading(true);
        const classifiedData = await hybridService.getClassifiedData();
        
        if (classifiedData && classifiedData.length > 0) {
          // 선택된 날짜의 데이터 필터링 (한국 시간 기준)
          const targetDate = selectedDate || getKoreanDateString();
          const todayData = classifiedData.filter((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            return itemDate && itemDate.split('T')[0] === targetDate && item.category;
          });

          // 어제 데이터
          const yesterdayStr = new Date(new Date(targetDate).getTime() - 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
          const yesterdayData = classifiedData.filter((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            return itemDate && itemDate.split('T')[0] === yesterdayStr && item.category;
          });

          // 카테고리별 조회수 집계
          const todayCategories: any = {};
          todayData.forEach((item: any) => {
            const category = item.category;
            if (!todayCategories[category]) {
              todayCategories[category] = 0;
            }
            todayCategories[category] += item.viewCount || 0;
          });

          const yesterdayCategories: any = {};
          yesterdayData.forEach((item: any) => {
            const category = item.category;
            if (!yesterdayCategories[category]) {
              yesterdayCategories[category] = 0;
            }
            yesterdayCategories[category] += item.viewCount || 0;
          });

          // 랭킹 데이터 생성
          const rankings: CategoryRankingData[] = Object.entries(todayCategories)
            .map(([category, todayViews]: [string, any]) => {
              const yesterdayViews = yesterdayCategories[category] || 0;
              const changeAmount = todayViews - yesterdayViews;
              const changePercent = yesterdayViews > 0 ? (changeAmount / yesterdayViews) * 100 : 0;

              return {
                rank: 0, // 순위는 나중에 설정
                category,
                todayViews,
                yesterdayViews,
                changeAmount,
                changePercent
              };
            })
            .sort((a, b) => b.todayViews - a.todayViews) // 조회수 기준 내림차순
            .slice(0, 10) // 상위 10개만
            .map((item, index) => ({
              ...item,
              rank: index + 1
            }));

          setRankingData(rankings);
        } else {
          setRankingData([]);
        }
      } catch (error) {
        console.error('카테고리 랭킹 데이터 로드 실패:', error);
        setRankingData([]);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryRanking();
  }, [selectedDate]);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">카테고리별 일별 조회수 TOP 10</h3>
        
        <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-16">순위</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead className="text-right">당일 조회수</TableHead>
                <TableHead className="text-right">전일 조회수</TableHead>
                <TableHead className="text-right">증감</TableHead>
                <TableHead className="text-right">증감률(%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    데이터 로딩 중...
                  </TableCell>
                </TableRow>
              ) : rankingData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                rankingData.map((item) => (
                  <TableRow key={item.rank} className="hover:bg-surface-hover transition-colors">
                    <TableCell>
                    <div className="flex items-center justify-center">
                      {getRankIcon(item.rank)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={getRankBadgeVariant(item.rank)}
                      className="font-medium"
                    >
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(item.todayViews)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNumber(item.yesterdayViews)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.changeAmount > 0 ? '+' : ''}{formatNumber(item.changeAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={cn(
                      "flex items-center justify-end space-x-1",
                      item.changePercent > 0 ? "text-success" : "text-danger"
                    )}>
                      {item.changePercent > 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {item.changePercent > 0 ? '+' : ''}{Math.floor(item.changePercent)}%
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