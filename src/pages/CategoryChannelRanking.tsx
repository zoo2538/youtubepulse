import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink, Settings, Filter } from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { subCategories, categoryColors } from "@/lib/subcategories";

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

  // 분류된 데이터 로드 (날짜별 필터링 적용)
  useEffect(() => {
    const loadClassifiedData = async () => {
      try {
        // IndexedDB에서 분류된 데이터 로드
        const data = await indexedDBService.loadClassifiedData();
        
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
          
          // 최근 데이터 사용 (오늘 데이터가 없으면 최근 데이터 사용)
          const now = new Date();
          const today = now.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"});
          let dateFilteredData = filteredData.filter((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            if (!itemDate) return false;
            
            // 다양한 날짜 형식 지원
            const normalizedItemDate = itemDate.split('T')[0]; // ISO 형식에서 날짜 부분만 추출
            
            return normalizedItemDate === today;
          });
          
          // 오늘 데이터가 없으면 최근 데이터 사용
          if (dateFilteredData.length === 0) {
            console.log(`📅 오늘(${today}) 데이터가 없음, 최근 데이터 사용`);
            dateFilteredData = filteredData;
          }
          
          console.log(`📅 데이터 필터링: ${filteredData.length}개 → ${dateFilteredData.length}개`);
          console.log(`📊 카테고리 동영상 순위 - 사용할 데이터 샘플:`, dateFilteredData.slice(0, 3));
          

          // 영상별 데이터로 변환하고 조회수 순으로 정렬
          const videoArray = dateFilteredData
            .map((item: any, index: number) => {
              const videoId = item.videoId || item.id;

              return {
                rank: index + 1,
                thumbnail: item.thumbnailUrl || `https://via.placeholder.com/64x64?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
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
          
          console.log(`📊 카테고리 동영상 순위 - 생성된 동영상 데이터: ${videoArray.length}개`);
          console.log(`📊 카테고리 동영상 순위 - 동영상 데이터 샘플:`, videoArray.slice(0, 3));
          setChannelData(videoArray);
          setFilteredChannelData(videoArray);
        }
      } catch (error) {
        console.error('분류된 데이터 로드 실패:', error);
      }
    };

    loadClassifiedData();
  }, [category]);

  // 세부카테고리 필터링 함수
  const applySubCategoryFilter = () => {
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
  };

  // 세부카테고리 변경 시 필터 적용
  useEffect(() => {
    applySubCategoryFilter();
  }, [selectedSubCategory, channelData]);


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
            <div className="grid grid-cols-8 gap-2">
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

        {/* 세부카테고리 필터 */}
        {channelData.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <label className="text-sm font-medium text-foreground">
                  세부카테고리 필터
                </label>
              </div>
              
              <div className="flex items-center space-x-4">
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
                
                <div className="text-sm text-muted-foreground">
                  {filteredChannelData.length}개 표시 (전체 {channelData.length}개 중)
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
                      <img 
                        src={video.thumbnail}
                        alt={video.videoTitle}
                        className="w-16 h-12 object-cover rounded"
                      />
                    </TableCell>
                    
                    <TableCell className="max-w-80">
                      {video.topVideoUrl && video.topVideoTitle ? (
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
      </div>
    </div>
  );
};

export default CategoryChannelRanking;