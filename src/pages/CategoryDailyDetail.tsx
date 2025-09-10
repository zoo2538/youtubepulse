import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, TrendingUp, TrendingDown, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { categoryColors } from "@/lib/subcategories";
import { indexedDBService } from "@/lib/indexeddb-service";

// 하드코딩된 테스트 데이터 제거됨 - 실제 데이터만 사용

// categoryColors는 subcategories.ts에서 import

const formatNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억`;
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`;
  }
  return num.toLocaleString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    return (
      <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">조회수:</span>
            <span className="text-sm font-medium text-foreground">
              {data.views.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">변화율:</span>
            <span 
              className={`text-sm font-medium ${
                data.change > 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {data.change > 0 ? '+' : ''}{data.change}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CategoryDailyDetail = () => {
  const { category: rawCategory } = useParams<{ category: string }>();
  const category = decodeURIComponent(rawCategory || '');
  const navigate = useNavigate();
  const [classifiedData, setClassifiedData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  // 분류된 데이터 로드
  useEffect(() => {
    const loadClassifiedData = async () => {
      try {
        if (category) {
          // IndexedDB에서 분류된 데이터 로드
          const data = await indexedDBService.loadClassifiedData();
          setClassifiedData(data);
          
          // 해당 카테고리의 데이터만 필터링
          const filteredData = data.filter((item: any) => item.category === category);
          setCategoryData(filteredData);
        }
      } catch (error) {
        console.error('분류된 데이터 로드 실패:', error);
      }
    };

    loadClassifiedData();
  }, [category]);

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-4">카테고리를 찾을 수 없습니다</h2>
          <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
        </Card>
      </div>
    );
  }

  const categoryColor = categoryColors[category as keyof typeof categoryColors];
  const totalViews = categoryData.reduce((sum, item) => sum + (item.viewCount || 0), 0);
  const averageViews = categoryData.length > 0 ? Math.round(totalViews / categoryData.length) : 0;
  const uniqueChannels = new Set(categoryData.map(item => item.channelName)).size;

  // 실제 데이터에서 차트용 데이터 생성
  const chartData = categoryData.length > 0 ? categoryData.map((item, index) => {
    const previousViews = index > 0 ? categoryData[index - 1].viewCount : item.viewCount;
    const change = previousViews > 0 ? ((item.viewCount - previousViews) / previousViews) * 100 : 0;
    
    return {
      date: item.collectionDate || item.uploadDate,
      views: item.viewCount,
      change: Math.round(change * 100) / 100
    };
  }) : [];

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
        {/* 카테고리 헤더 */}
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>대시보드로 돌아가기</span>
          </Button>
          <div className="flex items-center space-x-3">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: categoryColor }}
            />
            <h1 className="text-2xl font-bold text-foreground">{category} 카테고리 상세</h1>
            <Badge variant="secondary" className="bg-accent text-accent-foreground">
              일별 조회수 분석
            </Badge>
          </div>
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 조회수</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(totalViews)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">전체</p>
                <p className="text-lg font-semibold text-foreground">
                  {categoryData.length}개 영상
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">평균 조회수</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(averageViews)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">영상당</p>
                <p className="text-lg font-semibold text-foreground">
                  평균
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">채널 수</p>
                <p className="text-2xl font-bold text-foreground">
                  {uniqueChannels}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">고유</p>
                <p className="text-lg font-semibold text-foreground">
                  채널
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* 차트 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">일별 조회수 추이</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke={categoryColor}
                strokeWidth={3}
                dot={{ fill: categoryColor, strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: categoryColor, strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* 상세 테이블 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">일별 상세 데이터</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">날짜</TableHead>
                  <TableHead className="text-right font-semibold">조회수</TableHead>
                  <TableHead className="text-center font-semibold">전일대비 변화율</TableHead>
                  <TableHead className="text-right font-semibold">전일 대비 증감</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((item, index) => {
                  const previousViews = index > 0 ? chartData[index - 1].views : item.views;
                  const viewsDiff = item.views - previousViews;
                  
                  return (
                    <TableRow key={item.date} className="hover:bg-surface-hover transition-colors">
                      <TableCell className="font-medium text-foreground">
                        {item.date}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        {item.views.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {item.change > 0 ? (
                            <TrendingUp className="w-4 h-4 text-success" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-danger" />
                          )}
                          <span 
                            className={`font-medium ${
                              item.change > 0 ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {item.change > 0 ? '+' : ''}{item.change}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span 
                          className={`font-medium ${
                            viewsDiff > 0 ? 'text-success' : viewsDiff < 0 ? 'text-danger' : 'text-muted-foreground'
                          }`}
                        >
                          {index > 0 ? (
                            <>
                              {viewsDiff > 0 ? '+' : ''}{viewsDiff.toLocaleString()}
                            </>
                          ) : (
                            '-'
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CategoryDailyDetail;