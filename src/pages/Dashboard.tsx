import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { ChannelTrendingTable } from "@/components/dashboard/channel-trending-table";
import { TrendingVideosGrid } from "@/components/dashboard/trending-videos-grid";
import { PerformanceVideosList } from "@/components/dashboard/performance-videos-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Users, LogOut, TrendingUp, User } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Logo from "@/components/ui/logo";
import { useEffect } from "react";
import { hybridDatabaseService } from '@/lib/hybrid-database-service'; // ✅ 추가

const Dashboard = () => {
  const { userEmail, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = userRole === 'admin';

  // 임시 비밀번호 기능은 현재 비활성화 상태
  // useEffect(() => {
  //   // 임시 비밀번호 감지 로직 비활성화
  // }, [userEmail, navigate]);

  useEffect(() => {
    // 앱 시작 시, PostgreSQL의 최신 데이터를 IndexedDB로 동기화
    const initialSync = async () => {
      try {
        console.log('🔄 웹 실행: PostgreSQL에서 최신 데이터 동기화 시작');
        
        // 동기화 활성화
        hybridDatabaseService.updateConfig({ syncEnabled: true });
        
        // hybridDatabaseService 내부에 syncFromPostgreSQL 함수를 호출
        await hybridDatabaseService.syncFromPostgreSQL();
        
        console.log('✅ 최신 데이터 동기화 완료. 화면에 표시 시작');
        
        // 동기화 완료 후, 화면에 데이터를 다시 로딩하거나 상태를 업데이트하는 로직이 필요
        // loadData(); 
        
      } catch (error) {
        console.error('❌ 초기 동기화 실패:', error);
      }
    };
    
    initialSync();
    
    // 이 useEffect는 한 번만 실행되도록 빈 배열을 넣어줍니다.
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
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
              {location.pathname === '/dashboard' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4">
                  국내
                </span>
              ) : (
                <Link to="/dashboard">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    국내
                  </Button>
                </Link>
              )}
              {location.pathname === '/trend' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  트렌드
                </span>
              ) : (
                <Link to="/trend">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    트렌드
                  </Button>
                </Link>
              )}
              {location.pathname === '/data' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4">
                  📊 데이터
                </span>
              ) : (
                <Link to="/data">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    📊 데이터
                  </Button>
                </Link>
              )}
              {location.pathname === '/system' ? (
                <span className="text-base font-semibold text-red-600 underline underline-offset-4 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  시스템
                </span>
              ) : (
                <Link to="/system">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    시스템
                  </Button>
                </Link>
              )}
              
              {/* User Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="bg-transparent border-white/30 text-white hover:bg-white/10"
                  >
                    <User className="w-4 h-4 mr-2" />
                    사용자
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/user-management" className="cursor-pointer">
                        <Users className="w-4 h-4 mr-2" />
                        회원관리
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/change-password" className="cursor-pointer">
                      비밀번호 변경
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        <DashboardFilters />
        <DashboardOverview />
        
        <div className="space-y-6">
          <ChannelTrendingTable />
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TrendingVideosGrid />
            <PerformanceVideosList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
