import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  ArrowLeft, 
  Filter, 
  Calendar,
  Eye,
  Play,
  LogOut,
  Users
} from "lucide-react";
import { indexedDBService } from "@/lib/indexeddb-service";
import { hybridService } from "@/lib/hybrid-service";
import { getKoreanDateString } from "@/lib/utils";
import { subCategories } from "@/lib/subcategories";
import { useAuth } from "@/contexts/AuthContext";

interface VideoData {
  id: string;
  thumbnail: string;
  title: string;
  channelName: string;
  views: number;
  timeAgo: string;
  category: string;
  subCategory: string;
  uploadDate: string;
  description: string;
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toLocaleString();
}

function formatTimeAgo(uploadDate: string): string {
  const upload = new Date(uploadDate);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - upload.getTime()) / (1000 * 60 * 60));
  
  if (diffHours < 1) return '방금 전';
  if (diffHours < 24) return `${diffHours}시간 전`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}주 전`;
}

const TrendingVideosDetail = () => {
  const navigate = useNavigate();
  const { logout, userEmail } = useAuth();
  const [videoData, setVideoData] = useState<VideoData[]>([]);
  const [filteredVideoData, setFilteredVideoData] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getKoreanDateString()); // 기본값: 오늘
  const [availableDates, setAvailableDates] = useState<string[]>([]); // 사용 가능한 날짜 목록
  // 하드코딩된 세부카테고리 사용
  const dynamicSubCategories = subCategories;
  const isAdmin = !!userEmail; // 로그인한 모든 사용자를 관리자로 처리

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

  // 하드코딩된 카테고리 사용 (동적 로딩 제거)
  useEffect(() => {
    console.log('📊 하드코딩된 카테고리 사용:', subCategories);
  }, []);

  // 사용 가능한 날짜 목록 생성 (최근 7일)
  useEffect(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"}));
    }
    setAvailableDates(dates);
    console.log('📅 사용 가능한 날짜 목록:', dates);
  }, []);

  // 데이터 로드
  const loadTrendingVideosData = async () => {
    try {
      setLoading(true);
      
      // 서버 우선 로드 (hybridService 사용)
      const classifiedData = await hybridService.getClassifiedData();
      
      console.log(`📊 조회수 급등 동영상 상세 - 전체 분류된 데이터: ${classifiedData.length}개`);
      
      if (classifiedData && classifiedData.length > 0) {
        // 선택된 날짜 또는 오늘 날짜 기준으로 데이터 필터링 (한국 시간 기준)
        const targetDate = selectedDate || getKoreanDateString();
        const filteredData = classifiedData
          .filter((item: any) => {
            const itemDate = item.collectionDate || item.uploadDate;
            return itemDate && itemDate.split('T')[0] === targetDate &&
                   item.category && item.videoTitle;
          })
          .sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0)) // 조회수 기준 내림차순
          .slice(0, 100); // 상위 100개 표시

        console.log(`📊 조회수 급등 동영상 상세 - ${targetDate} 날짜 데이터: ${filteredData.length}개`);

        // 비디오 데이터 변환
        const videos: VideoData[] = filteredData.map((item: any) => {
          const videoId = item.videoId || item.id;

          return {
            id: videoId,
            thumbnail: item.thumbnailUrl || `https://via.placeholder.com/320x180?text=${item.videoTitle?.substring(0, 2) || 'YT'}`,
            title: item.videoTitle || '제목 없음',
            channelName: item.channelName || '채널명 없음',
            views: item.viewCount || 0,
            timeAgo: formatTimeAgo(item.uploadDate || item.collectionDate),
            category: item.category || '기타',
            subCategory: item.subCategory || '미분류',
            uploadDate: item.uploadDate || item.collectionDate,
            description: item.videoDescription || item.description || ''
          };
        });

        console.log(`📊 조회수 급등 동영상 상세 - 생성된 비디오 데이터: ${videos.length}개`);
        setVideoData(videos);
        setFilteredVideoData(videos);
      } else {
        setVideoData([]);
        setFilteredVideoData([]);
      }
    } catch (error) {
      console.error('조회수 급등 동영상 데이터 로드 실패:', error);
      setVideoData([]);
      setFilteredVideoData([]);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 로드 및 업데이트 이벤트 리스너
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      console.log('🔄 조회수 급등 동영상 상세 데이터 업데이트 이벤트 감지:', event.detail);
      loadTrendingVideosData();
    };
    
    // 컴포넌트 마운트 시 데이터 로드
    loadTrendingVideosData();
    
    // 데이터 업데이트 이벤트 리스너 등록
    window.addEventListener('dataUpdated', handleDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate as EventListener);
    };
  }, [selectedDate]);

  // 필터링 함수
  const applyFilters = () => {
    let filtered = [...videoData];

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(video => video.category === selectedCategory);
    }

    // 세부카테고리 필터링
    if (selectedSubCategory !== 'all') {
      filtered = filtered.filter(video => video.subCategory === selectedSubCategory);
    }

    setFilteredVideoData(filtered);
  };

  // 필터 변경 시 적용
  useEffect(() => {
    applyFilters();
  }, [selectedCategory, selectedSubCategory, videoData]);

  // 카테고리 변경 시 세부카테고리 초기화
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubCategory('all');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">조회수 급등 동영상 데이터를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 네비게이션 */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-red-600" />
                <h1 className="text-2xl font-bold text-foreground">조회수 급등 동영상</h1>
                <Badge className="bg-red-600 text-white">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  급상승
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/user-management')}>
                  <Users className="w-4 h-4 mr-2" />
                  회원관리
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <Eye className="w-4 h-4 mr-2" />
                국내
              </Button>
              <Button variant="outline" onClick={() => navigate('/data')}>
                📊 데이터
              </Button>
              <Button variant="outline" onClick={() => navigate('/system')}>
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

      <div className="container mx-auto px-4 py-8">
        {/* 필터 컨트롤 */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-foreground">필터 설정</h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium text-muted-foreground">날짜:</label>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="날짜 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(date => (
                      <SelectItem key={date} value={date}>
                        {date === getKoreanDateString() ? `오늘 (${date})` : date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">카테고리:</label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {Object.keys(dynamicSubCategories).map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-muted-foreground">세부카테고리:</label>
                <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="세부카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {selectedCategory !== 'all' && dynamicSubCategories[selectedCategory]?.map(subCategory => (
                      <SelectItem key={subCategory} value={subCategory}>
                        {subCategory}
                      </SelectItem>
                    ))}
                    {/* 디버깅용 로그 */}
                    {selectedCategory !== 'all' && console.log(`📊 정치 카테고리 세부카테고리:`, dynamicSubCategories[selectedCategory])}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* 결과 요약 */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">조회수 급등 동영상 목록</h3>
              <p className="text-sm text-muted-foreground mt-1">
                총 {filteredVideoData.length}개 동영상 표시
                {selectedCategory !== 'all' && ` (${selectedCategory})`}
                {selectedSubCategory !== 'all' && ` - ${selectedSubCategory}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">전체 {videoData.length}개 중</p>
              <p className="text-lg font-semibold text-foreground">
                {filteredVideoData.length}개 표시
              </p>
            </div>
          </div>
        </Card>

        {/* 동영상 목록 */}
        <Card className="p-6">
          {filteredVideoData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">조회수 급등 동영상이 없습니다</p>
              <p className="text-sm mt-2">
                {videoData.length === 0 
                  ? "데이터 수집을 먼저 진행해주세요."
                  : "선택한 필터 조건에 맞는 동영상이 없습니다."
                }
              </p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">표가 제거되었습니다</p>
              <p className="text-sm mt-2">
                조회수 급등 동영상 표시 기능이 비활성화되었습니다.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TrendingVideosDetail;

